import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNoteAnimations } from '../../packages/note-animations/src/index.js';
import { createNoteTarget, recordNoteTarget } from '../../packages/runtime/src/note-target.js';
import { installNotes, attachNotesRuntime, applyNoteEntries } from '../../packages/runtime/src/notes.js';

const image = 'data:image/png;base64,aGVsbG8=';
const config = JSON.stringify({ id: 'custom', color: '#f66bb1', image });

test('character assets are embedded, normalized and safe for untrusted HTML attributes', () => {
  const player = createNoteAnimations();
  assert.equal(player.normalizeCharacter('{broken').id, 'dot');
  for (const raw of ['https://example.com/pet.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)']) {
    assert.equal(player.normalizeCharacter({ id: 'custom', image: raw }).image, '');
  }
  assert.equal(player.characterImage(config), image);
  for (const { id, defaultColor } of player.characters) {
    const svg = decodeURIComponent(player.characterImage({ id, color: '"><script>alert(1)</script>' }));
    assert.match(svg, /^data:image\/svg\+xml/); assert.doesNotMatch(svg, /<script/); assert.ok(svg.includes(defaultColor));
  }
  assert.deepEqual(player.characters[0], { id: 'dot', defaultColor: '#4678ff', label: { zh: '圆圈', en: 'Circle' } });
  const ring = decodeURIComponent(player.characterImage({ id: 'dot' }));
  assert.match(ring, /fill-rule="evenodd"/);
  assert.doesNotMatch(ring, /#172126/);
  const embedded = new Function(`return (${createNoteAnimations.toString()})()` )();
  assert.equal(embedded.characterImage(config), image, 'exported factory has no external dependencies');
});

test('character and bubble fit corners, offscreen anchors, small windows and shifted visual viewports', () => {
  const player = createNoteAnimations();
  for (const [width, height] of [[1440, 900], [375, 667], [240, 320], [80, 100], [320, 110]]) {
    const viewport = { width, height, left: 23, top: 50 };
    for (const [left, top] of [[0, 0], [width, 0], [0, height], [width, height], [-1000, -1000], [4000, 4000]]) {
      const placed = player.layout({ viewport, anchor: { left, right: left + 60, bottom: top + 20 }, bubbleHeight: 4000, bubbleWidth: 1200 });
      for (const rect of [placed.bubble, { ...placed.actor, width: placed.actor.size, height: placed.actor.size }]) {
        assert.ok(rect.x >= viewport.left && rect.y >= viewport.top);
        assert.ok(rect.x + rect.width <= viewport.left + width + .001);
        assert.ok(rect.y + rect.height <= viewport.top + height + .001);
      }
      const a = placed.actor, b = placed.bubble;
      assert.ok(a.x + a.size <= b.x || b.x + b.width <= a.x || a.y + a.size <= b.y || b.y + b.height <= a.y, 'text never covers character');
    }
  }
});

function fixture() {
  const dom = new JSDOM('<html><body><p data-pageon-note="Hello" data-pageon-note-animation="companion">Text</p><p data-pageon-note="Next" data-pageon-note-animation="companion">Next</p></body></html>', { pretendToBeVisual: true });
  const win = dom.window, doc = win.document, calls = [], timers = new Map(); let timerId = 0;
  win.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
  win.clearTimeout = id => timers.delete(id);
  win.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 300, right: 420, top: 300, bottom: 360, width: 120, height: 60 });
  win.HTMLElement.prototype.animate = function(frames, options) {
    let resolve, reject;
    const motion = { element: this, frames, options, cancelled: false, finished: new Promise((yes, no) => { resolve = yes; reject = no; }), finish: () => resolve(), cancel() { this.cancelled = true; reject(new Error('cancel')); } };
    calls.push(motion); return motion;
  };
  const api = installNotes(doc, win), root = doc.querySelector('pageon-notes').shadowRoot;
  return { win, doc, calls, timers, api, root, preview(node = doc.querySelector('p')) { doc.dispatchEvent(new win.CustomEvent('pageon:note-preview', { detail: { node } })); }, close() { api.destroy(); win.close(); } };
}

test('random movement stays inside viewport and reading time begins only after landing', async () => {
  const f = fixture();
  try {
    f.preview(); const tip = f.root.querySelector('.tip'), actor = f.root.querySelector('.note-character');
    assert.ok(actor); assert.equal(tip.style.visibility, 'hidden');
    assert.ok(![...f.timers.values()].some(t => t.delay === 2000));
    for (const frame of f.calls[0].frames) {
      const [dx, dy] = frame.transform.match(/-?[\d.]+/g).map(Number);
      const x = parseFloat(actor.style.left) + dx, y = parseFloat(actor.style.top) + dy;
      assert.ok(x >= 0 && y >= 0 && x + parseFloat(actor.style.width) <= f.win.innerWidth + .001 && y + parseFloat(actor.style.height) <= f.win.innerHeight + .001);
    }
    f.calls[0].finish(); await Promise.resolve();
    assert.equal(tip.style.visibility, ''); assert.equal(tip.textContent, 'Hello');
    const timer = [...f.timers.values()].find(t => t.delay === 2000); assert.ok(timer); timer.fn();
    assert.equal(tip.hidden, true); assert.equal(f.root.querySelector('.note-character'), null);
  } finally { f.close(); }
});

