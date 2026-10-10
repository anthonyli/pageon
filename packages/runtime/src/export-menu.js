/** Shared menu for the dependency-free and advanced offline runtimes. */
export function createExportMenu({ document: doc, window: win, parent, before = null, label, items, onOpenChange = () => {} }) {
  const wrap = doc.createElement('span'); wrap.className = 'export-control';
  const trigger = doc.createElement('button'); trigger.type = 'button'; trigger.className = 'export-trigger';
  trigger.textContent = label; trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-expanded', 'false');
  const chevron = doc.createElement('span'); chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'; trigger.append(chevron);
  const panel = doc.createElement('div'); panel.className = 'export-menu'; panel.hidden = true;
  panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', label);
  wrap.append(trigger, panel); parent.insertBefore(wrap, before);
  const root = wrap.getRootNode();
  const cleanups = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const close = (focus = false) => {
    if (panel.hidden) return;
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); onOpenChange(false);
    if (focus) trigger.focus({ preventScroll: true });
  };
  const buttons = items.map(item => {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = item.label;
    node.setAttribute('role', 'menuitem'); node.tabIndex = -1;
    if (item.separator) node.className = 'menu-separator';
    listen(node, 'click', () => { close(true); item.action(); }); panel.append(node); return node;
  });
  const enabled = () => buttons.filter(node => !node.disabled);
  const open = (last = false) => {
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); onOpenChange(true);
    const box = wrap.getBoundingClientRect(), size = panel.getBoundingClientRect();
    const width = win.innerWidth || 1024, height = win.innerHeight || 768;
    const above = box.top - 16, below = height - box.bottom - 16;
    const up = above >= size.height || above > below;
    panel.style.maxHeight = `${Math.max(44, up ? above : below)}px`;
    panel.style.left = `${Math.max(8, Math.min(box.left, width - size.width - 8)) - box.left}px`;
    panel.style.top = up ? 'auto' : 'calc(100% + 8px)';
    panel.style.bottom = up ? 'calc(100% + 8px)' : 'auto';
    const choices = enabled(); choices[last ? choices.length - 1 : 0]?.focus({ preventScroll: true });
  };
  listen(trigger, 'click', () => panel.hidden ? open() : close());
  listen(trigger, 'keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); open(event.key === 'ArrowUp');
  });
  listen(win, 'keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close(true); return;
    }
    if (event.key === 'Tab') { close(true); return; }
  }, true);
  // Inspect internal controls inside their root: window's composedPath hides
  // them when the toolbar uses a closed shadow root.
  listen(root, 'keydown', event => {
    if (panel.hidden) return;
    if (!event.composedPath().includes(wrap)) return;
    const choices = enabled(), active = wrap.getRootNode().activeElement || event.target;
    let index = choices.indexOf(active);
    if (event.key === 'ArrowDown') index++;
    else if (event.key === 'ArrowUp') index--;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = choices.length - 1;
    else return;
    event.preventDefault(); event.stopImmediatePropagation();
    choices[(index + choices.length) % choices.length]?.focus({ preventScroll: true });
  }, true);
  listen(root, 'pointerdown', event => { if (!event.composedPath().includes(wrap)) close(); }, true);
  listen(win, 'pointerdown', event => { if (!event.composedPath().includes(root.host || wrap)) close(); }, true);
  listen(win, 'resize', () => close());
  listen(win, 'scroll', () => close(), true);
  return { trigger, panel, buttons, close, destroy() { close(); cleanups.forEach(fn => fn()); wrap.remove(); } };
}
