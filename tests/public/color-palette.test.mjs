import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createColorPalette, DEFAULT_COLORS } from '../../packages/ui/src/color-palette.js';

test('shared presets keep separate values, reflect external updates and honor disabled state', () => {
  const dom = new JSDOM('<body><div id="note"></div><div id="character"></div></body>');
  try {
    const doc = dom.window.document, changes = [];
    const note = createColorPalette(doc.querySelector('#note'), { label: 'Note color', value: '#02B1FF', onChange: color => changes.push(color) });
    const character = createColorPalette(doc.querySelector('#character'), { label: 'Character color', value: '#fa70ab' });
    assert.equal(note.root.querySelectorAll('button').length, 10);
    assert.equal(note.root.querySelector('[aria-pressed=true]').getAttribute('aria-label'), 'Note color #02b1ff');
    note.root.querySelector('[aria-label="Note color #a25aff"]').click();
    assert.deepEqual(changes, ['#a25aff']);
    assert.equal(character.root.querySelector('[aria-pressed=true]').getAttribute('aria-label'), 'Character color #fa70ab');
    note.update({ disabled: true, value: '#123456' });
    assert.equal(note.root.querySelector('[aria-pressed=true]'), null, 'custom colors are not silently replaced by a preset');
    note.root.querySelector('button').click();
    assert.equal(changes.length, 1);
    note.update({ disabled: false, value: '#ffcc39' });
    assert.equal(note.root.querySelector('[aria-pressed=true]').getAttribute('aria-label'), 'Note color #ffcc39');
    note.destroy(); character.destroy(); assert.equal(doc.querySelectorAll('button').length, 0);
  } finally { dom.window.close(); }
});

test('the offline palette factory runs with explicitly serialized colors and no module imports', () => {
  const dom = new JSDOM('<body><div></div></body>');
  try {
    const factory = new Function(`return (${createColorPalette.toString()})`)();
    const palette = factory(dom.window.document.querySelector('div'), { colors: JSON.parse(JSON.stringify(DEFAULT_COLORS)), label: '批注颜色', value: '#4678ff' });
    assert.equal(palette.root.querySelectorAll('button').length, 10);
    assert.equal(palette.root.querySelector('[aria-pressed=true]').getAttribute('aria-label'), '批注颜色 #4678ff');
  } finally { dom.window.close(); }
});


test('compact shared palettes expand one at a time and commit custom colors safely', () => {
  const dom = new JSDOM('<body><div id="one"></div><div id="two"></div></body>');
  const doc = dom.window.document, changes = [];
  let first;
  try {
    first = createColorPalette(doc.querySelector('#one'), { compact: true, label: 'Note color', value: '#ffcc39', onChange: value => { changes.push(value); first.update({ value }); } });
    const second = createColorPalette(doc.querySelector('#two'), { compact: true, label: 'Character color', value: '#fa70ab' });
    const trigger = first.root.querySelector('.palette-trigger'), options = first.root.querySelector('.palette-options');
    assert.equal(options.hidden, true);
    trigger.click(); assert.equal(options.hidden, false);
    second.root.querySelector('.palette-trigger').click();
    assert.equal(options.hidden, true); assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    trigger.click();
    const hex = first.root.querySelector('.palette-hex'); hex.value = '12ABef';
    hex.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.deepEqual(changes, ['#12abef']); assert.equal(options.hidden, true);
    assert.equal(hex.value, '#12abef');
    trigger.click(); hex.value = 'invalid'; hex.dispatchEvent(new dom.window.Event('change'));
    assert.equal(hex.value, '#12abef'); assert.equal(changes.length, 1);
    const native = first.root.querySelector('input[type=color]'); native.value = '#ffffff';
    native.dispatchEvent(new dom.window.Event('input'));
    assert.equal(changes.at(-1), '#ffffff');
    first.update({ disabled: true });
    native.value = '#000000'; native.dispatchEvent(new dom.window.Event('input'));
    assert.equal(changes.at(-1), '#ffffff'); assert.equal(options.hidden, true);
    first.destroy(); second.destroy();
  } finally { dom.window.close(); }
});

test('shared picker preserves alpha through presets, HEX edits, transparent endpoints and serialization', () => {
  const dom = new JSDOM('<body><div></div></body>');
  try {
    const changes = [], factory = new Function(`return (${createColorPalette.toString()})`)();
    const control = factory(dom.window.document.querySelector('div'), { colors: DEFAULT_COLORS, compact: true, label: 'Bubble', value: '#12345680', onChange: value => changes.push(value) });
    const alpha = control.root.querySelector('input[type=range]'), percent = control.root.querySelector('input[type=number]');
    assert.equal(percent.value, '50');
    control.root.querySelector('[aria-label="Bubble #02bb9f"]').click(); assert.equal(changes.at(-1), '#02bb9f80');
    const hex = control.root.querySelector('.palette-hex'); hex.value = '#abcdef'; hex.dispatchEvent(new dom.window.Event('change'));
    assert.equal(changes.at(-1), '#abcdef80');
    percent.value = '0'; percent.dispatchEvent(new dom.window.Event('input')); assert.equal(changes.at(-1), '#abcdef00');
    assert.equal(alpha.value, '0');
    percent.value = ''; percent.dispatchEvent(new dom.window.Event('change')); assert.equal(percent.value, '0');
    percent.value = '101'; percent.dispatchEvent(new dom.window.Event('change')); assert.equal(percent.value, '0');
    alpha.value = '100'; alpha.dispatchEvent(new dom.window.Event('input')); assert.equal(changes.at(-1), '#abcdef');
    hex.value = '#12345640'; hex.dispatchEvent(new dom.window.Event('change')); assert.equal(percent.value, '25');
    control.update({ disabled: true }); percent.value = '75'; percent.dispatchEvent(new dom.window.Event('input'));
    assert.equal(changes.at(-1), '#12345640');
    control.destroy();
  } finally { dom.window.close(); }
});
