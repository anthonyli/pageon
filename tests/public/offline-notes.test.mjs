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
    first.click(first.shadow.querySelector('button[aria-label="Note color #fa70ab"]'));
    assert.equal(h1.dataset.pageonNoteColor, '#fa70ab');
    assert.equal(first.doc.querySelector('pageon-notes').shadowRoot.querySelector('button').style.backgroundColor, 'rgb(250, 112, 171)');
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
    assert.equal(reopened.shadow.querySelector('button[aria-label="Note color #fa70ab"]').getAttribute('aria-pressed'), 'true');
    assert.equal(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button').style.backgroundColor, 'rgb(250, 112, 171)');
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
    const select = reopened.shadow.querySelector('#pageon-note-animation'); select.focus();
    for (const key of [' ', 'ArrowRight', 'ArrowLeft', 'ArrowDown']) select.dispatchEvent(new reopened.win.KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    assert.deepEqual([...reopened.win.deckKeys], ['ArrowRight', 'ArrowLeft'], 'animation selection does not navigate the deck');
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
    const select = f.shadow.querySelector('#pageon-note-animation'); select.value = 'fade';
    select.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true }));
    reopened = open(f.runtime.serialize().html);
    assert.deepEqual(reopened.errors, []);
    assert.equal(reopened.doc.querySelector('h1').getAttribute('data-pageon-note'), 'Production note');
    reopened.win.PageOnNotes.refresh();
    const calls = []; reopened.win.HTMLElement.prototype.animate = frames => { calls.push(frames); return { cancel() {} }; };
    reopened.click(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button'));
    assert.equal(calls.length, 1); assert.equal(calls[0][0].opacity, 0);
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
    assert.equal(title.querySelector('[data-pageon-note-range]').style.color, 'inherit');
    const textTrigger = f.shadow.querySelector('button[aria-label="Selected text color"]');
    assert.equal(textTrigger.getAttribute('aria-expanded'), 'false');
    f.click(textTrigger);
    const hex = f.shadow.querySelector('input[aria-label="Selected text color HEX"]'); hex.value = '#123abc';
    hex.dispatchEvent(new f.win.Event('change', { bubbles: true }));
    assert.equal(title.querySelector('[data-pageon-note-range]').dataset.pageonNoteTextColor, '#123abc');
    assert.match(f.runtime.serialize().html, /data-pageon-note-text-color="#123abc"/);
    f.click(f.shadow.querySelector('button[aria-label="Selected text color #fa70ab"]'));
    assert.equal(title.style.backgroundColor, '');
    f.click(f.shadow.querySelector('button[aria-label="Note color #02bb9f"]'));
    assert.equal(title.querySelector('[data-pageon-note-range]').style.backgroundColor, 'rgb(2, 187, 159)');
    f.click(f.doc.querySelector('p')); assert.equal(f.shadow.querySelector('.note-form').hidden, true);
    reopened = open(f.runtime.serialize().html); reopened.runtime.enterEdit();
    const mark = reopened.doc.querySelector('[data-pageon-note-range]');
    assert.equal(mark.style.color, 'rgb(250, 112, 171)');
    assert.equal(mark.dataset.pageonNoteTextColor, '#fa70ab');
    reopened.win.PageOnNotes.refresh(); reopened.click(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button'));
    assert.equal(reopened.shadow.querySelector('textarea').value, 'Text cue');
    assert.equal(mark.style.backgroundColor, 'rgb(2, 187, 159)');
    assert.equal(mark.dataset.pageonNoteColor, '#02bb9f');
    assert.equal(reopened.shadow.querySelector('button[aria-label="Note color #02bb9f"]').getAttribute('aria-pressed'), 'true');
    assert.equal(reopened.shadow.querySelector('button[aria-label="Selected text color #fa70ab"]').getAttribute('aria-pressed'), 'true');
    reopened.click([...reopened.shadow.querySelectorAll('button')].find(button => button.textContent === 'Use original color'));
    assert.equal(mark.style.color, 'inherit');
    assert.equal(mark.style.backgroundColor, 'rgb(2, 187, 159)', 'resetting the text keeps the background');
    assert.equal(mark.hasAttribute('data-pageon-note-text-color'), false);
    reopened.click(reopened.shadow.querySelector('button[aria-label="Note color #a25aff"]'));
    assert.equal(mark.style.backgroundColor, 'rgb(162, 90, 255)');
    reopened.click(reopened.shadow.querySelector('.note-delete'));
    assert.equal(reopened.doc.querySelector('[data-pageon-note-range]'), null);
    assert.equal(reopened.doc.querySelector('h1').textContent, 'Title');
  } finally { f.close(); reopened?.close(); }
});

