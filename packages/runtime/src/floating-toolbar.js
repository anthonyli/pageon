/** Shared, self-contained controller for embedded basic and advanced toolbars. */
export function createFloatingToolbar({ host, root, bar, handle, win, label }) {
  const doc = host.ownerDocument;
  const tab = doc.createElement('button');
  tab.type = 'button'; tab.className = 'dock-tab'; tab.hidden = true;
  tab.setAttribute('aria-label', label); tab.setAttribute('aria-expanded', 'false');
  tab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';
  root.append(tab);
  let timer = null, hovered = false, focused = false, keyboard = false;
  let paused = false, destroyed = false, collapsed = false, drag = null, position = null, edge = 'right';
  const setTimer = win.setTimeout?.bind(win) || globalThis.setTimeout;
  const clearTimer = win.clearTimeout?.bind(win) || globalThis.clearTimeout;
  const cleanups = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
  const clamp = (value, size, limit, margin = 8) => Math.max(margin, Math.min(value, Math.max(margin, limit - size - margin)));
  const measure = () => {
    const rect = bar.getBoundingClientRect();
    return { width: Math.min(rect.width, win.innerWidth - 16), height: rect.height };
  };
  const place = (x, y, width, height) => {
    Object.assign(host.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto', width: width + 'px', height: height + 'px' });
  };
  const nearest = (x, y, width, height) => [
    ['right', win.innerWidth - x - width], ['left', x], ['top', y], ['bottom', win.innerHeight - y - height],
  ].sort((a, b) => a[1] - b[1])[0][0];
  const render = () => {
    if (paused || !position) return;
    const size = measure();
    position.x = clamp(position.x, size.width, win.innerWidth);
    position.y = clamp(position.y, size.height, win.innerHeight);
    host.setAttribute('data-dock-edge', edge);
    if (collapsed) {
      const vertical = edge === 'left' || edge === 'right';
      const width = vertical ? 36 : 48, height = vertical ? 48 : 36;
      const x = edge === 'left' ? 0 : edge === 'right' ? win.innerWidth - width : clamp(position.x, width, win.innerWidth);
      const y = edge === 'top' ? 0 : edge === 'bottom' ? win.innerHeight - height : clamp(position.y, height, win.innerHeight);
      place(x, y, width, height);
    } else place(position.x, position.y, size.width, size.height);
  };
  const schedule = () => {
    cancel();
    if (paused || destroyed || hovered || focused || drag || collapsed) return;
    timer = setTimer(() => {
      timer = null;
      if (paused || destroyed || hovered || focused || drag) return;
      const size = measure();
      edge = nearest(position.x, position.y, size.width, size.height);
      collapsed = true;
      bar.setAttribute('inert', ''); bar.setAttribute('aria-hidden', 'true');
      tab.hidden = false;
      host.setAttribute('data-docked', '');
      render();
    }, 3000) ?? null;
  };
  const expand = () => {
    cancel();
    if (paused || destroyed || !collapsed) return;
    const size = measure();
    if (edge === 'left') position.x = 8;
    if (edge === 'right') position.x = win.innerWidth - size.width - 8;
    if (edge === 'top') position.y = 8;
    if (edge === 'bottom') position.y = win.innerHeight - size.height - 8;
    collapsed = false;
    host.removeAttribute('data-docked');
    bar.removeAttribute('inert'); bar.removeAttribute('aria-hidden');
    const transferFocus = root.activeElement === tab;
    tab.hidden = true;
    render();
    if (transferFocus) handle.focus({ preventScroll: true });
  };
  const move = (x, y) => {
    const size = measure();
    position = { x: clamp(x, size.width, win.innerWidth), y: clamp(y, size.height, win.innerHeight) };
    edge = nearest(position.x, position.y, size.width, size.height);
    render();
  };
  listen(host, 'pointerenter', event => { if (event.pointerType === 'touch') return; hovered = true; expand(); cancel(); });
  listen(host, 'pointerleave', () => { hovered = false; schedule(); });
  listen(win, 'keydown', event => { if (event.key === 'Tab') keyboard = true; }, true);
  listen(win, 'pointerdown', () => { keyboard = false; focused = false; schedule(); }, true);
  listen(root, 'focusin', () => { if (keyboard) { focused = true; expand(); cancel(); } });
  listen(root, 'focusout', event => {
    if (event.relatedTarget && root.contains(event.relatedTarget)) return;
    focused = false; schedule();
  });
  listen(tab, 'click', event => { event.preventDefault(); expand(); schedule(); });
  listen(handle, 'pointerdown', event => {
    if (paused || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault(); cancel(); expand();
    const rect = host.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    host.setAttribute('data-toolbar-dragging', '');
    handle.setPointerCapture?.(event.pointerId);
  });
  listen(handle, 'pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault(); move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
  });
  const finish = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null; host.removeAttribute('data-toolbar-dragging');
    if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    // Pointer capture may suppress pointerleave while dragging away from the bar.
    const rect = host.getBoundingClientRect();
    hovered = event.pointerType !== 'touch' && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    schedule();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => listen(handle, type, finish));
  listen(handle, 'click', event => event.preventDefault());
  listen(handle, 'keydown', event => {
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
    if (paused || !delta) return;
    event.preventDefault(); focused = true; expand(); cancel();
    move(position.x + delta[0], position.y + delta[1]);
  });
  listen(win, 'resize', () => { render(); });
  const refresh = () => {
    if (paused || destroyed) return;
    const rect = host.getBoundingClientRect();
    if (!position) position = { x: rect.left, y: rect.top };
    render(); schedule();
  };
  hovered = host.matches(':hover');
  refresh();
  host.setAttribute('data-toolbar-docking', '');
  return {
    refresh,
    setEditing(value) {
      cancel(); expand(); paused = value; drag = null;
      host.removeAttribute('data-toolbar-dragging');
      host.toggleAttribute('data-toolbar-paused', value);
      if (value) { host.style.removeProperty('width'); host.style.removeProperty('height'); }
      else { hovered = host.matches(':hover'); focused = keyboard && !!root.activeElement; refresh(); }
    },
    destroy() { destroyed = true; cancel(); cleanups.forEach(fn => fn()); tab.remove(); },
  };
}
