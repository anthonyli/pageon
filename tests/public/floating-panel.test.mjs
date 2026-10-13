import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createFloatingPanel } from '../../packages/ui/src/floating-panel.js';

test('note popup anchors to its button, fits narrow viewports and cannot be dragged', () => {
  const dom = new JSDOM('<body><button id="anchor"></button><section><button id="handle"></button></section></body>', { pretendToBeVisual: true });
  const win = dom.window, panel = win.document.querySelector('section'), handle = win.document.querySelector('#handle');
  const anchor = win.document.querySelector('#anchor');
  let resize;
  win.ResizeObserver = class { constructor(fn) { resize = fn; } observe() {} disconnect() {} };
  win.innerWidth = 360; win.innerHeight = 420;
  let anchorBox = { left: 280, right: 350, top: 390, bottom: 420 };
  anchor.getBoundingClientRect = () => anchorBox;
  let contentHeight = 280;
  panel.getBoundingClientRect = () => ({ width: parseFloat(panel.style.width) || 320, height: Math.min(contentHeight, parseFloat(panel.style.maxHeight) || contentHeight) });
  const api = createFloatingPanel({ panel, win, anchor });
  const bounded = (width, height, left = 0, top = 0) => {
    const rect = panel.getBoundingClientRect();
    assert.ok(parseFloat(panel.style.left) >= left + 8);
    assert.ok(parseFloat(panel.style.top) >= top + 8);
    assert.ok(parseFloat(panel.style.left) + rect.width <= left + width - 8);
    assert.ok(parseFloat(panel.style.top) + rect.height <= top + height - 8);
  };
  const pointer = (type, x, y) => handle.dispatchEvent(new win.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }));
  try {
    bounded(360, 420);
    const initial = { left: panel.style.left, top: panel.style.top };
    pointer('pointerdown', 20, 20); pointer('pointermove', -900, 900); pointer('pointerup', -900, 900);
    assert.deepEqual({ left: panel.style.left, top: panel.style.top }, initial);
    anchorBox = { left: 16, right: 48, top: 20, bottom: 52 };
    win.document.dispatchEvent(new win.Event('scroll'));
    assert.equal(panel.style.left, '16px'); assert.equal(panel.style.top, '60px');
    win.innerWidth = 280; win.innerHeight = 190; win.dispatchEvent(new win.Event('resize'));
    bounded(280, 190);
    contentHeight = 500; resize(); bounded(280, 190);
    win.visualViewport = new win.EventTarget();
    Object.assign(win.visualViewport, { width: 220, height: 160, offsetLeft: 30, offsetTop: 100 });
    api.refresh(); bounded(220, 160, 30, 100);
    handle.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    bounded(220, 160, 30, 100);
  } finally { api.destroy(); win.close(); }
});