for (const lang of ['en', 'zh']) test(`offline animation selection saves, reopens, plays and clears (${lang})`, () => {
  const f = open(undefined, { lang }); let reopened;
  try {
    f.edit(f.doc.querySelector('h1'), '');
    const select = f.shadow.querySelector('#pageon-note-animation');
    assert.equal(select.value, 'none');
    assert.deepEqual([...select.options].map(o => o.value), ['none', 'fade', 'fly', 'zoom']);
    assert.equal(select.labels[0].textContent, lang === 'zh' ? '出现方式' : 'Entrance animation');
    select.value = 'zoom'; select.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true }));
    assert.equal(select.value, 'zoom', 'an entrance can be chosen before entering text');
    assert.equal(f.doc.querySelector('h1').hasAttribute('data-pageon-note'), false);
    const input = f.shadow.querySelector('textarea'); input.value = 'Animated note';
    input.dispatchEvent(new f.win.Event('input', { bubbles: true, composed: true }));
    assert.equal(f.doc.querySelector('h1').dataset.pageonNoteAnimation, 'zoom');
    reopened = open(f.runtime.serialize().html);
    assert.deepEqual(reopened.errors, []);
    reopened.win.PageOnNotes.refresh();
    const calls = [];
    reopened.win.HTMLElement.prototype.animate = function (frames) { calls.push({ node: this, frames }); return { cancel() {} }; };
    const marker = reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button');
    reopened.click(marker); assert.equal(calls.length, 1); assert.equal(calls[0].frames[0].scale, '0.9');
    assert.equal(calls[0].node.getAttribute('role'), 'status');
    reopened.edit(reopened.doc.querySelector('h1'), 'Same effect');
    const nextSelect = reopened.shadow.querySelector('#pageon-note-animation');
    assert.equal(nextSelect.value, 'zoom');
    nextSelect.value = 'none'; nextSelect.dispatchEvent(new reopened.win.Event('change', { bubbles: true, composed: true }));
    const saved = new reopened.win.DOMParser().parseFromString(reopened.runtime.serialize().html, 'text/html');
    assert.equal(saved.querySelector('h1').hasAttribute('data-pageon-note-animation'), false);
  } finally { f.close(); reopened?.close(); }
});

for (const lang of ['en', 'zh']) test(`opt-in character runtime preserves uploaded images in saved HTML (${lang})`, async () => {
  const f = open(undefined, { lang, source: createRuntimeCode({ lang, noteCharacters: true, imageExport: false }) }); let reopened;
  const image = 'data:image/png;base64,aGVsbG8=';
  const changeSelect = (id, value) => { const select = f.shadow.querySelector(id); select.value = value; select.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true })); };
  try {
    const title = f.doc.querySelector('h1'); f.edit(title, 'A character speaks');
    assert.equal(title.dataset.pageonNoteAnimation, undefined, 'new notes default to free text');
    changeSelect('#pageon-note-animation', 'companion'); changeSelect('#pageon-note-character', 'frog');
    f.click(f.shadow.querySelector('.note-character-options button[aria-label$="#fa70ab"]'));
    assert.deepEqual(JSON.parse(title.getAttribute('data-pageon-note-character')), { id: 'frog', color: '#fa70ab', image: '' });
    changeSelect('#pageon-note-character', 'custom');
    f.win.FileReader = class { readAsDataURL() { this.result = image; this.onload(); } };
    f.win.Image = class { naturalWidth = 512; naturalHeight = 512; set src(value) { this.onload(); } };
    f.win.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    f.win.HTMLCanvasElement.prototype.toDataURL = () => image;
    const file = f.shadow.querySelector('#pageon-note-image'); Object.defineProperty(file, 'files', { value: [{ type: 'image/png', size: 100 }] });
    file.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true })); await Promise.resolve(); await Promise.resolve();
    assert.equal(JSON.parse(title.getAttribute('data-pageon-note-character')).image, image);
    const html = f.runtime.serialize().html; reopened = open(html);
    assert.deepEqual(reopened.errors, []);
    reopened.edit(reopened.doc.querySelector('h1'), 'Read offline');
    assert.equal(reopened.shadow.querySelector('#pageon-note-animation').value, 'companion');
    assert.equal(reopened.shadow.querySelector('#pageon-note-character').value, 'custom');
    assert.equal(reopened.shadow.querySelector('.note-character-row img').src, image);
    reopened.click(reopened.shadow.querySelector('.note-preview'));
    const notes = reopened.doc.querySelector('pageon-notes').shadowRoot;
    assert.equal(notes.querySelector('.note-character img').src, image); assert.equal(notes.querySelector('.tip').textContent, 'Read offline');
    reopened.click(reopened.shadow.querySelector('.note-delete'));
    assert.equal(reopened.doc.querySelector('h1').hasAttribute('data-pageon-note-character'), false);
  } finally { f.close(); reopened?.close(); }
});