test('consecutive characters land well inside the viewport and apart even with repeated random values', async () => {
  const f = fixture(), originalRandom = f.win.Math.random;
  try {
    f.win.Math.random = () => .5;
    const points = [];
    for (let index = 0; index < 6; index++) {
      // Closely adjacent targets must not force closely adjacent destinations.
      f.preview(f.doc.querySelectorAll('p')[index % 2]);
      const actor = f.root.querySelector('.note-character'), tip = f.root.querySelector('.tip');
      const point = { x: parseFloat(actor.style.left), y: parseFloat(actor.style.top) };
      points.push(point);
      for (const [x, y, width, height] of [
        [point.x, point.y, parseFloat(actor.style.width), parseFloat(actor.style.height)],
        [parseFloat(tip.style.left), parseFloat(tip.style.top), 120, 60],
      ]) {
        assert.ok(x >= 60 && y >= 60, 'visible breathing room on the top and left');
        assert.ok(x + width <= f.win.innerWidth - 60 && y + height <= f.win.innerHeight - 60, 'visible breathing room on the bottom and right');
      }
      if (index) assert.ok(Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) >= 200, 'successive destinations are separated');
      f.calls.at(-2).finish(); await Promise.resolve();
      f.win.dispatchEvent(new f.win.Event('scroll'));
      assert.equal(parseFloat(actor.style.left), point.x, 'settling and scrolling do not resample the destination');
      assert.equal(parseFloat(actor.style.top), point.y);
    }
    Object.defineProperty(f.win, 'visualViewport', { value: { width: 240, height: 320, offsetLeft: 23, offsetTop: 50 } });
    f.win.dispatchEvent(new f.win.Event('resize'));
    const actor = f.root.querySelector('.note-character');
    assert.ok(parseFloat(actor.style.left) >= 23 && parseFloat(actor.style.top) >= 50);
    assert.ok(parseFloat(actor.style.left) + parseFloat(actor.style.width) <= 263);
    assert.ok(parseFloat(actor.style.top) + parseFloat(actor.style.height) <= 370);
    assert.equal(f.root.querySelector('.tip').style.visibility, '');
  } finally { f.win.Math.random = originalRandom; f.close(); }
});

test('replacement, resize, blur, reduced motion and destroy never leave stale characters or timers', async () => {
  const f = fixture();
  try {
    f.preview(); const old = f.calls[0]; f.preview(f.doc.querySelectorAll('p')[1]);
    assert.equal(old.cancelled, true); old.finish(); await Promise.resolve();
    assert.equal(f.root.querySelectorAll('.note-character').length, 1);
    assert.equal(f.root.querySelector('.tip').style.visibility, 'hidden');
    f.win.dispatchEvent(new f.win.Event('resize')); await Promise.resolve();
    assert.equal(f.root.querySelector('.tip').style.visibility, '');
    assert.equal([...f.timers.values()].filter(t => t.delay === 2000).length, 1);
    f.win.dispatchEvent(new f.win.Event('blur')); assert.equal(f.root.querySelector('.note-character'), null); assert.equal(f.timers.size, 0);
    f.win.matchMedia = () => ({ matches: true }); const count = f.calls.length;
    f.preview(); assert.equal(f.calls.length, count); assert.equal(f.root.querySelector('.tip').style.visibility, '');
    f.api.destroy(); assert.equal(f.timers.size, 0);
  } finally { f.close(); }
});

test('element and range character configuration survives patches, reopen and deletion', () => {
  const dom = new JSDOM('<p data-artifact-edit="1">First <b>second</b></p>');
  try {
    const doc = dom.window.document, node = doc.querySelector('p'), entries = new Map(), target = createNoteTarget(node);
    recordNoteTarget(entries, target, 'Cue', 'companion', config);
    assert.equal(entries.get('1').noteCharacter, config);
    node.removeAttribute('data-pageon-note-character'); applyNoteEntries(doc, entries, () => node);
    assert.equal(createNoteTarget(node).character, config);
    target.write('Changed'); assert.equal(target.character, config);
    recordNoteTarget(entries, target, ''); assert.equal(entries.get('1').noteCharacter, ''); assert.equal(node.hasAttribute('data-pageon-note-character'), false);
    const range = doc.createRange(); range.selectNodeContents(node); doc.getSelection().addRange(range);
    const inline = createNoteTarget(node); recordNoteTarget(entries, inline, 'Inline', 'companion', config);
    assert.ok([...node.querySelectorAll('[data-pageon-note-range]')].every(n => n.getAttribute('data-pageon-note-character') === config));
    assert.equal(createNoteTarget(node.querySelector('span'), { capture: false }).character, config);
    inline.write(''); assert.equal(node.innerHTML, 'First <b>second</b>');
  } finally { dom.window.close(); }
});

