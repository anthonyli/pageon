// Self-contained so offline HTML can embed the same anchored popup positioning.
export function createFloatingPanel({ panel, win, anchor, maxHeight = 520 }) {
  const cleanups = [];
  const listen = (target, type, fn, capture = false) => {
    target?.addEventListener(type, fn, capture);
    cleanups.push(() => target?.removeEventListener(type, fn, capture));
  };
  const bounds = () => {
    const view = win.visualViewport;
    return { x: view?.offsetLeft || 0, y: view?.offsetTop || 0,
      width: view?.width || win.innerWidth, height: view?.height || win.innerHeight };
  };
  const refresh = () => {
    if (panel.hidden) return;
    const view = bounds(), margin = 8;
    Object.assign(panel.style, { position: 'fixed', width: Math.min(320, Math.max(0, view.width - 16)) + 'px',
      maxWidth: Math.max(0, view.width - 16) + 'px', maxHeight: Math.max(0, Math.min(maxHeight, view.height - 16)) + 'px', right: 'auto', bottom: 'auto' });
    const rect = panel.getBoundingClientRect();
    const width = Math.min(rect.width || 320, view.width - 16), height = Math.min(rect.height || 260, view.height - 16);
    const target = anchor?.getBoundingClientRect();
    const position = { x: target ? target.left : view.x + view.width - width - margin,
      y: target ? target.bottom + margin : view.y + 72 };
    if (position.y + height > view.y + view.height - margin && target) position.y = target.top - height - margin;
    position.x = Math.max(view.x + margin, Math.min(position.x, view.x + view.width - width - margin));
    position.y = Math.max(view.y + margin, Math.min(position.y, view.y + view.height - height - margin));
    panel.style.left = position.x + 'px'; panel.style.top = position.y + 'px';
  };
  listen(win, 'resize', refresh);
  listen(panel.ownerDocument, 'scroll', refresh, true);
  listen(win.visualViewport, 'resize', refresh);
  listen(win.visualViewport, 'scroll', refresh);
  const observer = win.ResizeObserver ? new win.ResizeObserver(refresh) : null;
  observer?.observe(panel);
  refresh();
  return { refresh, destroy() { cleanups.forEach(fn => fn()); observer?.disconnect(); } };
}
