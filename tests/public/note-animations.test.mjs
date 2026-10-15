import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNoteAnimations, NOTE_ANIMATIONS } from '../../packages/note-animations/src/index.js';
import { createNoteTarget, recordNoteTarget } from '../../packages/runtime/src/note-target.js';
import { applyNoteEntries, attachNotesRuntime, installNotes } from '../../packages/runtime/src/notes.js';

function recorder(win) {
  const calls = [];
  win.HTMLElement.prototype.animate = function (frames, options) {
    let finish, reject;
    const call = { element: this, frames, options, cancelled: false,
      finished: new Promise((resolve, fail) => { finish = resolve; reject = fail; }),
      cancel() { this.cancelled = true; reject(new Error('cancelled')); }, finish() { finish(); } };
    calls.push(call); return call;
  };
  win.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 20, right: 220, top: 20, bottom: 120, width: 200, height: 100 });
  return calls;
}

test('registry supports extension, repeat playback, cancellation, reduced motion and safe fallback', async () => {
  const dom = new JSDOM('<div style="transform:translateX(-50%)">Card</div>');
  try {
    const player = createNoteAnimations(), node = dom.window.document.querySelector('div'), calls = recorder(dom.window);
    assert.deepEqual(NOTE_ANIMATIONS.map(e => e.id), ['none', 'fade', 'fly', 'zoom', 'companion']);
    assert.equal(player.play(node, 'unknown'), null);
    assert.equal(player.play(node, undefined), null);
    player.play(node, 'fly'); player.play(node, 'zoom');
    assert.equal(calls[0].cancelled, true); assert.equal(calls[1].cancelled, false);
    assert.equal(node.style.transform, 'translateX(-50%)');
    assert.equal(calls[0].frames[0].translate, '0 24px');
    assert.equal(calls[1].frames[0].scale, '0.9');
    assert.ok(calls.every(c => c.options.duration < 300 && c.options.fill === 'none'));
    // Finishing an older animation must not release the new animation.
    await Promise.resolve(); player.cancel(node); assert.equal(calls[1].cancelled, true);
    player.cancel(node);
    dom.window.matchMedia = () => ({ matches: true });
    assert.equal(player.play(node, 'fade'), null); assert.equal(calls.length, 2);
    dom.window.matchMedia = () => ({ matches: false });
    player.register({ id: 'custom', label: { zh: '自定义', en: 'Custom' }, duration: 100, keyframes: [{ opacity: 0 }, { opacity: 1 }] });
    assert.equal(player.normalize('custom'), 'custom');
    assert.throws(() => player.register(NOTE_ANIMATIONS[0]), /invalid-note-animation/);
    assert.equal(createNoteAnimations().normalize('custom'), 'none', 'registries are isolated');
    player.play(node, 'custom'); calls.at(-1).finish(); await Promise.resolve(); player.cancel(node);
    assert.equal(calls.at(-1).cancelled, false);
    node.animate = undefined; assert.equal(player.play(node, 'fade'), null);
    node.animate = () => { throw new Error('unsupported'); }; assert.equal(player.play(node, 'fade'), null);
  } finally { dom.window.close(); }
});

test('element animation patches survive replay, none overrides original config, and deletion removes metadata', () => {
  const dom = new JSDOM('<p data-artifact-edit="1" data-pageon-note="Text" data-pageon-note-animation="fly">Body</p>');
  try {
    const doc = dom.window.document, node = doc.querySelector('p'), target = createNoteTarget(node), entries = new Map();
    assert.equal(recordNoteTarget(entries, target, 'Text', 'none'), true);
    assert.deepEqual(entries.get('1'), { note: 'Text', noteAnimation: 'none' });
    node.setAttribute('data-pageon-note-animation', 'fly');
    applyNoteEntries(doc, entries, () => node);
    assert.equal(node.hasAttribute('data-pageon-note-animation'), false);
    recordNoteTarget(entries, target, 'Text', 'zoom'); recordNoteTarget(entries, target, 'Edited');
    assert.equal(target.animation, 'zoom');
    recordNoteTarget(entries, target, '');
    assert.equal(node.hasAttribute('data-pageon-note-animation'), false);
    assert.equal(node.textContent, 'Body');
  } finally { dom.window.close(); }
});

