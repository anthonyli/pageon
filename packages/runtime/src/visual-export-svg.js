const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const MAX_TEXT = 1_000_000;
const MAX_NODES = 20_000;
const MAX_DOCUMENTS = 16;
const MAX_DEPTH = 32;
const DEFINITION = 'defs,symbol,clipPath,mask,pattern,marker,linearGradient,radialGradient,filter,template';
const REFERENCE_ELEMENTS = new Set(['use', 'lineargradient', 'radialgradient', 'pattern', 'textpath', 'feimage']);
// External sprites are data, not another active document. Deliberately reject
// unsupported content instead of removing something that may be visible.
const SAFE_ELEMENTS = new Set(('svg g defs symbol use path rect circle ellipse line polyline polygon text tspan textpath lineargradient radialgradient stop clippath mask pattern marker filter feblend fecolormatrix fecomponenttransfer fecomposite feconvolvematrix fediffuselighting fedisplacementmap fedistantlight fedropshadow feflood fefunca fefuncb fefuncg fefuncr fegaussianblur feimage femerge femergenode femorphology feoffset fepointlight fespecularlighting fespotlight fetile feturbulence title desc').split(' '));
const SAFE_STYLES = new Set(('color fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity display visibility overflow vector-effect paint-order shape-rendering text-rendering color-rendering color-interpolation color-interpolation-filters image-rendering clip-rule clip-path mask mask-type filter stop-color stop-opacity flood-color flood-opacity lighting-color font font-family font-size font-style font-weight font-stretch font-variant font-kerning letter-spacing word-spacing text-anchor text-decoration dominant-baseline alignment-baseline baseline-shift writing-mode direction unicode-bidi transform transform-origin transform-box marker marker-start marker-mid marker-end x y width height cx cy r rx ry d white-space text-transform mix-blend-mode isolation').split(' '));
const fail = code => { throw new Error(code); };
const elements = node => [node, ...node.querySelectorAll('*')];
const hrefOf = node => node.getAttribute('href') ?? node.getAttributeNS(XLINK, 'href') ?? node.getAttribute('xlink:href');
const setHref = (node, value) => {
  node.setAttribute('href', value);
  node.setAttributeNS(XLINK, 'xlink:href', value);
};
const clearHref = node => {
  node.removeAttribute('href');
  node.removeAttributeNS(XLINK, 'href');
  node.removeAttribute('xlink:href');
};
const unescapeCss = text => text.replace(/\\([\da-f]{1,6}\s?|[^\r\n\f])/gi, (_, value) => {
  if (!/^[\da-f]/i.test(value)) return value;
  const point = parseInt(value.trim(), 16);
  return String.fromCodePoint(point && point <= 0x10ffff ? point : 0xfffd);
});

