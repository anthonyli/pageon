import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRuntimeCode } from '../../packages/runtime/src/runtime.js';
import { build } from 'esbuild';

function open(html, { lang = 'en', source = createRuntimeCode({ lang, imageExport: false }), url = 'file:///notes.html', fileSave = false } = {}) {
  let shadow;
  const errors = [];
  const copies = [], writes = [];
  const dom = new JSDOM(html || `<html><head></head><body><h1>Title</h1><p>Body</p><img alt="Diagram"><script id="pageon-local-runtime-script">${source}</script></body></html>`, {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', error => errors.push(error)),
    beforeParse(win) {
      win.Blob = class { constructor(parts) { this.parts = parts; } };
      win.URL.createObjectURL = blob => { copies.push(blob.parts.join('')); return 'blob:notes'; };
      win.URL.revokeObjectURL = () => {};
      win.HTMLAnchorElement.prototype.click = () => {};
      if (fileSave) win.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async value => writes.push(value), close: async () => {} }) });
      const attach = win.HTMLElement.prototype.attachShadow;
      win.HTMLElement.prototype.attachShadow = function (options) {
        const root = attach.call(this, options);
        if (this.localName === 'pageon-runtime') shadow = root;
        return root;
      };
      win.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 30, left: 30, bottom: 100, right: 200, width: 170, height: 70 });
    },
  });
  const win = dom.window, doc = win.document;
  const click = node => node.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
  return { win, doc, shadow, errors, copies, writes, runtime: win.PageOnRuntime, click,
    edit(node, value) {
      if (win.document.documentElement.dataset.artifactLocalEdit !== 'true') win.PageOnRuntime.enterEdit();
      click(node);
      if (shadow.querySelector('.note-form').hidden) click(shadow.querySelector('.notes-button'));
      const input = shadow.querySelector('textarea');
      assert.equal(input.disabled, false);
      input.value = value;
      input.dispatchEvent(new win.Event('input', { bubbles: true, composed: true }));
    },
    close() { win.PageOnRuntime?.destroy(); win.PageOnNotes?.destroy(); win.close(); },
  };
}

