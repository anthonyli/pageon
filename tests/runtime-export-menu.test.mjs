import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createExportMenu } from '../packages/runtime/src/export-menu.js';

function fixture(top = 640, left = 940, mode = 'closed') {
  const dom = new JSDOM('<main></main><button id="outside">Outside</button>', { url: 'https://example.test' });
  const { window } = dom, { document } = window;
  const host = document.querySelector('main'), shadow = host.attachShadow({ mode });
  const parent = document.createElement('div'); shadow.append(parent);
  let copies = 0; const opened = [], actions = [];
  const menu = createExportMenu({ document, window, parent, label: '导出', onOpenChange: value => opened.push(value), items: [
    { label: '另存副本', action: () => { copies++; actions.push('copy'); } },
    { label: '导出图片', action: () => actions.push('image') }, { label: '导出 PDF', action: () => actions.push('pdf') },
  ] });
  menu.trigger.parentElement.getBoundingClientRect = () => ({ left, top, bottom: top + 36 });
  menu.panel.getBoundingClientRect = () => ({ width: 184, height: 130 });
  const key = (node, value, extra = {}) => node.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, composed: true, cancelable: true, ...extra }));
  return { dom, window, document, shadow, menu, opened, actions, key, copies: () => copies, dispose() { menu.destroy(); dom.window.close(); } };
}

for (const mode of ['closed', 'open']) test(`all export actions survive pointerdown inside a ${mode} shadow root`, () => {
  const app = fixture(640, 940, mode);
  try {
    for (const button of app.menu.buttons) {
      app.menu.trigger.click();
      button.dispatchEvent(new app.window.Event('pointerdown', { bubbles: true, composed: true }));
      assert.equal(app.menu.panel.hidden, false, 'the pressed item must remain visible until click');
      button.dispatchEvent(new app.window.MouseEvent('mousedown', { bubbles: true, composed: true }));
      button.dispatchEvent(new app.window.Event('pointerup', { bubbles: true, composed: true }));
      button.dispatchEvent(new app.window.MouseEvent('mouseup', { bubbles: true, composed: true }));
      button.click();
      assert.equal(app.menu.panel.hidden, true);
    }
    assert.deepEqual(app.actions, ['copy', 'image', 'pdf']);
    app.menu.trigger.click();
    const sibling = app.document.createElement('button'); app.shadow.append(sibling);
    sibling.dispatchEvent(new app.window.Event('pointerdown', { bubbles: true, composed: true }));
    assert.equal(app.menu.panel.hidden, true, 'another control in the toolbar closes the menu');
  } finally { app.dispose(); }
});

test('export menu opens above a bottom toolbar, clamps horizontally and supports keyboard selection', () => {
  const app = fixture();
  try {
    app.key(app.menu.trigger, 'ArrowDown');
    assert.equal(app.menu.trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(app.menu.panel.hidden, false);
    assert.equal(app.menu.panel.style.bottom, 'calc(100% + 8px)');
    assert.ok(parseFloat(app.menu.panel.style.left) < 0, 'right-edge menus stay within the viewport');
    assert.equal(app.shadow.activeElement, app.menu.buttons[0]);
    app.menu.buttons[1].disabled = true;
    app.key(app.menu.buttons[0], 'ArrowDown');
    assert.equal(app.shadow.activeElement, app.menu.buttons[2]);
    app.key(app.menu.buttons[2], 'Home');
    assert.equal(app.shadow.activeElement, app.menu.buttons[0]);
    app.menu.buttons[0].click();
    assert.equal(app.copies(), 1); assert.equal(app.menu.panel.hidden, true);
    assert.equal(app.shadow.activeElement, app.menu.trigger);
    assert.deepEqual(app.opened, [true, false]);
  } finally { app.dispose(); }
});

test('menus flip below top-edge toolbars and dismiss on Escape, Tab, outside press and resize', () => {
  const app = fixture(8, 20);
  try {
    app.menu.trigger.click();
    assert.equal(app.menu.panel.style.top, 'calc(100% + 8px)');
    app.key(app.menu.buttons[0], 'Escape');
    assert.equal(app.menu.panel.hidden, true); assert.equal(app.shadow.activeElement, app.menu.trigger);
    app.menu.trigger.click(); app.key(app.menu.buttons[0], 'Tab');
    assert.equal(app.menu.panel.hidden, true);
    app.menu.trigger.click(); app.document.getElementById('outside').dispatchEvent(new app.window.Event('pointerdown', { bubbles: true, composed: true }));
    assert.equal(app.menu.panel.hidden, true);
    app.menu.trigger.click(); app.window.dispatchEvent(new app.window.Event('resize'));
    assert.equal(app.menu.panel.hidden, true);
  } finally { app.dispose(); }
});
