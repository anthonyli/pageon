import test from 'node:test';
import assert from 'node:assert/strict';
import { createFileSaver } from '../packages/runtime/src/file-save.js';
import { openRuntime } from './public/runtime-fixture.mjs';
import { createRuntime } from '@pageon/runtime';
import { parseHTML } from 'linkedom';

function fixture(overrides = {}) {
  const calls = [], statuses = [];
  let destroyed = false;
  const writable = {
    async write(html) { calls.push(['write', html]); },
    async close() { calls.push(['close']); },
    async abort() { calls.push(['abort']); },
  };
  const handle = {
    name: '当前文件.html',
    async requestPermission(options) { calls.push(['permission', options.mode]); return 'granted'; },
    async createWritable() { calls.push(['writable']); return writable; },
  };
  const window = {
    isSecureContext: true,
    location: { protocol: 'file:', pathname: '/documents/%E5%BD%93%E5%89%8D%E6%96%87%E4%BB%B6.html' },
    async showSaveFilePicker(options) { calls.push(['picker', options]); return handle; },
    ...overrides,
  };
  const saver = createFileSaver({ window, lang: 'zh', fileName: 'original.html', isDestroyed: () => destroyed, onStatus: value => statuses.push(value) });
  return { window, saver, calls, statuses, handle, writable, destroy() { destroyed = true; } };
}

test('save prefills the current name before serialization and reuses the confirmed destination on subsequent saves', async () => {
  const app = fixture();
  let revision = 0;
  const serialize = () => { app.calls.push(['serialize']); return { html: `<h1>Revision ${++revision}</h1>` }; };
  assert.equal(await app.saver.save(serialize), true);
  assert.equal(await app.saver.save(serialize), true);
  assert.deepEqual(app.calls.map(call => call[0]), ['picker', 'permission', 'serialize', 'writable', 'write', 'close', 'permission', 'serialize', 'writable', 'write', 'close']);
  assert.equal(app.calls[0][1].suggestedName, '当前文件.html');
  assert.equal(app.calls[0][1].id, 'pageon-save-html');
  assert.equal(app.calls[4][1], '<h1>Revision 1</h1>');
  assert.equal(app.calls[9][1], '<h1>Revision 2</h1>');
  assert.equal(app.statuses.at(-1), '已保存到 当前文件.html');
});

test('picker cancellation leaves the document untouched and permits another save', async () => {
  const app = fixture(); let serializations = 0, picks = 0;
  app.window.showSaveFilePicker = async () => { if (!picks++) throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); return app.handle; };
  const serialize = () => { serializations++; return { html: 'edited' }; };
  assert.equal(await app.saver.save(serialize), false);
  assert.equal(serializations, 0); assert.equal(app.calls.length, 0);
  assert.equal(app.statuses.at(-1), '已取消保存');
  assert.equal(await app.saver.save(serialize), true);
});

test('denied permission cannot overwrite the selected destination', async () => {
  const app = fixture(); let serializations = 0;
  app.handle.requestPermission = async () => 'denied';
  await assert.rejects(app.saver.save(() => { serializations++; return { html: 'edited' }; }), /保存失败/);
  assert.equal(serializations, 0);
  assert.ok(!app.calls.some(call => call[0] === 'writable'));
  assert.ok(!app.statuses.some(value => value.startsWith('已保存到')));
});

test('a name deliberately changed in the native save dialog becomes the destination for subsequent saves', async () => {
  const app = fixture(); app.handle.name = 'chosen-name.html';
  await app.saver.save(() => ({ html: 'first edit' }));
  await app.saver.save(() => ({ html: 'next edit' }));
  assert.equal(app.calls.filter(call => call[0] === 'picker').length, 1);
  assert.equal(app.calls.filter(call => call[0] === 'write').length, 2);
  assert.equal(app.statuses.at(-1), '已保存到 chosen-name.html');
});

test('hosted documents use their configured filename as the save dialog default', async () => {
  const app = fixture({ location: { protocol: 'https:', pathname: '/preview' } });
  await app.saver.save(() => ({ html: 'edited' }));
  assert.equal(app.calls[0][1].suggestedName, 'original.html');
});

