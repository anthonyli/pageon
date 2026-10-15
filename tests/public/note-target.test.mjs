import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNoteTarget, recordNoteTarget } from '../../packages/runtime/src/note-target.js';
import { installNotes } from '../../packages/runtime/src/notes.js';

test('text selection across inline styles records highlighted selected text with inherited colors, one grouped note, and removes without changing original markup', () => {
  const dom = new JSDOM('<html><body><p data-artifact-edit="1" style="color:red">Before <em style="color:blue">bold words</em> after</p><p data-artifact-edit="2">Next</p></body></html>', { pretendToBeVisual: true });
  const doc = dom.window.document, p = doc.querySelector('p'), original = p.innerHTML, entries = new Map();
  const range = doc.createRange(); range.setStart(p.firstChild, 3); range.setEnd(p.lastChild, 3);
  doc.getSelection().addRange(range);
  const target = createNoteTarget(p);
  try {
    assert.equal(target.text, 'ore bold words af');
    doc.getSelection().removeAllRanges();
    assert.equal(recordNoteTarget(entries, target, 'Explain this'), true);
    const marks = [...doc.querySelectorAll('[data-pageon-note-range]')];
    assert.equal(marks.length, 3);
    assert.equal(new Set(marks.map(mark => mark.dataset.pageonNoteRange)).size, 1);
    assert.equal(marks.map(mark => mark.textContent).join(''), 'ore bold words af');
    for (const mark of marks) {
      assert.equal(mark.style.color, 'inherit');
      assert.equal(mark.style.backgroundColor, 'rgb(255, 204, 57)');
      assert.equal(mark.style.getPropertyPriority('color'), 'important');
    }
    assert.equal(p.style.color, 'red'); assert.equal(p.querySelector('em').style.color, 'blue');
    assert.equal(p.textContent, 'Before bold words after');
    assert.equal(entries.get('1').html, p.innerHTML);
    dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 30, top: 40, right: 200, bottom: 100, width: 170, height: 60 });
    const notes = installNotes(doc, dom.window);
    assert.equal(doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 1);
    const reopened = createNoteTarget(marks[1], { capture: false });
    assert.equal(reopened.read(), 'Explain this');
    recordNoteTarget(entries, reopened, 'Updated', undefined, undefined, '#02bb9f');
    assert.ok(marks.every(mark => mark.dataset.pageonNoteColor === '#02bb9f' && mark.style.backgroundColor === 'rgb(2, 187, 159)'));
    assert.equal(createNoteTarget(marks[2], { capture: false }).color, '#02bb9f');
    assert.equal(entries.get('1').html, p.innerHTML);
    recordNoteTarget(entries, reopened, 'Updated', undefined, undefined, 'red;position:fixed');
    assert.equal(reopened.color, '#ffcc39', 'invalid CSS is never persisted');
    assert.ok(marks.every(mark => mark.dataset.pageonNote === 'Updated'));
    recordNoteTarget(entries, reopened, 'Updated', undefined, undefined, '#02bb9f', '#fa70ab');
    assert.ok(marks.every(mark => mark.style.color === 'rgb(250, 112, 171)' && mark.dataset.pageonNoteTextColor === '#fa70ab'));
    assert.equal(createNoteTarget(marks[2], { capture: false }).textColor, '#fa70ab');
    recordNoteTarget(entries, reopened, 'Updated', undefined, undefined, '#02bb9f', '');
    assert.ok(marks.every(mark => mark.style.color === 'inherit' && !mark.hasAttribute('data-pageon-note-text-color')));
    assert.equal(marks[1].parentElement.style.color, 'blue', 'reset retains the individual original color');
    recordNoteTarget(entries, reopened, 'Updated', undefined, undefined, '#02bb9f', 'red;position:fixed');
    assert.equal(reopened.textColor, '', 'invalid foreground CSS falls back to the original');
    recordNoteTarget(entries, reopened, '');
    assert.equal(p.innerHTML, original);
    assert.equal(entries.get('1').html, original);
    notes.destroy();
  } finally { dom.window.close(); }
});

test('selection spanning elements records each owner and stale selected text is never annotated', () => {
  const dom = new JSDOM('<body><p data-artifact-edit="1">First</p><p data-artifact-edit="2">Second</p></body>');
  try {
    const doc = dom.window.document, [a, b] = doc.querySelectorAll('p'), entries = new Map();
    const range = doc.createRange(); range.setStart(a.firstChild, 1); range.setEnd(b.firstChild, 3); doc.getSelection().addRange(range);
    const target = createNoteTarget(b);
    assert.equal(recordNoteTarget(entries, target, 'Cross elements'), true);
    assert.deepEqual([...entries.keys()], ['1', '2']);
    assert.equal(a.querySelector('span').textContent, 'irst'); assert.equal(b.querySelector('span').textContent, 'Sec');
    recordNoteTarget(entries, target, '');
    const next = doc.createRange(); next.selectNodeContents(a); doc.getSelection().removeAllRanges(); doc.getSelection().addRange(next);
    const stale = createNoteTarget(a); a.textContent = 'Changed';
    assert.equal(stale.write('Wrong target'), null);
    assert.equal(doc.querySelector('[data-pageon-note]'), null);
  } finally { dom.window.close(); }
});

test('text annotation stays inline even when the page styles heading spans as blocks', () => {
  const dom = new JSDOM('<head><style>h1{font-size:74px;line-height:1.2}h1 span{display:block!important;width:100%!important;padding:20px;font-size:32px;position:relative}</style></head><body><h1 data-artifact-edit="1">桑木</h1></body>');
  try {
    const doc = dom.window.document, title = doc.querySelector('h1'), original = title.outerHTML;
    const range = doc.createRange(); range.setStart(title.firstChild, 1); range.setEnd(title.firstChild, 2); doc.getSelection().addRange(range);
    const target = createNoteTarget(title), entries = new Map();
    recordNoteTarget(entries, target, '名字');
    const mark = title.querySelector('[data-pageon-note-range]');
    assert.equal(mark.localName, 'span'); assert.equal(mark.textContent, '木');
    assert.equal(title.firstChild.textContent, '桑'); assert.equal(title.textContent, '桑木');
    assert.equal(dom.window.getComputedStyle(mark).display, 'inline');
    assert.equal(dom.window.getComputedStyle(mark).width, 'auto');
    assert.equal(dom.window.getComputedStyle(mark).padding, '0px');
    assert.equal(mark.style.fontSize, 'inherit');
    assert.equal(mark.style.getPropertyPriority('display'), 'important');
    assert.equal(mark.style.backgroundColor, 'rgb(255, 204, 57)');
    assert.equal(title.getAttribute('style'), null, 'annotation never changes the module styles');
    const reopened = new dom.window.DOMParser().parseFromString(title.outerHTML, 'text/html').querySelector('span');
    assert.equal(reopened.style.display, 'inline');
    recordNoteTarget(entries, target, '');
    assert.equal(title.outerHTML, original);
  } finally { dom.window.close(); }
});