test('image upload validates type and size, downsizes and preserves transparent PNG output', async () => {
  const player = createNoteAnimations(), dimensions = [];
  const doc = { defaultView: {
    FileReader: class { readAsDataURL() { this.result = image; this.onload(); } },
    Image: class { naturalWidth = 1024; naturalHeight = 512; set src(value) { this.onload(); } },
  }, createElement() { return { getContext() { return { drawImage(img, x, y, width, height) { dimensions.push([width, height]); } }; }, toDataURL(type) { assert.equal(type, 'image/png'); return image; } }; } };
  await assert.rejects(player.readImage({ type: 'image/svg+xml', size: 10 }, doc), /character-image-type/);
  await assert.rejects(player.readImage({ type: 'image/png', size: 3 * 1024 * 1024 }, doc), /character-image-size/);
  assert.equal(await player.readImage({ type: 'image/png', size: 100 }, doc), image);
  assert.deepEqual(dimensions, [[256, 128]]);
});

test('standalone early script renders configured character without network access', async () => {
  const parser = new JSDOM('<html><head></head><body><p data-pageon-note="Offline" data-pageon-note-animation="companion">Text</p></body></html>');
  parser.window.document.querySelector('p').setAttribute('data-pageon-note-character', config); attachNotesRuntime(parser.window.document);
  const dom = new JSDOM(parser.serialize(), { url: 'file:///notes.html', runScripts: 'dangerously', pretendToBeVisual: true });
  try {
    await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
    const doc = dom.window.document;
    doc.dispatchEvent(new dom.window.CustomEvent('pageon:note-preview', { detail: { node: doc.querySelector('p') } }));
    const root = doc.querySelector('pageon-notes').shadowRoot;
    assert.equal(root.querySelector('.note-character img').src, image);
    assert.equal(root.querySelector('.tip').textContent, 'Offline');
  } finally { dom.window.PageOnNotes?.destroy(); dom.window.close(); parser.window.close(); }
});

test('the same exported HTML samples fresh bounded paths on every replay and reopen', () => {
  const parser = new JSDOM('<html><head></head><body><p data-pageon-note="Random route" data-pageon-note-animation="companion">Text</p></body></html>');
  attachNotesRuntime(parser.window.document); const html = parser.serialize(); parser.window.close();
  const routes = [];
  for (const seed of [17, 83]) {
    const moves = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) {
      win.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 100, right: 220, top: 40, bottom: 100, width: 120, height: 60 });
      win.HTMLElement.prototype.animate = function(frames, options) { if (this.className === 'note-character') moves.push({ frames, options, node: this }); return { cancel() {} }; };
    } });
    try {
      const win = dom.window, doc = win.document; let state = seed;
      for (const [width, height] of [[1024, 768], [320, 180], [100, 100]]) {
        Object.defineProperty(win, 'innerWidth', { configurable: true, value: width });
        Object.defineProperty(win, 'innerHeight', { configurable: true, value: height });
        for (const mode of [0, 1, 2]) {
          const replays = [], destinations = [];
          for (let replay = 0; replay < 2; replay++) {
            let first = true;
            win.Math.random = () => {
              if (first) { first = false; return (mode + .1) / 3; }
              state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296;
            };
            doc.dispatchEvent(new win.CustomEvent('pageon:note-preview', { detail: { node: doc.querySelector('p') } }));
            const { frames, options, node } = moves.at(-1);
            const end = { x: parseFloat(node.style.left), y: parseFloat(node.style.top) };
            if (width === 1024) {
              assert.ok(end.x >= 60 && end.y >= 60, 'offline landing stays away from viewport edges');
              if (destinations.length) assert.ok(Math.hypot(end.x - destinations[0].x, end.y - destinations[0].y) >= 200, 'offline replay chooses a separated destination');
            }
            destinations.push(end);
            assert.equal(node.dataset.motion, ['hop', 'roll', 'glide'][mode]);
            assert.ok(options.duration >= 850 && options.duration <= 1250);
            for (const frame of frames) {
              const [dx, dy] = frame.transform.match(/translate\(([-\d.e+]+)px,([-\d.e+]+)px\)/).slice(1).map(Number);
              const x = parseFloat(node.style.left) + dx, y = parseFloat(node.style.top) + dy;
              assert.ok(x >= 0 && y >= 0);
              assert.ok(x + parseFloat(node.style.width) <= width + .001 && y + parseFloat(node.style.height) <= height + .001);
            }
            assert.equal(frames.at(-1).transform, 'translate(0px,0px)');
            replays.push(JSON.stringify(frames));
          }
          assert.notEqual(replays[0], replays[1], 'even the same motion type takes a fresh route');
          routes.push(replays[0]);
        }
      }
    } finally { dom.window.PageOnNotes?.destroy(); dom.window.close(); }
  }
  assert.notDeepEqual(routes.slice(0, 9), routes.slice(9), 'reopening identical saved HTML generates fresh routes');
});