// Parse URL tokens rather than interpolating authored IDs into querySelector.
// CSS escapes are decoded before validation, including escaped `url` names.
function cssUrls(value) {
  const decoded = value.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = [];
  for (let index = 0; index < decoded.length;) {
    const start = index;
    const escape = decoded[index] === '\\' && /^\\([\da-f]{1,6}\s?|[^\r\n\f])/i.exec(decoded.slice(index));
    if (escape) {
      index += escape[0].length;
      tokens.push({ char: unescapeCss(escape[0]), escaped: true, start, end: index });
    } else tokens.push({ char: decoded[index++], escaped: false, start, end: index });
  }
  const result = [];
  for (let index = 0; index < tokens.length; index++) {
    if (/[\w\u0080-\uffff-]/.test(tokens[index - 1]?.char || '') || tokens.slice(index, index + 3).map(token => token.char).join('').toLowerCase() !== 'url') continue;
    let next = index + 3;
    while (/\s/.test(tokens[next]?.char || '') && !tokens[next]?.escaped) next++;
    if (tokens[next]?.char !== '(' || tokens[next]?.escaped) continue;
    next++;
    while (/\s/.test(tokens[next]?.char || '') && !tokens[next]?.escaped) next++;
    const quote = /["']/.test(tokens[next]?.char || '') && !tokens[next]?.escaped ? tokens[next++].char : null;
    let url = '';
    while (next < tokens.length && !(tokens[next].char === (quote || ')') && !tokens[next].escaped)) url += tokens[next++].char;
    if (quote) next++;
    while (/\s/.test(tokens[next]?.char || '') && !tokens[next]?.escaped) next++;
    if (tokens[next]?.char !== ')' || tokens[next]?.escaped || !url.trim() || /[\r\n\f]/.test(url)) fail('svg-unsafe');
    result.push({ start: tokens[index].start, end: tokens[next].end, url: url.trim() });
    index = next;
  }
  return { decoded, result };
}

function validateExternal(root, base) {
  const safeReference = value => {
    let url;
    try { url = new URL(value.trim(), base); } catch { fail('svg-unsafe'); }
    if (!['http:', 'https:', 'file:', 'blob:'].includes(url.protocol) || url.username || url.password) fail('svg-unsafe');
    if (!url.hash) fail('svg-missing');
  };
  for (const node of elements(root)) {
    const name = node.localName.toLowerCase();
    if (node.namespaceURI !== SVG || !SAFE_ELEMENTS.has(name)) fail('svg-unsafe');
    for (const attr of node.attributes) {
      // CSS Images functions can accept quoted URLs without any url() token.
      // External sprites only support fragment-backed SVG paint/clip/filter
      // references; reject these functions instead of importing hidden fetches.
      if (attr.localName === 'style' || SAFE_STYLES.has(attr.localName)) {
        const css = unescapeCss(attr.value.replace(/\/\*[\s\S]*?\*\//g, ''));
        if (/(?:^|[^\w-])(?:image-set|-webkit-image-set|image|cross-fade|-webkit-cross-fade|element|-moz-element|paint|src)\s*\(/i.test(css)) fail('svg-unsafe');
      }
      if (/^on/i.test(attr.localName) || (attr.namespaceURI && ![XLINK, XML, XMLNS].includes(attr.namespaceURI)) || (attr.namespaceURI === XML && attr.localName === 'base')) fail('svg-unsafe');
      if (attr.localName === 'href') {
        if (!REFERENCE_ELEMENTS.has(name)) fail('svg-unsafe');
        if (attr.value.trim()) safeReference(attr.value);
      }
      if (attr.localName === 'style') {
        const style = unescapeCss(attr.value.replace(/\/\*[\s\S]*?\*\//g, ''));
        if (/[{}@]|expression\s*\(/i.test(style)) fail('svg-unsafe');
        for (const declaration of style.split(';').filter(value => value.trim())) {
          const colon = declaration.indexOf(':');
          const property = declaration.slice(0, colon).trim().toLowerCase();
          if (colon < 0 || !(SAFE_STYLES.has(property) || /^--[\w-]+$/.test(property))) fail('svg-unsafe');
        }
      }
      if (/url|\\/i.test(attr.value)) for (const token of cssUrls(attr.value).result) safeReference(token.url);
    }
  }
}

// Preserve declarations that really match a local source node before IDs and
// ancestors change. Inherited defaults must not be frozen onto symbol content:
// those values belong to the use element's shadow-tree inheritance instead.
function localPresentationStyles(doc) {
  const rules = [], cached = new Map();
  let scanned = 0, comparisons = 0;
  const mediaMatches = media => !media || (doc.defaultView?.matchMedia ? doc.defaultView.matchMedia(media).matches : media !== 'print');
  const visit = (sheet, depth = 0) => {
    if (depth > MAX_DEPTH) fail('svg-size');
    if (sheet.disabled || !mediaMatches(sheet.media?.mediaText)) return;
    let list;
    try { list = sheet.cssRules; } catch { return; }
    for (const rule of list || []) {
      if (++scanned > MAX_NODES) fail('svg-size');
      if (rule.selectorText && rule.style) rules.push(rule);
      else if (rule.styleSheet) visit(rule.styleSheet, depth + 1);
      else if (rule.cssRules && mediaMatches(rule.media?.mediaText)) {
        if (rule.constructor?.name === 'CSSSupportsRule' && doc.defaultView?.CSS?.supports && !doc.defaultView.CSS.supports(rule.conditionText)) continue;
        visit(rule, depth + 1);
      }
    }
  };
  for (const sheet of doc.styleSheets || []) visit(sheet);
  return node => {
    if (cached.has(node)) return cached.get(node);
    const declarations = new Map();
    for (const rule of rules) {
      if (++comparisons > 2_000_000) fail('svg-size');
      let matches;
      try { matches = node.matches(rule.selectorText); } catch { continue; }
      if (!matches) continue;
      for (let index = 0; index < rule.style.length; index++) {
        const property = rule.style[index];
        if (!SAFE_STYLES.has(property) && !property.startsWith('--')) continue;
        if (!declarations.has(property)) declarations.set(property, []);
        declarations.get(property).push(rule.style.getPropertyValue(property).trim());
      }
    }
    const css = declarations.size ? doc.defaultView?.getComputedStyle?.(node) : null;
    const result = [];
    for (const [property, values] of declarations) {
      const inline = node.style?.getPropertyValue(property);
      if (inline) values.push(inline.trim());
      const authored = values[0];
      // Keeping identical authored values also preserves currentColor and var()
      // rather than resolving them in the hidden sprite's original ancestors.
      const value = values.every(value => value === authored) ? authored : css?.getPropertyValue(property);
      if (value) result.push([property, value]);
    }
    cached.set(node, result);
    return result;
  };
}

function defaultShouldCapture(node, root, doc) {
  // A definition is rendered only through a use, even when its own computed
  // display is not none. Such uses are visited on demand while resolving it.
  if (node.closest(DEFINITION)) return false;
  let visibility;
  for (let current = node; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('data-pageon-export-ignore')) return false;
    const css = doc.defaultView?.getComputedStyle?.(current) || current.style;
    if (css?.display === 'none' || css?.contentVisibility === 'hidden' || css?.opacity === '0') return false;
    if (current === node) visibility = css?.visibility;
    if (current === root) break;
  }
  return visibility !== 'hidden' && visibility !== 'collapse';
}

/**
 * Make rendered SVG uses self-contained in a scriptless export snapshot.
 * `roots` are the actual page capture roots. `fetchText(url)` must perform a
 * bounded ordinary fetch (no CORS proxy or no-cors fallback) and return text.
 * Optional `shouldCapture(node, root)` can share the caller's visibility policy.
 * Throws svg-unavailable, svg-unsafe, svg-missing, svg-cycle, or svg-size.
 * The original document is never touched; only the supplied snapshot is changed.
 */
export async function resolveExportSvgUses(doc, roots, fetchText, { shouldCapture } = {}) {
  const captureRoots = [...new Set(roots || [doc.documentElement])].filter(Boolean);
  const base = new URL(doc.baseURI);
  base.hash = '';
  const local = { doc, url: base.href, external: false };
  const records = new Map([[base.href, Promise.resolve(local)]]);
  // An authored <base> can differ from the document URL. The snapshot itself
  // is about:blank, so also recognize its same-origin owner document's URL.
  for (const candidate of [doc.URL, doc.defaultView?.frameElement?.ownerDocument?.URL]) {
    if (!candidate || candidate.startsWith('about:')) continue;
    const url = new URL(candidate); url.hash = '';
    records.set(url.href, Promise.resolve(local));
  }
  const contexts = new Map();
  const resolvedUses = new Set();
  const pendingUses = [];
  let counter = 0, importedNodes = 0, fetched = 0;
  let presentationStyles;
  const nextId = () => {
    let id;
    do { id = `pageon-export-svg-${++counter}`; } while (doc.getElementById(id));
    return id;
  };
  const getRecord = async url => {
    if (!records.has(url)) {
      if (++fetched > MAX_DOCUMENTS) fail('svg-size');
      records.set(url, (async () => {
        let text;
        try { text = await fetchText(url); } catch { fail('svg-unavailable'); }
        if (typeof text !== 'string') fail('svg-unavailable');
        if (text.length > MAX_TEXT) fail('svg-size');
        if (/<!\s*(?:DOCTYPE|ENTITY)|<\?\s*xml-stylesheet/i.test(text)) fail('svg-unsafe');
        const Parser = doc.defaultView?.DOMParser || globalThis.DOMParser;
        if (!Parser) fail('svg-unavailable');
        let parsed;
        try { parsed = new Parser().parseFromString(text, 'image/svg+xml'); } catch { fail('svg-unsafe'); }
        if (parsed.documentElement?.namespaceURI !== SVG || parsed.documentElement?.localName !== 'svg' || parsed.getElementsByTagNameNS('*', 'parsererror').length) fail('svg-unsafe');
        if (parsed.getElementsByTagName('*').length > MAX_NODES) fail('svg-size');
        validateExternal(parsed.documentElement, url);
        return { doc: parsed, url, external: true };
      })());
    }
    return records.get(url);
  };
  const reference = async (value, source) => {
    let url;
    try { url = new URL(value.trim(), source.url); } catch { fail('svg-unsafe'); }
    if (!['http:', 'https:', 'file:', 'blob:'].includes(url.protocol) || url.username || url.password) fail('svg-unsafe');
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { fail('svg-missing'); }
    if (!id) fail('svg-missing');
    url.hash = '';
    const record = url.href === source.url ? source : await getRecord(url.href);
    const target = record.doc.getElementById(id);
    if (!target || target.namespaceURI !== SVG) fail('svg-missing');
    return { record, target };
  };
  const contextFor = svg => {
    if (!contexts.has(svg)) {
      const defs = doc.createElementNS(SVG, 'defs');
      defs.setAttribute('data-pageon-svg-definitions', '');
      contexts.set(svg, { svg, defs, definitions: new Map() });
    }
    return contexts.get(svg);
  };

  const importDefinition = async (record, target, context, depth) => {
    if (depth > MAX_DEPTH) fail('svg-size');
    let byNode = context.definitions.get(record);
    if (!byNode) context.definitions.set(record, byNode = new Map());
    const existing = byNode.get(target);
    if (existing) {
      if (!existing.done) fail('svg-cycle');
      return existing.id;
    }
    const originals = elements(target);
    importedNodes += originals.length;
    if (importedNodes > MAX_NODES) fail('svg-size');
    const clone = doc.importNode(target, true);
    const copies = elements(clone);
    const scope = new Map();
    const rewrittenReferences = new Set();
    let activeNodes = 0;
    originals.forEach((node, index) => {
      const copy = copies[index];
      const id = node.hasAttribute('id') || node === target ? nextId() : null;
      if (id) copy.setAttribute('id', id);
      scope.set(node, { copy, id, state: 0 });
    });
    const entry = { id: scope.get(target).id, done: false };
    byNode.set(target, entry);
    const resolveReference = async value => {
      const { record: dependency, target: definition } = await reference(value, record);
      const inside = dependency === record && scope.get(definition);
      if (inside) {
        await processNode(definition, true);
        return inside.id;
      }
      return importDefinition(dependency, definition, context, depth + 1);
    };
    const rewriteUrls = async value => {
      const { decoded, result } = cssUrls(value);
      if (!result.length) return value;
      let changed = decoded;
      for (const token of result.reverse()) {
        // Local raster data has already been inlined by the caller. External
        // sprites cannot introduce data URLs (including nested active SVG).
        if (!record.external && /^data:/i.test(token.url)) continue;
        const id = await resolveReference(token.url);
        changed = changed.slice(0, token.start) + `url("#${id}")` + changed.slice(token.end);
      }
      return changed;
    };
    const processNode = async (original, requested = false) => {
      if (!requested && original !== target) {
        if (original.matches(DEFINITION)) return;
        const css = record.external ? original.style : doc.defaultView?.getComputedStyle?.(original) || original.style;
        if (css?.display === 'none' || css?.opacity === '0') return;
      }
      const item = scope.get(original);
      if (item.state === 2) return;
      if (item.state === 1) fail('svg-cycle');
      if (++activeNodes > MAX_DEPTH) fail('svg-size');
      item.state = 1;
      const name = original.localName.toLowerCase();
      const href = hrefOf(original);
      if (REFERENCE_ELEMENTS.has(name) && href?.trim()) {
        setHref(item.copy, `#${await resolveReference(href)}`);
        rewrittenReferences.add(item.copy);
        if (name === 'use') resolvedUses.add(item.copy);
      }
      for (const attr of [...original.attributes]) {
        if (attr.localName === 'href' || attr.localName === 'id') continue;
        if (/url|\\/i.test(attr.value)) {
          const value = await rewriteUrls(attr.value);
          if (value !== attr.value) item.copy.setAttributeNS(attr.namespaceURI, attr.name, value);
        }
        if (['aria-labelledby', 'aria-describedby'].includes(attr.name)) {
          item.copy.setAttribute(attr.name, attr.value.split(/\s+/).map(id => scope.get(record.doc.getElementById(id))?.id || id).join(' '));
        }
      }
      if (!record.external) {
        presentationStyles ||= localPresentationStyles(doc);
        for (const [property, value] of presentationStyles(original)) item.copy.style.setProperty(property, await rewriteUrls(value), 'important');
      }
      for (const child of original.children) await processNode(child);
      item.state = 2;
      activeNodes--;
    };
    await processNode(target, true);
    for (const copy of copies) if (REFERENCE_ELEMENTS.has(copy.localName.toLowerCase()) && !rewrittenReferences.has(copy)) clearHref(copy);
    context.defs.append(clone);
    entry.done = true;
    return entry.id;
  };

  // Snapshot this list before adding definitions. Imported nested uses are
  // resolved in their source document, not accidentally against the host page.
  const uses = new Map();
  for (const root of captureRoots) {
    for (const node of [root, ...root.querySelectorAll('use')]) {
      if (node.namespaceURI !== SVG || node.localName.toLowerCase() !== 'use') continue;
      if (!uses.has(node)) uses.set(node, root);
    }
  }
  for (const [use, root] of uses) {
    try {
      if (use.closest(DEFINITION) || !(shouldCapture ? shouldCapture(use, root) : defaultShouldCapture(use, root, doc))) continue;
      const href = hrefOf(use);
      if (!href?.trim()) { clearHref(use); continue; }
      const svg = use.closest('svg');
      if (!svg) fail('svg-missing');
      const { record, target } = await reference(href, local);
      const context = contextFor(svg);
      const id = await importDefinition(record, target, context, 0);
      pendingUses.push({ use, id });
      resolvedUses.add(use);
    } catch (error) {
      const svg = use.closest('svg');
      const label = use.getAttribute('aria-label') || svg?.getAttribute('aria-label') || use.id || svg?.id;
      let source = '';
      try { const url = new URL(hrefOf(use), local.url); source = url.pathname.split('/').pop() + url.hash; } catch { /* Keep a useful element label even for invalid URLs. */ }
      error.element = ('SVG ' + (label || source || 'use')).replace(/\s+/g, ' ').slice(0, 180);
      if (root !== doc.documentElement) error.page = captureRoots.indexOf(root) + 1;
      throw error;
    }
  }

  for (const { svg, defs } of contexts.values()) if (defs.childNodes.length) svg.append(defs);
  // A rendered use may itself be another use's target. Preserve authored
  // references until every definition has been read from the snapshot.
  for (const { use, id } of pendingUses) setHref(use, `#${id}`);
  // html-to-image queries xlink:href even in unused hidden symbols. All live
  // uses now point to independent definitions, so these dead links can be
  // cleared without fetching them or causing selector syntax failures.
  for (const use of uses.keys()) if (!resolvedUses.has(use)) clearHref(use);
}