test('a delayed image upload cannot overwrite a different selected note', async () => {
  const f = open(undefined, { source: createRuntimeCode({ noteCharacters: true, imageExport: false }) }); let reader;
  try {
    const title = f.doc.querySelector('h1'), other = f.doc.querySelector('p'); f.edit(title, 'First');
    const choose = (id, value) => { const select = f.shadow.querySelector(id); select.value = value; select.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true })); };
    choose('#pageon-note-animation', 'companion'); choose('#pageon-note-character', 'custom');
    f.win.FileReader = class { readAsDataURL() { reader = this; } };
    f.win.Image = class { naturalWidth = 64; naturalHeight = 64; set src(value) { this.onload(); } };
    f.win.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} }); f.win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,aGVsbG8=';
    const file = f.shadow.querySelector('#pageon-note-image'); Object.defineProperty(file, 'files', { value: [{ type: 'image/png', size: 100 }] });
    file.dispatchEvent(new f.win.Event('change', { bubbles: true, composed: true }));
    f.edit(other, 'Second'); reader.result = 'data:image/png;base64,aGVsbG8='; reader.onload(); await Promise.resolve(); await Promise.resolve();
    assert.equal(other.dataset.pageonNote, 'Second'); assert.equal(other.hasAttribute('data-pageon-note-character'), false);
    assert.equal(JSON.parse(title.dataset.pageonNoteCharacter).image, '');
  } finally { f.close(); }
});

test('standard offline document marker preference survives save and reopen without changing highlights', async () => {
  const f = open(); let reopened;
  try {
    f.edit(f.doc.querySelector('h1'), 'Text cue');
    const selector = f.shadow.querySelector('#pageon-note-markers');
    assert.equal(selector.value, 'auto');
    selector.value = 'edit'; selector.dispatchEvent(new f.win.Event('change', { bubbles: true }));
    assert.equal(f.doc.documentElement.dataset.pageonNoteMarkers, 'edit');
    const marker = f.doc.querySelector('pageon-notes').shadowRoot.querySelector('button');
    assert.equal(marker.hidden, false, 'editing always exposes notes');
    reopened = open(f.runtime.serialize().html);
    assert.deepEqual(reopened.errors, []);
    assert.equal(reopened.doc.documentElement.dataset.pageonNoteMarkers, 'edit');
    reopened.win.PageOnNotes.refresh();
    assert.equal(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button').hidden, true);
    reopened.edit(reopened.doc.querySelector('h1'), 'Text cue');
    await Promise.resolve();
    await new Promise(resolve => reopened.win.requestAnimationFrame(resolve));
    assert.equal(reopened.shadow.querySelector('#pageon-note-markers').value, 'edit');
    assert.equal(reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('button').hidden, false);
  } finally { f.close(); reopened?.close(); }
});

test('standard offline notes configure bubbles without characters and retain them after save/reopen', () => {
  const f = open(); let reopened;
  try {
    f.edit(f.doc.querySelector('h1'), 'Plain note');
    f.click(f.shadow.querySelector('button[aria-label="Bubble background color #02bb9f"]'));
    f.click(f.shadow.querySelector('button[aria-label="Bubble text color #a25aff"]'));
    for (const [label, percent] of [['Bubble background color', '50'], ['Bubble text color', '25']]) {
      const opacity = f.shadow.querySelector(`[aria-label="${label} opacity percent"]`);
      opacity.value = percent; opacity.dispatchEvent(new f.win.Event('input', { bubbles: true }));
    }
    const shape = f.shadow.querySelector('#pageon-note-bubble-shape');
    shape.value = 'square'; shape.dispatchEvent(new f.win.Event('change', { bubbles: true }));
    assert.equal(f.shadow.querySelector('#pageon-note-animation option[value=companion]'), null);
    reopened = open(f.runtime.serialize().html);
    assert.deepEqual(reopened.errors, []);
    const title = reopened.doc.querySelector('h1');
    assert.deepEqual(JSON.parse(title.dataset.pageonNoteBubble), { background: '#02bb9f80', color: '#a25aff40', shape: 'square' });
    reopened.edit(title, 'Still plain');
    assert.equal(reopened.shadow.querySelector('#pageon-note-bubble-shape').value, 'square');
    reopened.click(reopened.shadow.querySelector('.note-preview'));
    const tip = reopened.doc.querySelector('pageon-notes').shadowRoot.querySelector('.tip');
    assert.equal(tip.style.backgroundColor, 'rgba(2, 187, 159, 0.5)');
    assert.equal(tip.style.color, 'rgba(162, 90, 255, 0.25)');
    assert.equal(tip.style.borderRadius, '0px');
    reopened.click(reopened.shadow.querySelector('.note-delete'));
    assert.equal(title.hasAttribute('data-pageon-note-bubble'), false);
  } finally { f.close(); reopened?.close(); }
});