test('ordinary exported HTML adds, edits and deletes notes across offline save/reopen, preserving text and script safety', async () => {
  const first = open();
  let reopened, last;
  try {
    const h1 = first.doc.querySelector('h1');
    const value = 'Speaker <script>window.injected=true</script> & "notes"\nLine two';
    first.edit(h1, value);
    assert.equal(h1.getAttribute('data-pageon-note'), value);
    assert.equal(first.doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 1);
    const saved = first.runtime.serialize().html;
    assert.equal(first.shadow.querySelector('textarea').value, value, 'saving restores note selection');
    assert.equal(first.shadow.querySelector('.note-form').hidden, false);
    reopened = open(saved);
    assert.deepEqual(reopened.errors, []);
    assert.equal(reopened.win.injected, undefined);
    assert.equal(reopened.doc.querySelector('h1').textContent, 'Title');
    assert.equal(reopened.doc.querySelector('h1').getAttribute('data-pageon-note'), value);
    assert.equal(reopened.doc.querySelectorAll('#pageon-notes-script').length, 1);
    reopened.runtime.enterEdit();
    reopened.win.PageOnNotes.refresh();
    reopened.click(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button'));
    assert.equal(reopened.shadow.querySelector('textarea').value, value, 'marker opens existing note editor');
    reopened.edit(reopened.doc.querySelector('h1'), 'Changed offline');
    reopened.click(reopened.shadow.querySelector('.note-delete'));
    assert.equal(reopened.doc.querySelector('h1').hasAttribute('data-pageon-note'), false);
    last = open(reopened.runtime.serialize().html);
    assert.equal(last.doc.querySelector('[data-pageon-note]'), null);
    assert.equal(last.doc.querySelector('#pageon-notes-script'), null);
    last.edit(last.doc.querySelector('img'), 'Image note');
    assert.equal(last.doc.querySelector('img').getAttribute('data-pageon-note'), 'Image note');
  } finally { first.close(); reopened?.close(); last?.close(); }
});

test('Save and Save copy retain the latest note without re-import or a separate apply step', async () => {
  const f = open(undefined, { fileSave: true });
  try {
    f.edit(f.doc.querySelector('p'), 'First edit');
    await f.runtime.save();
    assert.match(f.writes[0], /data-pageon-note="First edit"/);
    f.edit(f.doc.querySelector('p'), 'Second edit');
    await f.runtime.saveCopy();
    assert.match(f.copies[0], /data-pageon-note="Second edit"/);
    assert.equal(f.writes.length, 1, 'save copy does not overwrite the chosen file');
  } finally { f.close(); }
});

test('standard toolbar follows selected text, stays movable while editing, and notes remain independent', () => {
  const f = open();
  try {
    const host = f.doc.querySelector('pageon-runtime'), heading = f.doc.querySelector('h1'), body = f.doc.querySelector('p');
    let top = 400;
    heading.getBoundingClientRect = () => ({ left: 500, right: 700, top, bottom: top + 40, width: 200, height: 40 });
    body.getBoundingClientRect = () => ({ left: 50, right: 200, top: 70, bottom: 110, width: 150, height: 40 });
    host.getBoundingClientRect = () => ({ left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0, width: 170, height: 70 });
    f.runtime.enterEdit(); f.click(heading);
    assert.equal(host.style.top, '322px');
    assert.equal(host.style.left, '515px');
    top = 250; f.doc.dispatchEvent(new f.win.Event('scroll'));
    assert.equal(host.style.top, '172px');
    const drag = f.shadow.querySelector('.drag-handle');
    for (const [type, x, y] of [['pointerdown', 520, 180], ['pointermove', 100, 100], ['pointerup', 100, 100]]) {
      drag.dispatchEvent(new f.win.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, composed: true }));
    }
    const moved = host.style.top;
    top = 500; f.doc.dispatchEvent(new f.win.Event('scroll'));
    assert.equal(host.style.top, moved, 'manual drag pins the toolbar until a new selection');
    f.click(body); assert.equal(host.style.top, '118px');
    f.click(f.shadow.querySelector('.notes-button'));
    const panel = f.shadow.querySelector('.note-form');
    assert.equal(panel.parentNode, f.shadow, 'notes are outside the toolbar layout and its backdrop filter');
    assert.equal(panel.style.position, 'fixed');
    assert.ok(parseFloat(panel.style.width) <= 320);
  } finally { f.close(); }
});

test('note form isolates Space and arrows, supports Chinese and keeps hidden audience notes editable', () => {
  const f = open(undefined, { lang: 'zh', url: 'file:///notes.html?pageon-notes=off' });
  try {
    assert.equal(f.shadow.querySelector('.notes-button').textContent, '批注');
    f.edit(f.doc.querySelector('p'), '新批注');
    let deckKeys = 0;
    f.doc.addEventListener('keydown', () => deckKeys++);
    for (const key of [' ', 'ArrowRight', 'ArrowLeft']) {
      const event = new f.win.KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
      f.shadow.querySelector('textarea').dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
    }
    assert.equal(deckKeys, 0);
    assert.equal(f.doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 0);
    assert.match(f.runtime.serialize().html, /新批注/);
    f.runtime.exitEdit();
    assert.equal(f.shadow.querySelector('.note-form').hidden, true);
  } finally { f.close(); }
});

