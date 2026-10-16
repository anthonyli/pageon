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


test('role defaults, manual colors and saved custom images survive factory serialization', () => {
  const online = createNoteAnimations();
  const offline = new Function('return (' + createNoteAnimations.toString() + ')()')();
  const ids = ['dot', 'blob', 'spark', 'frog', 'bunny', 'heart', 'monocle', 'diamond', 'glasses', 'headphones', 'thinking', 'custom'];
  assert.deepEqual(online.characters.map(item => item.id), ids);
  const images = new Set();
  for (const role of online.characters) {
    for (const api of [online, offline]) {
      const selected = api.selectCharacter({ id: 'frog', color: '#123456', image: 'data:image/png;base64,aGVsbG8=' }, role.id);
      assert.equal(selected.color, role.defaultColor);
      assert.equal(selected.image, 'data:image/png;base64,aGVsbG8=');
      const saved = JSON.stringify({ ...selected, color: '#123456' });
      assert.equal(api.normalizeCharacter(saved).color, '#123456');
      assert.equal(api.normalizeCharacter({ id: role.id }).color, role.defaultColor);
      assert.equal(api.characterImage(saved), online.characterImage(saved));
    }
    if (role.id !== 'custom') images.add(online.characterImage({ id: role.id }));
  }
  assert.equal(images.size, ids.length - 1);
  assert.match(decodeURIComponent(online.characterImage({ id: 'dot' })), /fill-rule="evenodd"/);
});

test('bubble settings are bounded, safe, and independent from range highlight colors', () => {
  const api = createNoteAnimations();
  assert.deepEqual(api.normalizeBubble('{broken'), { background: '#ffffff', color: '#182022', shape: 'rounded' });
  assert.deepEqual(api.normalizeBubble({ background: 'url(https://bad.test)', color: 'red;position:fixed', shape: '<script>' }), api.normalizeBubble(null));
  const dom = new JSDOM('<p data-artifact-edit="1">Before <b>bold</b> after</p>');
  try {
    const doc = dom.window.document, p = doc.querySelector('p'), range = doc.createRange(), entries = new Map();
    range.selectNodeContents(p); doc.getSelection().addRange(range);
    const target = createNoteTarget(p);
    const bubble = JSON.stringify({ background: '#02bb9f', color: '#a25aff', shape: 'speech' });
    recordNoteTarget(entries, target, 'Cue', 'none', '', '#ffcc39', '#123456', bubble);
    const spans = [...p.querySelectorAll('[data-pageon-note-range]')];
    assert.ok(spans.length > 1);
    for (const span of spans) {
      assert.equal(span.dataset.pageonNoteBubble, bubble);
      assert.equal(span.style.backgroundColor, 'rgb(255, 204, 57)');
      assert.equal(span.style.color, 'rgb(18, 52, 86)');
    }
    assert.ok(entries.get('1').html.includes('data-pageon-note-bubble'));
    assert.equal(createNoteTarget(spans[0], { capture: false }).bubble, bubble);
    recordNoteTarget(entries, target, 'Updated'); assert.equal(target.bubble, bubble);
    recordNoteTarget(entries, target, ''); assert.equal(p.querySelector('[data-pageon-note-bubble]'), null);
  } finally { dom.window.close(); }
});

test('every built-in role default belongs to the shared palette, while saved custom colors remain valid', async () => {
  const { DEFAULT_COLORS } = await import('../../packages/ui/src/color-palette.js');
  const api = createNoteAnimations();
  assert.equal(api.normalizeCharacter({ id: 'blob', color: '#3989ed' }).color, '#4678ff');
  assert.equal(api.normalizeCharacter({ id: 'frog', color: '#b9dd58' }).color, '#b6d80d');
  for (const role of api.characters) {
    assert.ok(DEFAULT_COLORS.includes(role.defaultColor), role.id);
    assert.equal(api.normalizeCharacter({ id: role.id }).color, role.defaultColor);
    assert.equal(api.normalizeCharacter({ id: role.id, color: '#123456' }).color, '#123456');
  }
});

test('range, avatar and bubble colors preserve alpha through serialization and safe normalization', () => {
  const dom = new JSDOM('<p data-artifact-edit="1">Selected text</p>');
  try {
    const doc = dom.window.document, node = doc.querySelector('p'), range = doc.createRange();
    range.selectNodeContents(node); doc.getSelection().addRange(range);
    const target = createNoteTarget(node), entries = new Map();
    const character = JSON.stringify({ id: 'frog', color: '#b6d80d80' });
    const bubble = JSON.stringify({ background: '#ffffff00', color: '#18202280', shape: 'rounded' });
    recordNoteTarget(entries, target, 'Cue', 'companion', character, '#ffcc3980', '#12345640', bubble);
    const saved = new JSDOM(node.outerHTML);
    try {
      const mark = saved.window.document.querySelector('[data-pageon-note-range]');
      const reopened = createNoteTarget(mark, { capture: false });
      assert.equal(reopened.color, '#ffcc3980'); assert.equal(reopened.textColor, '#12345640');
      assert.equal(reopened.bubble, bubble);
      const api = createNoteAnimations();
      assert.equal(api.normalizeCharacter(reopened.character).color, '#b6d80d80');
      assert.match(decodeURIComponent(api.characterImage(reopened.character)), /#b6d80d80/);
      assert.equal(api.normalizeBubble(reopened.bubble).background, '#ffffff00');
      assert.equal(api.normalizeBubble({ background: '#1234567' }).background, '#ffffff');
    } finally { saved.window.close(); }
  } finally { dom.window.close(); }
});
