/** Nodes that are actually passed to the rasterizer, including a matching root. */
export function captureNodes(roots, selector = '*') {
  return [...new Set(roots.flatMap(root => [
    ...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector),
  ]))];
}

// Layout containment does not apply to non-atomic inline boxes, internal
// table/ruby boxes, or elements without a principal box. A computed declaration
// on one of these must not hide content that the browser will still paint.
function canSkipContents(node, css) {
  const display = css.display || '';
  if (display === 'contents' || /^(?:inline(?: flow)?(?: list-item)?|(?:inline |block )?ruby(?:-.*)?|table-(?:row(?:-group)?|header-group|footer-group|column(?:-group)?))$/.test(display)) return false;
  if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
    return node.localName === 'svg' && node.parentElement?.namespaceURI !== node.namespaceURI;
  }
  return true;
}
const unpaintedBox = css => css.display === 'none' || (css.display !== 'contents' && parseFloat(css.opacity) === 0);

/** Offscreen slides are still exported. Only CSS that prevents painting counts. */
export function isCaptureRendered(node, root, win = node.ownerDocument.defaultView, pseudo = null) {
  if (!root || (node !== root && !root.contains(node))) return false;
  const own = win.getComputedStyle(node, pseudo);
  if (own.visibility === 'hidden' || own.visibility === 'collapse' || unpaintedBox(own)) return false;
  for (let current = node; current; current = current.parentElement) {
    // Pseudos can override inherited visibility, but not the originating
    // element's structural display, opacity, or content suppression.
    const css = current === node && !pseudo ? own : win.getComputedStyle(current);
    if (unpaintedBox(css)) return false;
    // content-visibility leaves its own background/border visible, but not
    // children or generated pseudo-elements when containment applies.
    if ((current !== node || pseudo) && css.contentVisibility === 'hidden' && canSkipContents(current, css)) return false;
    if (current === root) return true;
  }
  return false;
}

export function captureRootFor(node, roots) {
  return roots.find(root => root === node || root.contains(node));
}

/** Ignore nonpainted embeds, but never silently discard a visible embedded page. */
export function checkCaptureEmbeds(doc, roots) {
  for (const node of captureNodes(roots, 'iframe,object,embed')) {
    const root = captureRootFor(node, roots);
    const visible = isCaptureRendered(node, root) || (node.localName === 'object' &&
      [...node.querySelectorAll('*')].some(child => isCaptureRendered(child, root)));
    // Hidden embeds still contribute layout and selector state. The snapshot's
    // CSP blocks their browsing content; validation must preserve their boxes.
    if (!visible) continue;
    const error = new Error('frame-visible');
    const label = (node.id ? `#${node.id}` : node.getAttribute('title') || '').replace(/[\r\n\t]/g, ' ').slice(0, 100);
    error.element = `${node.localName}${label ? ` (${label})` : ''}`;
    error.page = roots.length > 1 ? roots.indexOf(root) + 1 : null;
    throw error;
  }
}