test('write and close failures abort the stream and never report success', async () => {
  for (const stage of ['write', 'close']) {
    const app = fixture();
    app.writable[stage] = async () => { throw new Error(`failed-${stage}`); };
    await assert.rejects(app.saver.save(() => ({ html: 'edited' })), new RegExp(`failed-${stage}`));
    assert.equal(app.calls.at(-1)[0], 'abort');
    assert.ok(!app.statuses.some(value => value.startsWith('已保存到')));
  }
});

test('success appears only after the writable stream has closed', async () => {
  const app = fixture(); let finish;
  app.writable.close = () => new Promise(resolve => { finish = resolve; });
  const saving = app.saver.save(() => ({ html: 'edited' }));
  while (!finish) await Promise.resolve();
  assert.equal(app.statuses.at(-1), '正在保存…');
  finish(); await saving;
  assert.equal(app.statuses.at(-1), '已保存到 当前文件.html');
});

test('destroying the runtime during file selection or writing prevents committing data', async () => {
  for (const stage of ['picker', 'write']) {
    const app = fixture();
    if (stage === 'picker') app.window.showSaveFilePicker = async () => { app.destroy(); return app.handle; };
    else app.writable.write = async () => { app.destroy(); };
    assert.equal(await app.saver.save(() => ({ html: 'edited' })), false);
    assert.ok(!app.calls.some(call => call[0] === 'close'));
    if (stage === 'write') assert.equal(app.calls.at(-1)[0], 'abort');
  }
});

test('save capability excludes unsupported browsers, insecure contexts and embedded frames', () => {
  for (const overrides of [{ showSaveFilePicker: undefined }, { isSecureContext: false }, { top: {} }]) {
    assert.equal(fixture(overrides).saver.canSave, false);
  }
});

test('generated basic runtime saves edits to the selected original, while explicit copy still downloads', async () => {
  const app = fixture();
  const page = openRuntime('floating', undefined, { lang: 'zh' }, app.window);
  try {
    assert.equal(page.shadow.querySelectorAll('.bar > button')[1].textContent, '保存');
    page.controller.enterEdit();
    const id = page.document.querySelector('h1').getAttribute('data-artifact-local-node');
    page.controller.apply({ type: 'set-text', nodeId: id, value: '直接保存' });
    await page.controller.save(); await page.controller.save();
    assert.equal(app.calls.filter(call => call[0] === 'picker').length, 1);
    const html = app.calls.find(call => call[0] === 'write')[1];
    assert.match(html, /直接保存/); assert.match(html, /pageon-local-runtime-script/);
    assert.equal(page.saved(), undefined, 'direct save never creates a download');
    assert.equal(page.document.documentElement.getAttribute('data-artifact-local-edit'), 'true');
    await page.controller.saveCopy();
    assert.match(page.saved(), /直接保存/);
    assert.equal(page.shadow.querySelector('.file-status').textContent, '已下载副本，原文件未更新。');
  } finally { page.controller.destroy(); }
});

test('generated basic runtime cancels or rejects save without silently downloading and releases the saving guard', async () => {
  for (const name of ['AbortError', 'NotAllowedError', 'SecurityError']) {
    const app = fixture({ showSaveFilePicker: async () => { throw Object.assign(new Error('blocked'), { name }); } });
    const page = openRuntime('floating', undefined, { lang: 'zh' }, app.window);
    try {
      const saving = page.controller.save();
      if (name === 'AbortError') await saving; else await assert.rejects(saving, /blocked/);
      assert.equal(page.saved(), undefined);
      assert.equal(page.shadow.querySelectorAll('.bar > button')[1].disabled, false);
      assert.match(page.shadow.querySelector('.file-status').textContent, name === 'AbortError' ? /已取消/ : /保存失败/);
      await page.controller.saveCopy(); assert.ok(page.saved());
    } finally { page.controller.destroy(); }
  }
});

test('explicit copy downloads remain separate from a host-provided save callback', async () => {
  const { document } = parseHTML('<html><head></head><body><h1>Host document</h1></body></html>');
  const create = document.createElement.bind(document); let downloads = 0, hostSaves = 0;
  document.createElement = tag => { const node = create(tag); if (tag === 'a') node.click = () => { downloads++; }; return node; };
  const runtime = createRuntime({ document, ui: false, imageExport: false, onSave: () => { hostSaves++; } });
  try {
    await runtime.save(); assert.equal(hostSaves, 1); assert.equal(downloads, 0);
    await runtime.saveCopy(); assert.equal(hostSaves, 1); assert.equal(downloads, 1);
  } finally { runtime.destroy(); }
});
