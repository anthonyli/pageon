import { toCanvas } from 'html-to-image';
import { embedExportFonts } from './visual-export-fonts.js';
import { captureNodes, captureRootFor, isCaptureRendered, checkCaptureEmbeds } from './visual-export-scope.js';
import { fetchExportText } from './visual-export-fetch.js';
import { resolveExportSvgUses } from './visual-export-svg.js';
import { createRasterPdf } from './raster-pdf.js';
import { adaptCaptureStyles } from './visual-export-styles.js';

// This module is bundled into the HTML, never loaded from a CDN at export time.
const OMIT = 'script,noscript,pageon-runtime,pageon-advanced-runtime,artifact-studio-runtime,[data-pageon-extension],[data-pageon-drag-overlay],[data-pageon-text-overlay],[data-pageon-export-ignore]';
const PAGE_SELECTOR = '[data-pageon-export-page],.slide,[data-slide]:not(button):not(a),.reveal .slides section';
const MAX_PIXELS = 32_000_000;
const MAX_SIDE = 16384;
const TIMEOUT = 15000;
const words = {
  en: { image: 'Export image', pdf: 'Export PDF', busy: 'Exporting…', done: 'Export downloaded', failed: 'Export failed. Please try again.', assets: 'An image or font could not be loaded. Check your connection and whether the original assets allow export.', size: 'This document is too large to export safely. Try PDF or split it into smaller files.', 'frame-visible': 'A visible embedded page cannot be captured. Replace it with an image, or explicitly exclude it with data-pageon-export-ignore.', 'svg-unavailable': 'An SVG icon could not be read. Check its URL, your connection, and the server’s CORS permissions.', 'svg-missing': 'An SVG icon references a missing symbol. Check the symbol ID or inline the SVG.', 'svg-unsafe': 'An SVG icon contains unsupported active or external content. Use a static inline SVG or image.', 'svg-cycle': 'An SVG icon has cyclic references. Use a flattened SVG or image.', 'svg-size': 'An SVG icon is too large or has excessive nested references. Use a smaller flattened SVG or image.' },
  zh: { image: '导出图片', pdf: '导出 PDF', busy: '正在导出…', done: '已下载导出文件', failed: '导出失败，请重试。', assets: '图片或字体未能加载。请检查网络，以及原素材是否允许导出。', size: '文档过大，无法安全导出。请尝试 PDF，或拆分为较小文件。', 'frame-visible': '导出内容中包含可见的嵌入网页，暂时无法截取。请替换为图片，或明确添加 data-pageon-export-ignore 排除。', 'svg-unavailable': '无法读取 SVG 图标，请检查地址、网络及服务器的 CORS 跨域许可。', 'svg-missing': 'SVG 图标引用的符号不存在，请检查符号 ID 或改用内嵌 SVG。', 'svg-unsafe': 'SVG 图标包含不支持的动态或外部内容，请改用静态内嵌 SVG 或图片。', 'svg-cycle': 'SVG 图标存在循环引用，请改用展开后的 SVG 或图片。', 'svg-size': 'SVG 图标过大或嵌套引用过多，请改用较小且已展开的 SVG 或图片。' },
};
const patch = (node, values) => Object.entries(values).forEach(([key, value]) => node.style.setProperty(key, value, 'important'));
const limit = (promise, win, ms = TIMEOUT) => new Promise((resolve, reject) => {
  const timer = win.setTimeout(() => reject(new Error('assets')), ms);
  Promise.resolve(promise).then(value => { win.clearTimeout(timer); resolve(value); }, error => { win.clearTimeout(timer); reject(error); });
});

/** Keep source DOM order; explicit markers also support a one-page presentation. */
export function findExportPages(doc) {
  const candidates = [...doc.querySelectorAll(PAGE_SELECTOR)].filter(node => !node.closest(OMIT) && !node.closest('[data-artifact-no-reveal],[role="dialog"],[aria-modal="true"]'));
  const leaves = candidates.filter(node => !candidates.some(other => other !== node && node.contains(other)));
  return leaves.filter(node => node.hasAttribute('data-pageon-export-page') || [...node.parentElement.children].filter(other => other.matches(PAGE_SELECTOR)).length > 1 || node.closest('.reveal .slides'));
}

