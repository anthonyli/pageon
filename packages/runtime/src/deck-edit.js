/** Temporary editing layout. Self-contained so exports can embed the same logic. */
export function createDeckEditSession(doc) {
  let restore = null;
  return {
    enter() {
      if (restore) return;
      const win = doc.defaultView;
      const groups = new Map();
      doc.querySelectorAll('.slide, [data-slide], .reveal .slides > section').forEach((slide) => {
        if (slide.closest('[data-artifact-no-reveal], [role="dialog"], [aria-modal="true"]')) return;
        const parent = slide.parentElement;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(slide);
      });
      const decks = [...groups.entries()].filter(([, slides]) => slides.length > 1);
      if (!decks.length) return;
      const snapshots = new Map();
      const scroll = [win.scrollX, win.scrollY];
      // Focus can scroll overflow:hidden containers as well as the window.
      const scrollPositions = [...doc.querySelectorAll('*')].map(element =>
        [element, element.scrollLeft || 0, element.scrollTop || 0]);
      const patch = (element, styles) => {
        if (!snapshots.has(element)) snapshots.set(element, element.getAttribute('style'));
        Object.entries(styles).forEach(([key, value]) => element.style.setProperty(key, value, 'important'));
      };
      // Measure before changing any layout; preserve each deck's original page height.
      const heights = decks.map(([parent]) => Math.max(parent.clientHeight || win.innerHeight, 1));
      decks.forEach(([parent, slides], index) => {
        const display = slides.map((slide) => win.getComputedStyle(slide).display).find((value) => value !== 'none') || 'block';
        for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
          patch(ancestor, { height: 'auto', 'max-height': 'none', overflow: 'visible', 'overflow-y': 'visible', transform: 'none' });
          if (ancestor !== doc.body && ancestor !== doc.documentElement) {
            patch(ancestor, { position: 'relative', inset: 'auto', display: 'block' });
          }
        }
        slides.forEach((slide) => patch(slide, {
          position: 'relative', inset: 'auto', display, opacity: '1', visibility: 'visible',
          transform: 'none', transition: 'none', animation: 'none', 'pointer-events': 'auto',
          height: 'auto', 'min-height': heights[index] + 'px', 'max-height': 'none',
          width: '100%', 'max-width': 'none', 'box-sizing': 'border-box',
          'margin-bottom': '24px', 'content-visibility': 'visible',
        }));
      });
      restore = () => {
        // Commit the original geometry without animating away from the editing layout.
        // Remove this guard synchronously so it never leaks into saved HTML.
        const guard = doc.createElement('style');
        guard.textContent = '*,*::before,*::after{transition:none!important;scroll-behavior:auto!important;overflow-anchor:none!important}';
        doc.head.appendChild(guard);
        snapshots.forEach((style, element) => {
          if (style === null) element.removeAttribute('style');
          else element.setAttribute('style', style);
        });
        void doc.documentElement.offsetHeight;
        scrollPositions.forEach(([element, left, top]) => {
          if (element.scrollLeft !== left) element.scrollLeft = left;
          if (element.scrollTop !== top) element.scrollTop = top;
        });
        win.scrollTo(...scroll);
        void doc.documentElement.offsetHeight;
        guard.remove();
      };
    },
    exit() {
      if (!restore) return;
      restore();
      restore = null;
    },
  };
}