for (const search of ['', '?pageon-notes=off']) test(`notes added offline keep Space cue order and native arrow navigation after saving a deck ${search}`, () => {
  const controller = `<script>window.deckKeys=[];window.addEventListener('keydown',event=>{window.deckKeys.push(event.key);if(event.key===' '||event.key==='ArrowRight')document.body.dataset.page='next';},true);</script>`;
  const f = open(`<html><head>${controller}</head><body><section class="slide active"><h1>Title</h1></section><section class="slide" hidden><p>Next</p></section><script id="pageon-local-runtime-script">${createRuntimeCode({ imageExport: false })}</script></body></html>`);
  let reopened;
  try {
    f.edit(f.doc.querySelector('h1'), 'Saved cue');
    reopened = open(f.runtime.serialize().html, { url: `file:///notes.html${search}` });
    const key = key => reopened.doc.body.dispatchEvent(new reopened.win.KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : key, bubbles: true, cancelable: true }));
    key(' ');
    assert.equal(reopened.doc.body.dataset.page, undefined);
    assert.equal(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('[role="status"]').textContent, 'Saved cue');
    if (search) assert.equal(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 0);
    reopened.doc.body.dispatchEvent(new reopened.win.KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    key(' ');
    assert.equal(reopened.doc.body.dataset.page, 'next');
    key('ArrowLeft');
    assert.deepEqual([...reopened.win.deckKeys], ['ArrowRight', 'ArrowLeft']);
    assert.equal(reopened.doc.querySelectorAll('#pageon-notes-script').length, 1);
    reopened.edit(reopened.doc.querySelector('h1'), 'Edit without navigating');
    const input = reopened.shadow.querySelector('textarea');
    input.focus();
    for (const key of [' ', 'ArrowRight', 'ArrowLeft']) input.dispatchEvent(new reopened.win.KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    assert.deepEqual([...reopened.win.deckKeys], ['ArrowRight', 'ArrowLeft'], 'original window capture listeners cannot navigate while typing notes');
  } finally { f.close(); reopened?.close(); }
});

test('bundled production runtime saves notes with a standalone early playback script', async () => {
  const result = await build({ stdin: { contents: 'export { createRuntimeCode } from "./packages/runtime/src/runtime.js"', resolveDir: process.cwd() }, bundle: true, minify: true, write: false, format: 'esm', platform: 'browser' });
  const mod = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const f = open(undefined, { source: mod.createRuntimeCode({ imageExport: false }) });
  let reopened;
  try {
    assert.deepEqual(f.errors, []);
    f.edit(f.doc.querySelector('h1'), 'Production note');
    reopened = open(f.runtime.serialize().html);
    assert.deepEqual(reopened.errors, []);
    assert.equal(reopened.doc.querySelector('h1').getAttribute('data-pageon-note'), 'Production note');
    reopened.edit(reopened.doc.querySelector('h1'), 'Still editable');
    assert.equal(reopened.doc.querySelector('h1').getAttribute('data-pageon-note'), 'Still editable');
  } finally { f.close(); reopened?.close(); }
});

test('standard selected-text notes survive save/reopen and dismiss when choosing another element', () => {
  const f = open(); let reopened;
  try {
    f.runtime.enterEdit(); const title = f.doc.querySelector('h1'); f.click(title);
    const range = f.doc.createRange(); range.setStart(title.firstChild, 1); range.setEnd(title.firstChild, 4);
    f.doc.getSelection().removeAllRanges(); f.doc.getSelection().addRange(range);
    f.click(f.shadow.querySelector('.notes-button'));
    const input = f.shadow.querySelector('textarea'); input.value = 'Text cue'; input.dispatchEvent(new f.win.Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new f.win.MouseEvent('pointerdown', { bubbles: true, composed: true }));
    assert.equal(f.shadow.querySelector('.note-form').hidden, false, 'closed shadow input stays open');
    f.doc.body.dispatchEvent(new f.win.MouseEvent('pointerdown', { bubbles: true, composed: true }));
    assert.equal(f.shadow.querySelector('.note-form').hidden, true, 'outside pointer dismisses the panel');
    f.click(f.shadow.querySelector('.notes-button'));
    assert.equal(title.querySelector('[data-pageon-note-range]').textContent, 'itl');
    assert.equal(title.style.backgroundColor, '');
    f.click(f.doc.querySelector('p')); assert.equal(f.shadow.querySelector('.note-form').hidden, true);
    reopened = open(f.runtime.serialize().html); reopened.runtime.enterEdit();
    const mark = reopened.doc.querySelector('[data-pageon-note-range]');
    assert.equal(mark.style.color, 'rgb(0, 0, 0)');
    reopened.win.PageOnNotes.refresh(); reopened.click(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button'));
    assert.equal(reopened.shadow.querySelector('textarea').value, 'Text cue');
    reopened.click(reopened.shadow.querySelector('.note-delete'));
    assert.equal(reopened.doc.querySelector('[data-pageon-note-range]'), null);
    assert.equal(reopened.doc.querySelector('h1').textContent, 'Title');
  } finally { f.close(); reopened?.close(); }
});
