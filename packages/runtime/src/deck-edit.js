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
      // Capture the currently visible page before all pages become visible.
      // Use rendered visibility, not template-specific active class names.
      const visibleArea = slide => {
        const rect = slide.getBoundingClientRect?.();
        const style = win.getComputedStyle(slide);
        if (!rect || slide.closest('[inert],[aria-hidden="true"]') ||
          style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return 0;
        return Math.max(0, Math.min(rect.bottom, win.innerHeight) - Math.max(rect.top, 0)) *
          Math.max(0, Math.min(rect.right, win.innerWidth) - Math.max(rect.left, 0));
      };
      const visibleSlide = () => decks.flatMap(([, slides]) => slides).map(slide => ({ slide, area: visibleArea(slide) }))
        .filter(({ area }) => area > 0).sort((a, b) => b.area - a.area)[0]?.slide;
      const currentSlide = visibleSlide();
      const initialHash = win.location?.hash || '';
      const snapshots = new Map();
      const interactionSnapshots = new Map();
      const unlockSlide = slide => {
        if (slide.hasAttribute('inert')) slide.removeAttribute('inert');
        if (slide.hasAttribute('aria-hidden')) slide.removeAttribute('aria-hidden');
      };
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
        slides.forEach((slide) => {
          // Presentation scripts make inactive slides inert. CSS visibility and
          // pointer-events cannot override that: clicks hit the deck instead.
          interactionSnapshots.set(slide, [slide.getAttribute('inert'), slide.getAttribute('aria-hidden')]);
          unlockSlide(slide);
          patch(slide, {
            position: 'relative', inset: 'auto', display, opacity: '1', visibility: 'visible',
            transform: 'none', transition: 'none', animation: 'none', 'pointer-events': 'auto',
            height: 'auto', 'min-height': heights[index] + 'px', 'max-height': 'none',
            width: '100%', 'max-width': 'none', 'box-sizing': 'border-box',
            'margin-bottom': '24px', 'content-visibility': 'visible',
          });
        });
      });
      // A running presentation may reapply these attributes after entering edit
      // mode (timers, resize or hash navigation). Keep only expanded slides open.
      const observer = win.MutationObserver ? new win.MutationObserver(records => {
        records.forEach(({ target }) => {
          if (interactionSnapshots.has(target)) unlockSlide(target);
        });
      }) : null;
      interactionSnapshots.forEach((_, slide) => observer?.observe(slide, { attributes: true, attributeFilter: ['inert', 'aria-hidden'] }));
      restore = () => {
        // While expanded, the presentation's active class still marks the old
        // page. Choose the page the reader is actually looking at instead.
        const finishedSlide = visibleSlide();
        observer?.disconnect();
        // Commit the original geometry without animating away from the editing layout.
        // Remove this guard synchronously so it never leaks into saved HTML.
        const guard = doc.createElement('style');
        guard.textContent = '*,*::before,*::after{transition:none!important;scroll-behavior:auto!important;overflow-anchor:none!important}';
        doc.head.appendChild(guard);
        snapshots.forEach((style, element) => {
          if (style === null) element.removeAttribute('style');
          else element.setAttribute('style', style);
        });
        interactionSnapshots.forEach(([inert, ariaHidden], slide) => {
          for (const [name, value] of [['inert', inert], ['aria-hidden', ariaHidden]]) {
            if (value === null) slide.removeAttribute(name);
            else slide.setAttribute(name, value);
          }
        });
        void doc.documentElement.offsetHeight;
        scrollPositions.forEach(([element, left, top]) => {
          if (element.scrollLeft !== left) element.scrollLeft = left;
          if (element.scrollTop !== top) element.scrollTop = top;
        });
        win.scrollTo(...scroll);
        if (finishedSlide && finishedSlide !== currentSlide) {
          const slides = decks.find(([, pages]) => pages.includes(currentSlide) && pages.includes(finishedSlide))?.[1];
          let nextHash;
          if (currentSlide?.id && finishedSlide.id &&
            [currentSlide.id, encodeURIComponent(currentSlide.id)].includes(initialHash.slice(1))) {
            nextHash = '#' + encodeURIComponent(finishedSlide.id);
          } else if (slides) {
            // Infer a single unambiguous page index from the document's own URL.
            // No slide/page prefix, index base or route shape is assumed.
            const index = slides.indexOf(currentSlide);
            const parts = [...initialHash.matchAll(/\d+/g)].filter(part =>
              Number(part[0]) === index || Number(part[0]) === index + 1);
            if (parts.length === 1) {
              const part = parts[0];
              const value = String(slides.indexOf(finishedSlide) + Number(part[0]) - index);
              const formatted = part[0].startsWith('0') ? value.padStart(part[0].length, '0') : value;
              nextHash = initialHash.slice(0, part.index) + formatted + initialHash.slice(part.index + part[0].length);
            }
          }
          if (nextHash && win.history?.replaceState && win.dispatchEvent && win.Event) {
            const previousHash = win.location.hash;
            const dispatchHash = hash => {
              const oldURL = win.location.href;
              win.history.replaceState(win.history.state, '', hash || win.location.pathname + win.location.search);
              win.dispatchEvent(win.HashChangeEvent
                ? new win.HashChangeEvent('hashchange', { oldURL, newURL: win.location.href })
                : new win.Event('hashchange'));
            };
            // The original script must actually activate the requested page.
            // A numeric URL alone is not proof of a presentation controller.
            dispatchHash(nextHash);
            if (!(visibleArea(finishedSlide) > 0 && visibleArea(currentSlide) === 0)) dispatchHash(previousHash);
          }
          const style = win.getComputedStyle(finishedSlide);
          if (!finishedSlide.closest('[inert],[aria-hidden="true"]') &&
            style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            finishedSlide.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior: 'instant' });
          }
        }
        void doc.documentElement.offsetHeight;
        guard.remove();
      };
      // Expanding earlier slides moves this page down the document. Keep it in
      // view without focus changes or a smooth trip through the earlier pages.
      currentSlide?.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior: 'instant' });
    },
    exit() {
      if (!restore) return;
      restore();
      restore = null;
    },
  };
}