test('range animation-only edits update every span without changing selected text or layout', () => {
  const dom = new JSDOM('<p data-artifact-edit="1">Before <b>bold</b> after</p>');
  try {
    const doc = dom.window.document, p = doc.querySelector('p'), original = p.innerHTML, entries = new Map();
    const range = doc.createRange(); range.setStart(p.firstChild, 2); range.setEnd(p.lastChild, 3); doc.getSelection().addRange(range);
    const target = createNoteTarget(p); recordNoteTarget(entries, target, 'Cue', 'fly');
    const spans = [...p.querySelectorAll('span')], styles = spans.map(n => n.getAttribute('style'));
    assert.ok(spans.every(n => n.dataset.pageonNoteAnimation === 'fly'));
    recordNoteTarget(entries, target, 'Cue', 'zoom');
    assert.ok(spans.every(n => n.dataset.pageonNoteAnimation === 'zoom'));
    assert.deepEqual(spans.map(n => n.getAttribute('style')), styles);
    assert.match(entries.get('1').html, /data-pageon-note-animation="zoom"/);
    recordNoteTarget(entries, target, ''); assert.equal(p.innerHTML, original);
  } finally { dom.window.close(); }
});

const deck = '<html><head></head><body><section class="slide active"><p data-pageon-note="One" data-pageon-note-animation="fly">First</p><p data-pageon-note="Two" data-pageon-note-animation="zoom">Second</p></section><section class="slide" hidden>Next</section></body></html>';
test('playback cancels on replacement, page change, blur and destruction; long press does not restart', () => {
  const dom = new JSDOM(deck, { pretendToBeVisual: true });
  const win = dom.window, doc = win.document, calls = recorder(win), api = installNotes(doc, win);
  const key = (type, repeat = false) => doc.body.dispatchEvent(new win.KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true, repeat }));
  try {
    key('keydown'); key('keydown', true); assert.equal(calls.length, 1);
    key('keyup'); key('keydown'); key('keyup'); assert.equal(calls[0].cancelled, true); assert.equal(calls.length, 2);
    const [a, b] = doc.querySelectorAll('section'); a.hidden = true; a.classList.remove('active'); b.hidden = false; b.classList.add('active'); api.refresh();
    assert.equal(calls[1].cancelled, true);
    a.hidden = false; a.classList.add('active'); b.hidden = true; b.classList.remove('active'); api.refresh();
    key('keydown'); key('keyup'); assert.equal(calls.length, 3);
    win.dispatchEvent(new win.Event('blur')); assert.equal(calls[2].cancelled, true);
    doc.querySelector('pageon-notes').shadowRoot.querySelector('button').click();
    api.destroy(); assert.equal(calls[3].cancelled, true);
  } finally { api.destroy(); win.close(); }
});

test('exported early script carries the player offline, including notes=off and reduced motion', async () => {
  const parser = new JSDOM(deck); attachNotesRuntime(parser.window.document);
  const html = parser.window.document.documentElement.outerHTML;
  for (const reduced of [false, true]) {
    let calls;
    const dom = new JSDOM(html, { url: 'file:///deck.html?pageon-notes=off#slide-1', runScripts: 'dangerously', pretendToBeVisual: true,
      beforeParse(win) { calls = recorder(win); win.matchMedia = () => ({ matches: reduced }); } });
    try {
      await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
      const doc = dom.window.document;
      doc.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      const root = doc.querySelector('pageon-notes').shadowRoot;
      assert.equal(root.querySelectorAll('button').length, 0);
      assert.equal(root.querySelector('[role=status]').textContent, 'One');
      assert.equal(calls.length, reduced ? 0 : 1);
    } finally { dom.window.PageOnNotes?.destroy(); dom.window.close(); }
  }
  parser.window.close();
});
