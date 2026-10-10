import { fetchExportText } from './visual-export-fetch.js';

const ROOT = '[data-pageon-capture-root]';
const MAX_SHEETS = 128;
const MAX_DEPTH = 16;
const MAX_CSS = 4_000_000;
const fail = () => new Error('assets');
const unescapeCss = value => value.replace(/\\([\da-f]{1,6}\s?|[^\r\n\f])/gi, (_, escape) => {
  if (!/^[\da-f]/i.test(escape)) return escape;
  const code = parseInt(escape.trim(), 16);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
});
const escapeEnd = (text, index) => {
  const hex = text.slice(index + 1).match(/^[\da-f]{1,6}\s?/i);
  return index + 1 + (hex ? hex[0].length : 1);
};
const quotedEnd = (text, index) => {
  const quote = text[index++];
  while (index < text.length) {
    if (text[index] === '\\') index = escapeEnd(text, index);
    else if (text[index++] === quote) return index;
  }
  throw fail();
};
const commentEnd = (text, index) => {
  const end = text.indexOf('*/', index + 2);
  if (end < 0) throw fail();
  return end + 2;
};
const identifierEnd = (text, index) => {
  while (index < text.length) {
    if (text[index] === '\\') index = escapeEnd(text, index);
    else if (/[-\w\u0080-\uffff]/.test(text[index])) index++;
    else break;
  }
  return index;
};

/** Change the :root pseudo-class without changing its class-level specificity. */
export function rewriteCaptureRootSelector(selector) {
  let output = '', bracket = 0;
  for (let index = 0; index < selector.length;) {
    const char = selector[index];
    if (char === '"' || char === "'") {
      const end = quotedEnd(selector, index); output += selector.slice(index, end); index = end;
    } else if (char === '/' && selector[index + 1] === '*') {
      const end = commentEnd(selector, index); output += selector.slice(index, end); index = end;
    } else if (char === '\\') {
      const end = escapeEnd(selector, index); output += selector.slice(index, end); index = end;
    } else if (char === ':' && !bracket && selector[index - 1] !== ':') {
      const end = identifierEnd(selector, index + 1);
      const name = unescapeCss(selector.slice(index + 1, end));
      if (name.toLowerCase() === 'root' && selector[end] !== '(') output += ROOT;
      else output += selector.slice(index, end);
      index = end;
    } else {
      if (char === '[') bracket++;
      if (char === ']') bracket--;
      output += char; index++;
    }
  }
  return output;
}

function balancedEnd(text, start) {
  let depth = 1;
  for (let index = start + 1; index < text.length;) {
    if (text[index] === '"' || text[index] === "'") index = quotedEnd(text, index);
    else if (text[index] === '/' && text[index + 1] === '*') index = commentEnd(text, index);
    else if (text[index] === '\\') index = escapeEnd(text, index);
    else {
      if (text[index] === '(') depth++;
      if (text[index] === ')' && !--depth) return index + 1;
      index++;
    }
  }
  throw fail();
}