// A transparent slide is normally painted over its deck/body background. The
// isolated page renderer has no ancestors, so retain that common backdrop.
export function inheritedBackdrop(node, win) {
  const transparent = value => !value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)';
  const own = win.getComputedStyle(node);
  if ((own.backgroundImage && own.backgroundImage !== 'none') || !transparent(own.backgroundColor)) return {};
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const css = win.getComputedStyle(parent);
    if (css.backgroundImage && css.backgroundImage !== 'none') {
      return Object.fromEntries(['background-image', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-clip'].map(property => [property, css.getPropertyValue(property)]));
    }
    if (!transparent(css.backgroundColor)) return {};
  }
  return {};
}

export function createVisualSnapshot(doc, win, mode = 'frame') {
  const sourcePages = findExportPages(doc);
  const dimensions = sourcePages.map(node => {
    const css = win.getComputedStyle(node);
    const sibling = sourcePages.find(other => other.parentElement === node.parentElement && other.getBoundingClientRect().width > 0);
    const visible = sibling ? win.getComputedStyle(sibling) : null;
    const parent = win.getComputedStyle(node.parentElement);
    const dimension = (style, axis) => {
      if (!style) return 0;
      const size = /px$/.test(style[axis]) ? parseFloat(style[axis]) : 0;
      if (!size) return 0;
      const edges = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
      return size + (style.boxSizing === 'border-box' ? 0 : edges.reduce((sum, edge) => sum + (parseFloat(style['padding' + edge]) || 0) + (parseFloat(style['border' + edge + 'Width']) || 0), 0));
    };
    return {
      width: dimension(css, 'width') || dimension(visible, 'width') || dimension(parent, 'width') || win.innerWidth,
      height: dimension(css, 'height') || dimension(visible, 'height') || dimension(parent, 'height') || win.innerHeight,
      display: [css.display, visible?.display].find(value => value && value !== 'none') || 'block',
      backdrop: inheritedBackdrop(node, win),
    };
  });
  const root = doc.documentElement.cloneNode(true);
  const sources = [doc.documentElement, ...doc.documentElement.querySelectorAll('*')];
  const copies = [root, ...root.querySelectorAll('*')];
  const pageCopies = sourcePages.map(node => copies[sources.indexOf(node)]);
  const canvases = [];
  sources.forEach((node, index) => {
    const copy = copies[index];
    // Preserve current values and rendered canvases, not only the original markup.
    if (node.localName === 'canvas' && !node.closest(OMIT)) {
      // Preserve pixels now; only fail a tainted canvas if it is later found in
      // a rendered capture root (inactive slides are expanded before that test).
      let src;
      try { src = node.toDataURL(); } catch { /* Checked after capture scope is known. */ }
      canvases.push({ node: copy, src, width: node.width, height: node.height });
    }
    if (node.localName === 'img') { copy.src = node.currentSrc || node.src; copy.removeAttribute('srcset'); copy.removeAttribute('sizes'); copy.loading = 'eager'; }
    if (node.localName === 'input') { copy.value = node.value; if (node.checked) copy.setAttribute('checked', ''); else copy.removeAttribute('checked'); }
    if (node.localName === 'textarea') copy.textContent = node.value;
    if (node.localName === 'select') [...copy.options].forEach((option, i) => { option.selected = node.options[i].selected; });
    for (const attr of [...copy.attributes]) if (/^on/i.test(attr.name)) copy.removeAttribute(attr.name);
    for (const name of ['contenteditable', 'data-artifact-selected', 'data-artifact-local-node']) copy.removeAttribute(name);
  });
  root.querySelectorAll(OMIT).forEach(node => node.remove());
  root.querySelectorAll('picture source').forEach(node => node.remove());
  root.removeAttribute('data-artifact-mode'); root.removeAttribute('data-artifact-local-edit');
  root.querySelectorAll('base,meta[http-equiv="refresh" i]').forEach(node => node.remove());
  const base = doc.createElement('base'); base.href = doc.baseURI; root.querySelector('head').prepend(base);
  const guard = doc.createElement('style');
  guard.setAttribute('data-pageon-capture-guard', '');
  guard.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
  root.querySelector('head').append(guard);
  let target, frame, captureShadow;
  try {
    if (mode === 'document') {
      // An opaque-origin preview cannot read a nested iframe, even one that sets
      // allow-same-origin. Keep its sandbox intact and render an inert clone in a
      // closed shadow tree in the SAME document. Never detach the original root:
      // that would destroy nested browsing contexts and interrupt media/state.
      frame = doc.createElement('pageon-export-snapshot');
      frame.setAttribute('data-pageon-extension', ''); frame.setAttribute('aria-hidden', 'true');
      patch(frame, { all: 'initial', position: 'fixed', left: '-100000px', top: '0', display: 'block', visibility: 'visible', opacity: '1', width: `${doc.documentElement.clientWidth || win.innerWidth}px`, height: `${win.innerHeight}px`, overflow: 'visible', isolation: 'isolate', 'pointer-events': 'none' });
      const shadow = frame.attachShadow({ mode: 'closed' });
      captureShadow = shadow;
      // :root selectors do not match an html element inside a shadow tree. Carry
      // its computed declarations, including custom properties and inherited
      // typography/background, onto the clone without touching source styles.
      const rootStyle = win.getComputedStyle(doc.documentElement);
      for (const property of Array.from(rootStyle)) root.style.setProperty(property, rootStyle.getPropertyValue(property), rootStyle.getPropertyPriority(property));
      // Do not add a CSP to this live document: removing its meta later would
      // not undo that policy. Neutralize cloned browsing contexts without executing
      // or re-fetching their source; visible embeds still fail scope validation.
      root.querySelectorAll('iframe').forEach(node => { node.setAttribute('sandbox', ''); node.setAttribute('srcdoc', ''); });
      root.querySelectorAll('object,embed').forEach(node => { node.removeAttribute('data'); node.removeAttribute('src'); node.setAttribute('type', 'application/x-pageon-export-blocked'); });
      shadow.append(root);
      if (doc.adoptedStyleSheets?.length && 'adoptedStyleSheets' in shadow) shadow.adoptedStyleSheets = [...doc.adoptedStyleSheets];
      doc.body.append(frame);
      // Bind queries to the clone, not the live document. Cancellation can remove
      // it immediately while pending asset promises finish; they must never mutate
      // the source document. Closed shadow styling cannot affect the source page.
      target = {
        documentElement: root, head: root.querySelector('head'), body: root.querySelector('body'),
        defaultView: win, baseURI: doc.baseURI, URL: doc.URL, fonts: doc.fonts,
        get styleSheets() { return [...root.querySelectorAll('style,link[rel~="stylesheet"]')].map(node => node.sheet).filter(Boolean); },
        adoptedStyleSheets: [...(doc.adoptedStyleSheets || [])],
        querySelector: root.querySelector.bind(root), querySelectorAll: root.querySelectorAll.bind(root),
        getElementById: id => [...root.querySelectorAll('[id]')].find(node => node.id === id) || null,
        createElement: doc.createElement.bind(doc), createElementNS: doc.createElementNS.bind(doc), importNode: doc.importNode.bind(doc),
      };
    } else {
      frame = doc.createElement('iframe');
      frame.setAttribute('data-pageon-extension', ''); frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${doc.documentElement.clientWidth || win.innerWidth}px;height:${win.innerHeight}px;border:0;pointer-events:none;`;
      doc.body.append(frame);
      target = frame.contentDocument;
    }
    if (!target) throw new Error('assets');
    // Block embedded browsing contexts before adopting untrusted markup. Keep
    // src/data attributes so attribute selectors still compute the same layout.
    if (mode !== 'document') {
      const policy = target.createElement('meta');
      policy.httpEquiv = 'Content-Security-Policy';
      policy.content = "frame-src 'none'; object-src 'none'";
      target.head.append(policy);
      root.querySelector('head').prepend(policy.cloneNode(true));
      target.replaceChild(target.adoptNode(root), target.documentElement);
    }
    pageCopies.forEach((page, index) => {
      const { width, height, display, backdrop } = dimensions[index];
      for (let ancestor = page.parentElement; ancestor; ancestor = ancestor.parentElement) {
        patch(ancestor, { position: 'relative', inset: 'auto', transform: 'none', overflow: 'visible', height: 'auto', 'max-height': 'none', 'content-visibility': 'visible' });
        ancestor.removeAttribute('hidden'); ancestor.removeAttribute('inert');
        if (target.defaultView.getComputedStyle(ancestor).display === 'none') patch(ancestor, { display: 'block' });
      }
      page.removeAttribute('hidden'); page.removeAttribute('inert'); page.removeAttribute('aria-hidden');
      patch(page, { ...backdrop, position: 'relative', inset: 'auto', transform: 'none', display, opacity: '1', visibility: 'visible', width: `${width}px`, height: `${height}px`, 'min-height': `${height}px`, 'max-height': 'none', 'max-width': 'none', margin: '0', 'box-sizing': 'border-box', overflow: 'visible', 'content-visibility': 'visible' });
      // Hidden reveal.js fragments are part of the exported slide as well.
      page.querySelectorAll('.fragment').forEach(node => patch(node, { opacity: '1', visibility: 'visible', transform: 'none' }));
    });
    return { frame, doc: target, pages: pageCopies, canvases, sourceDocument: doc, shadow: captureShadow };
  } catch (error) { frame?.remove(); throw error; }
}

async function prepareAssets(snapshot, win) {
  const doc = snapshot.doc;
  if (snapshot.shadow) {
    await adaptCaptureStyles({ doc: snapshot.sourceDocument, root: doc.documentElement, window: win, shadow: snapshot.shadow });
    doc.adoptedStyleSheets = []; // The adapter already flattened their rules.
  }
  const roots = snapshot.pages.length ? snapshot.pages : [doc.documentElement];
  const rendered = node => isCaptureRendered(node, captureRootFor(node, roots));
  await Promise.all([...doc.querySelectorAll('link[rel~="stylesheet"]')].map(link => limit(new Promise((resolve, reject) => {
    if (link.sheet) return resolve();
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => reject(new Error('assets')), { once: true });
  }), win)));
  checkCaptureEmbeds(doc, roots);
  for (const canvas of snapshot.canvases) {
    const visible = rendered(canvas.node);
    if (visible && !canvas.src) throw new Error('assets');
    const image = doc.createElement('img');
    for (const attr of canvas.node.attributes) image.setAttribute(attr.name, attr.value);
    image.src = !visible || canvas.src === 'data:,' ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E' : canvas.src;
    image.width = canvas.width; image.height = canvas.height;
    const computed = doc.defaultView.getComputedStyle(canvas.node);
    for (const property of computed) image.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
    const pageIndex = snapshot.pages.indexOf(canvas.node);
    canvas.node.replaceWith(image);
    if (pageIndex >= 0) { snapshot.pages[pageIndex] = image; roots[pageIndex] = image; }
  }
  const cache = new Map();
  const inline = url => {
    if (!url || url.startsWith('data:') || url.startsWith('#')) return Promise.resolve(url);
    const resolved = new URL(url, doc.baseURI);
    if (resolved.hash && resolved.href.split('#')[0] === new URL(doc.baseURI).href.split('#')[0]) return Promise.resolve(resolved.hash);
    const absolute = resolved.href;
    if (!cache.has(absolute)) cache.set(absolute, limit((async () => {
      const response = await win.fetch(absolute, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('assets');
      const blob = await response.blob();
      return await new Promise((resolve, reject) => { const reader = new win.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('assets')); reader.readAsDataURL(blob); });
    })(), win));
    return cache.get(absolute);
  };
  const fetchText = url => fetchExportText(win, url);
  await limit(resolveExportSvgUses(doc, roots, url => fetchExportText(win, url, 1_000_000), { shouldCapture: rendered }), win);
  checkCaptureEmbeds(doc, roots);
  // Fail clearly instead of letting the renderer silently omit blocked images.
  await Promise.all(captureNodes(roots, 'img').filter(rendered).map(async image => {
    image.src = await inline(image.src);
    await limit(image.decode ? image.decode() : new Promise((resolve, reject) => { if (image.complete) return image.naturalWidth ? resolve() : reject(new Error('assets')); image.onload = resolve; image.onerror = () => reject(new Error('assets')); }), win);
  }));
  await Promise.all(captureNodes(roots, 'svg image').map(async node => {
    const href = node.getAttribute('href') || node.getAttribute('xlink:href');
    if (href) { const value = await inline(href); node.setAttribute('href', value); node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', value); }
  }));
  // html-to-image clones SVG subtrees in one step; freeze descendant rules so
  // stylesheet selectors outside an individual slide are not lost.
  for (const node of captureNodes(roots, 'svg,svg *')) {
    if (node.closest('[data-pageon-svg-definitions]')) continue;
    const css = doc.defaultView.getComputedStyle(node);
    for (const property of css) node.style.setProperty(property, css.getPropertyValue(property), css.getPropertyPriority(property));
  }
  const pseudoRules = [];
  const urls = /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^)\\])*))\s*\)/gi;
  await Promise.all(captureNodes(roots).map(async (node, index) => {
    for (const pseudo of [null, '::before', '::after', '::marker']) {
      if (!isCaptureRendered(node, captureRootFor(node, roots), doc.defaultView, pseudo)) continue;
      const css = doc.defaultView.getComputedStyle(node, pseudo);
      if (pseudo && (!css.content || ['none', 'normal'].includes(css.content))) continue;
      for (const property of ['background-image', 'mask-image', 'border-image-source', 'list-style-image', ...(pseudo ? ['content'] : [])]) {
        const value = css.getPropertyValue(property);
        const matches = [...value.matchAll(urls)];
        if (!matches.length) continue;
        let embedded = value;
        for (const match of matches) {
          const raw = (match[1] ?? match[2] ?? match[3]).replace(/\\([\da-f]{1,6}\s?|[^\r\n\f])/gi, (_, value) => /^[\da-f]/i.test(value) ? String.fromCodePoint(parseInt(value.trim(), 16) || 0xfffd) : value);
          embedded = embedded.replace(match[0], `url("${await inline(raw)}")`);
        }
        if (pseudo) {
          node.setAttribute('data-pageon-capture-id', String(index));
          pseudoRules.push(`[data-pageon-capture-id="${index}"]${pseudo}{${property}:${embedded}!important}`);
        } else node.style.setProperty(property, embedded, 'important');
      }
    }
  }));
  if (pseudoRules.length) { const style = doc.createElement('style'); style.textContent = pseudoRules.join('\n'); doc.head.append(style); }
  if (doc.fonts?.ready) await limit(doc.fonts.ready, win);
  return await limit(embedExportFonts(doc, inline, fetchText, roots), win);
}

function captureSize(node, doc) {
  const root = node === doc.documentElement;
  return {
    width: Math.ceil(Math.max(node.scrollWidth, node.offsetWidth, root ? doc.body.scrollWidth : 0)),
    height: Math.ceil(Math.max(node.scrollHeight, node.offsetHeight, root ? doc.body.scrollHeight : 0)),
  };
}
function background(node, win) {
  for (let current = node; current; current = current.parentElement) {
    const value = win.getComputedStyle(current).backgroundColor;
    if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') return value;
  }
  return '#fff';
}
export function scaleFor(width, height) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width * height)) throw new Error('size');
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  if (scale < .25) throw new Error('size');
  return scale;
}

export function createVisualExporter({ document: doc, window: win, fileName = 'document.html', lang = 'en', downloadTarget = doc.body, beforeCapture, onStatus = () => {}, onDownload, onRasterPage, snapshotMode = 'frame' }) {
  const text = words[String(lang).startsWith('zh') ? 'zh' : 'en'];
  let active = null, activeSnapshot = null, destroyed = false;
  const download = (blob, extension) => {
    const name = fileName.replace(/\.html?$/i, '') + '.' + extension;
    if (onDownload) return onDownload({ blob, fileName: name, format: extension });
    const url = win.URL.createObjectURL(blob);
    const link = doc.createElement('a'); link.href = url;
    link.download = name;
    link.setAttribute('data-pageon-extension', '');
    downloadTarget.append(link); link.click(); link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
  };
  const run = format => {
    if (destroyed) return Promise.reject(new Error('runtime-destroyed'));
    if (active) return active;
    active = (async () => {
      let snapshot, restore, combined;
      onStatus({ busy: true, message: text.busy });
      try {
        restore = beforeCapture?.();
        snapshot = createVisualSnapshot(doc, win, snapshotMode);
        activeSnapshot = snapshot;
        restore?.(); restore = null;
        const fontEmbedCSS = await prepareAssets(snapshot, win);
        if (destroyed) throw new Error('runtime-destroyed');
        const nodes = snapshot.pages.length ? snapshot.pages : [snapshot.doc.documentElement];
        const sizes = nodes.map(node => captureSize(node, snapshot.doc));
        const width = Math.max(...sizes.map(size => size.width));
        const height = sizes.reduce((sum, size) => sum + size.height, 0);
        if (format === 'pdf' && sizes.some(size => Math.max(size.width, size.height) > 19200)) throw new Error('size');
        const scale = format === 'png' ? scaleFor(width, height) : null;
        let context, top = 0;
        const pdf = [];
        if (format === 'png') {
          combined = doc.createElement('canvas'); combined.width = Math.floor(width * scale); combined.height = Math.floor(height * scale);
          context = combined.getContext('2d'); if (!context) throw new Error('size');
          context.fillStyle = '#fff'; context.fillRect(0, 0, combined.width, combined.height);
        }
        for (let i = 0; i < nodes.length; i++) {
          if (destroyed) throw new Error('runtime-destroyed');
          const size = sizes[i];
          const canvas = await limit(toCanvas(nodes[i], { ...size, pixelRatio: scale || scaleFor(size.width, size.height), skipAutoScale: true, fontEmbedCSS, backgroundColor: background(nodes[i], snapshot.doc.defaultView) }), win, 30000);
          try {
            if (!canvas.width || !canvas.height) throw new Error('size');
            if (onRasterPage) await onRasterPage({ canvas, ...size, index: i });
            if (destroyed) throw new Error('runtime-destroyed');
            if (format === 'png') {
              const nextTop = Math.floor((sizes.slice(0, i + 1).reduce((sum, item) => sum + item.height, 0)) * scale);
              context.drawImage(canvas, 0, top, Math.floor(size.width * scale), nextTop - top); top = nextTop;
            } else {
              const data = canvas.toDataURL('image/jpeg', .95).split(',')[1];
              if (!data) throw new Error('size');
              pdf.push({ ...size, imageWidth: canvas.width, imageHeight: canvas.height, jpeg: Uint8Array.from(win.atob(data), c => c.charCodeAt(0)) });
            }
          } finally { canvas.width = 0; canvas.height = 0; }
        }
        if (destroyed) throw new Error('runtime-destroyed');
        const blob = format === 'png' ? await new Promise((resolve, reject) => combined.toBlob(value => value ? resolve(value) : reject(new Error('size')), 'image/png')) : new win.Blob([createRasterPdf(pdf)], { type: 'application/pdf' });
        if (combined) { combined.width = 0; combined.height = 0; }
        if (destroyed) throw new Error('runtime-destroyed');
        await download(blob, format);
        onStatus({ busy: false, message: text.done });
        return { format, pages: nodes.length, width, height };
      } catch (error) {
        let message = text[error?.message] || text.failed;
        if (error?.element) message += ` [${error.page ? `${String(lang).startsWith('zh') ? '第' : 'Page '}${error.page}${String(lang).startsWith('zh') ? '页 · ' : ' · '}` : ''}${error.element}]`;
        onStatus({ busy: false, message, error });
        throw new Error(message, { cause: error });
      } finally {
        try { restore?.(); } finally {
          snapshot?.frame.remove();
          activeSnapshot = null;
          if (combined) { combined.width = 0; combined.height = 0; }
        }
      }
    })().finally(() => { active = null; });
    return active;
  };
  return { exportImage: () => run('png'), exportPdf: () => run('pdf'), destroy: () => { destroyed = true; activeSnapshot?.frame.remove(); }, labels: text };
}