// Keep quoted strings and local fragments intact. External CSS becomes inline,
// so every non-fragment URL must retain the original stylesheet's base URL.
export function resolveCaptureCssUrls(css, base) {
  let output = '';
  for (let index = 0; index < css.length;) {
    if (css[index] === '"' || css[index] === "'") {
      const end = quotedEnd(css, index); output += css.slice(index, end); index = end;
    } else if (css[index] === '/' && css[index + 1] === '*') {
      const end = commentEnd(css, index); output += css.slice(index, end); index = end;
    } else if (css[index] === '\\' || /[-\w\u0080-\uffff]/.test(css[index])) {
      const end = identifierEnd(css, index);
      const name = unescapeCss(css.slice(index, end));
      if (['image-set', '-webkit-image-set'].includes(name.toLowerCase()) && css[end] === '(') {
        const close = balancedEnd(css, end);
        const args = css.slice(end + 1, close - 1);
        let values = '', start = 0;
        for (let cursor = 0; cursor <= args.length;) {
          if (cursor === args.length || args[cursor] === ',') {
            let entry = args.slice(start, cursor);
            const leading = entry.match(/^\s*/)[0].length;
            if (entry[leading] === '"' || entry[leading] === "'") {
              const last = quotedEnd(entry, leading), raw = unescapeCss(entry.slice(leading + 1, last - 1));
              let absolute;
              try { absolute = new URL(raw, base).href; } catch { throw fail(); }
              entry = entry.slice(0, leading) + JSON.stringify(absolute) + entry.slice(last);
            }
            values += resolveCaptureCssUrls(entry, base) + (cursor < args.length ? ',' : '');
            start = ++cursor;
          } else if (args[cursor] === '"' || args[cursor] === "'") cursor = quotedEnd(args, cursor);
          else if (args[cursor] === '(') cursor = balancedEnd(args, cursor);
          else if (args[cursor] === '/' && args[cursor + 1] === '*') cursor = commentEnd(args, cursor);
          else if (args[cursor] === '\\') cursor = escapeEnd(args, cursor);
          else cursor++;
        }
        output += css.slice(index, end + 1) + values + ')'; index = close; continue;
      }
      if (name.toLowerCase() !== 'url' || css[end] !== '(') { output += css.slice(index, end); index = end; continue; }
      const close = balancedEnd(css, end);
      const raw = css.slice(end + 1, close - 1).trim();
      const value = unescapeCss(/^(['"])[\s\S]*\1$/.test(raw) ? raw.slice(1, -1) : raw);
      if (!value || value.startsWith('#') || /^(data|blob):/i.test(value)) output += css.slice(index, close);
      else {
        let absolute;
        try { absolute = new URL(value, base).href; } catch { throw fail(); }
        output += `url(${JSON.stringify(absolute)})`;
      }
      index = close;
    } else output += css[index++];
  }
  return output;
}

function extractImports(css) {
  const imports = [];
  let clean = '', start = 0, depth = 0;
  for (let index = 0; index < css.length;) {
    if (css[index] === '"' || css[index] === "'") { index = quotedEnd(css, index); continue; }
    if (css[index] === '/' && css[index + 1] === '*') { index = commentEnd(css, index); continue; }
    if (css[index] === '\\') { index = escapeEnd(css, index); continue; }
    if (css[index] === '{') depth++;
    if (css[index] === '}') depth--;
    if (!depth && css[index] === '@') {
      const end = identifierEnd(css, index + 1);
      if (unescapeCss(css.slice(index + 1, end)).toLowerCase() === 'import') {
        let stop = end;
        while (stop < css.length && css[stop] !== ';') {
          if (css[stop] === '"' || css[stop] === "'") stop = quotedEnd(css, stop);
          else if (css[stop] === '/' && css[stop + 1] === '*') stop = commentEnd(css, stop);
          else if (css[stop] === '(') stop = balancedEnd(css, stop);
          else if (css[stop] === '\\') stop = escapeEnd(css, stop);
          else stop++;
        }
        if (stop >= css.length) throw fail();
        imports.push(css.slice(end, stop).trim());
        clean += css.slice(start, index);
        start = stop + 1; index = start; continue;
      }
    }
    index++;
  }
  return { css: clean + css.slice(start), imports };
}

function withoutComments(value) {
  let output = '';
  for (let index = 0; index < value.length;) {
    if (value[index] === '"' || value[index] === "'") {
      const end = quotedEnd(value, index); output += value.slice(index, end); index = end;
    } else if (value[index] === '/' && value[index + 1] === '*') { index = commentEnd(value, index); output += ' '; }
    else output += value[index++];
  }
  return output;
}
function importParts(statement) {
  const text = withoutComments(statement).trim();
  let raw, rest;
  if (text[0] === '"' || text[0] === "'") {
    const end = quotedEnd(text, 0); raw = text.slice(1, end - 1); rest = text.slice(end).trim();
  } else {
    const end = identifierEnd(text, 0);
    if (unescapeCss(text.slice(0, end)).toLowerCase() !== 'url' || text[end] !== '(') throw fail();
    const close = balancedEnd(text, end), value = text.slice(end + 1, close - 1).trim();
    raw = /^(['"])[\s\S]*\1$/.test(value) ? value.slice(1, -1) : value;
    rest = text.slice(close).trim();
  }
  let layer = null, supports = null;
  if (/^layer(?:\s|\(|$)/i.test(rest)) {
    rest = rest.slice(5).trimStart();
    layer = '';
    if (rest[0] === '(') { const end = balancedEnd(rest, 0); layer = rest.slice(1, end - 1).trim(); rest = rest.slice(end).trim(); }
  }
  if (/^supports\(/i.test(rest)) {
    const start = rest.indexOf('('), end = balancedEnd(rest, start);
    supports = rest.slice(start + 1, end - 1).trim(); rest = rest.slice(end).trim();
  }
  return { url: unescapeCss(raw), layer, supports, media: rest };
}
function wrapImport(css, parts) {
  if (parts.media && parts.media !== 'all') css = `@media ${parts.media}{${css}}`;
  if (parts.supports) {
    let condition = rewriteCaptureRootSelector(parts.supports);
    if (!/^(?:\(|not\s|selector\(|font-tech\(|font-format\()/i.test(condition)) condition = `(${condition})`;
    css = `@supports ${condition}{${css}}`;
  }
  if (parts.layer !== null) css = `@layer${parts.layer ? ' ' + parts.layer : ''}{${css}}`;
  return css;
}

/** Clone and scope source CSS; never rewrite a source or adopted stylesheet. */
export async function adaptCaptureStyles({ doc, root, window: win = doc.defaultView, shadow, fetchText = url => fetchExportText(win, url) }) {
  let count = 0, total = 0;
  const cache = new Map();
  const activeMedia = media => !media || !win.matchMedia || win.matchMedia(media).matches;
  const sourceSheets = [...doc.styleSheets, ...(doc.adoptedStyleSheets || [])];
  const budget = depth => { if (depth > MAX_DEPTH || ++count > MAX_SHEETS) throw fail(); };
  const load = async (url, depth, chain) => {
    if (chain.has(url)) return '';
    budget(depth);
    if (!cache.has(url)) cache.set(url, (async () => {
      let css;
      try { css = await fetchText(url); } catch { throw fail(); }
      if (typeof css !== 'string' || css.length > MAX_CSS || (total += css.length) > MAX_CSS * 4) throw fail();
      return css;
    })());
    const source = await cache.get(url);
    const next = new Set(chain); next.add(url);
    const { css, imports } = extractImports(source);
    let output = '';
    for (const statement of imports) output += await importCss(importParts(statement), url, depth + 1, next);
    let sheet;
    try { sheet = new win.CSSStyleSheet(); sheet.replaceSync(css); } catch { throw fail(); }
    return output + await rules(sheet.cssRules, url, depth, next);
  };
  const importCss = async (parts, base, depth, chain, importedSheet) => {
    if (!activeMedia(parts.media)) return '';
    if (parts.supports && win.CSS?.supports) {
      const condition = /^(?:\(|not\s|selector\(|font-tech\(|font-format\()/i.test(parts.supports) ? parts.supports : `(${parts.supports})`;
      if (!win.CSS.supports(condition)) return '';
    }
    let url;
    try { url = new URL(parts.url, base).href; } catch { throw fail(); }
    if (chain.has(url)) return '';
    let list;
    try { list = importedSheet?.cssRules; } catch { /* Use ordinary CORS below. */ }
    let output;
    if (list) { budget(depth); const next = new Set(chain); next.add(url); output = await rules(list, url, depth, next); }
    else output = await load(url, depth, chain);
    return wrapImport(output, parts);
  };
  const rules = async (list, base, depth, chain) => {
    if (depth > MAX_DEPTH) throw fail();
    let output = '';
    for (const rule of Array.from(list || [])) {
      if (rule.type === 3) {
        const text = rule.cssText.replace(/^@import\s*/i, '').replace(/;\s*$/, '');
        output += await importCss(importParts(text), base, depth + 1, chain, rule.styleSheet);
      } else if (rule.selectorText !== undefined) {
        const selector = rewriteCaptureRootSelector(rule.selectorText);
        // CSS nesting may attach rules beneath a style rule as well.
        const nested = rule.cssRules?.length ? await rules(rule.cssRules, base, depth + 1, chain) : '';
        output += `${selector}{${resolveCaptureCssUrls(rule.style.cssText, base)}${nested}}`;
      } else if (rule.cssRules) {
        const header = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
        output += `${rewriteCaptureRootSelector(header)}{${await rules(rule.cssRules, base, depth + 1, chain)}}`;
      } else output += resolveCaptureCssUrls(rule.cssText, base);
    }
    return output;
  };
  let css = '';
  for (const sheet of sourceSheets) {
    if (sheet.disabled || !activeMedia(sheet.media?.mediaText)) continue;
    budget(0);
    let list;
    try { list = sheet.cssRules; } catch { /* Opaque stylesheets require CORS. */ }
    const base = sheet.href || doc.baseURI;
    const chain = new Set(sheet.href ? [sheet.href] : []);
    let text;
    if (list) text = await rules(list, base, 0, chain);
    else if (sheet.href) text = await load(sheet.href, 0, new Set());
    else throw fail();
    css += sheet.media?.mediaText ? `@media ${sheet.media.mediaText}{${text}}` : text;
  }
  root.setAttribute('data-pageon-capture-root', '');
  root.querySelectorAll('style:not([data-pageon-capture-guard]),link[rel~="stylesheet"]').forEach(node => node.remove());
  if (shadow && 'adoptedStyleSheets' in shadow) shadow.adoptedStyleSheets = [];
  const style = doc.createElement('style');
  style.setAttribute('data-pageon-capture-styles', ''); style.textContent = css;
  root.querySelector('head').prepend(style);
  // Source CSP may allow an external stylesheet but reject the synthesized
  // inline copy. Never export an unstyled result or relax that policy.
  try { if (css.trim() && !style.sheet) throw fail(); }
  catch { style.remove(); throw fail(); }
  return css;
}
