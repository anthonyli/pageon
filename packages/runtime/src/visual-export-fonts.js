// Font embedding deliberately does not use html-to-image's best-effort fetches:
// a missing required font must fail the export rather than change its typography.
export async function embedExportFonts(doc, inline, fetchText, roots = [doc.documentElement]) {
  const win = doc.defaultView;
  const used = new Set();
  const output = [];
  const visitedUrls = new Set();
  const visitedSheets = new Set();
  let sheetCount = 0;
  const fail = () => new Error('assets');
  const unescape = text => text.replace(/\\([\da-f]{1,6}\s?|[^\r\n\f])/gi, (_, escape) => {
    if (/^[\da-f]/i.test(escape)) {
      const code = parseInt(escape.trim(), 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    }
    return escape;
  });
  const family = value => unescape(value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2')).toLowerCase();
  // Split families and src alternatives without splitting quoted commas/URLs.
  function split(value) {
    const values = [];
    let start = 0, quote = '', depth = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (char === '\\') { i++; continue; }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && !depth) { values.push(value.slice(start, i).trim()); start = i + 1; }
    }
    values.push(value.slice(start).trim());
    return values.filter(Boolean);
  }
  for (const node of new Set(roots.flatMap(root => [root, ...root.querySelectorAll('*')]))) {
    for (const pseudo of [null, '::before', '::after', '::marker']) {
      let css;
      try { css = win.getComputedStyle(node, pseudo); } catch { continue; }
      if (pseudo && (!css.content || ['none', 'normal'].includes(css.content))) continue;
      split(css.fontFamily || css.getPropertyValue('font-family') || '').forEach(name => used.add(family(name)));
    }
  }
  if (!used.size) return '';

  const urls = () => /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^)\\])*))\s*\)/gi;
  const resolve = (url, base) => new URL(unescape(url.trim()), base || doc.baseURI).href;
  const activeMedia = media => !media || !win.matchMedia || win.matchMedia(media).matches;

  async function embedFace(rule, base) {
    const style = rule.style;
    if (!used.has(family(style.getPropertyValue('font-family')))) return;
    const source = style.getPropertyValue('src');
    const alternatives = split(source);
    const embedded = [];
    let remoteCount = 0, embeddedCount = 0;
    for (const alternative of alternatives) {
      const matches = [...alternative.matchAll(urls())];
      if (!matches.length) { embedded.push(alternative); continue; }
      remoteCount++;
      try {
        let value = alternative;
        for (const match of matches) {
          const url = resolve(match[1] ?? match[2] ?? match[3], base);
          const data = url.startsWith('data:') ? url : await inline(url);
          if (typeof data !== 'string' || !data.startsWith('data:')) throw fail();
          value = value.replace(match[0], `url(${JSON.stringify(data)})`);
        }
        embedded.push(value);
        embeddedCount++;
      } catch {
        // A font may have legacy and modern alternatives. One successfully
        // embedded source is enough, but local() alone cannot hide fetch errors.
      }
    }
    if (remoteCount && !embeddedCount) throw fail();
    if (!embedded.length) return;
    const declarations = Array.from({ length: style.length }, (_, i) => {
      const name = style[i];
      const value = name === 'src' ? embedded.join(', ') : style.getPropertyValue(name);
      return `${name}: ${value}${style.getPropertyPriority(name) ? ' !important' : ''};`;
    });
    output.push(`@font-face { ${declarations.join(' ')} }`);
  }

  // Constructed stylesheets discard @import. Extract top-level imports before
  // replaceSync, respecting comments/strings/parentheses, and recurse ourselves.
  function removeImports(css) {
    const imports = [];
    let clean = '', start = 0, depth = 0, quote = '';
    for (let i = 0; i < css.length; i++) {
      const char = css[i];
      if (char === '\\') { i++; continue; }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2); i = end < 0 ? css.length : end + 1; continue;
      }
      if (char === '{') depth++;
      else if (char === '}') depth--;
      if (depth || css.slice(i, i + 7).toLowerCase() !== '@import' || /[\w-]/.test(css[i + 7] || '')) continue;
      let end = i + 7, parentheses = 0, quoted = '';
      for (; end < css.length; end++) {
        const next = css[end];
        if (next === '\\') { end++; continue; }
        if (quoted) { if (next === quoted) quoted = ''; continue; }
        if (next === '"' || next === "'") quoted = next;
        else if (next === '(') parentheses++;
        else if (next === ')') parentheses--;
        else if (next === ';' && !parentheses) break;
      }
      const statement = css.slice(i + 7, end).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const urlMatch = urls().exec(statement);
      const stringMatch = statement.match(/^(['"])((?:\\.|[^\\])*?)\1/);
      const match = urlMatch?.index === 0 ? urlMatch : stringMatch;
      if (!match) throw fail();
      const url = urlMatch?.index === 0 ? urlMatch[1] ?? urlMatch[2] ?? urlMatch[3] : stringMatch[2];
      const conditions = statement.slice(match[0].length).trim();
      // Layer/supports-qualified imports may include media too. Keep them
      // conservatively; their own font rules are still filtered by used family.
      if (/^(layer|supports)\b/i.test(conditions) || activeMedia(conditions)) imports.push(url);
      clean += css.slice(start, i);
      start = end + 1;
      i = end;
    }
    return { css: clean + css.slice(start), imports };
  }

  async function load(url, depth) {
    if (visitedUrls.has(url)) return;
    if (depth > 16 || ++sheetCount > 128) throw fail();
    visitedUrls.add(url);
    let text;
    try { text = await fetchText(url); } catch { throw fail(); }
    if (typeof text !== 'string' || text.length > 4 * 1024 * 1024) throw fail();
    const parsed = removeImports(text);
    for (const href of parsed.imports) await load(resolve(href, url), depth + 1);
    let sheet;
    try { sheet = new win.CSSStyleSheet(); sheet.replaceSync(parsed.css); } catch { throw fail(); }
    await rules(sheet.cssRules, url, depth);
  }

  async function rules(list, base, depth) {
    for (const rule of list) {
      if (rule.type === 5) await embedFace(rule, base);
      else if (rule.type === 3) {
        if (!activeMedia(rule.media?.mediaText)) continue;
        const href = resolve(rule.href, base);
        let imported;
        try { imported = rule.styleSheet?.cssRules; } catch { /* Fetch opaque CSS below. */ }
        if (imported?.length) {
          if (visitedUrls.has(href)) continue;
          if (depth >= 16 || ++sheetCount > 128) throw fail();
          visitedUrls.add(href);
          await rules(imported, href, depth + 1);
        } else await load(href, depth + 1);
      } else if (rule.cssRules) {
        if (rule.type === 4 && !activeMedia(rule.conditionText || rule.media?.mediaText)) continue;
        if (rule.type === 12 && win.CSS?.supports && !win.CSS.supports(rule.conditionText)) continue;
        if (depth >= 16) throw fail();
        await rules(rule.cssRules, base, depth + 1);
      }
    }
  }

  for (const sheet of [...doc.styleSheets, ...(doc.adoptedStyleSheets || [])]) {
    if (sheet.disabled || visitedSheets.has(sheet) || !activeMedia(sheet.media?.mediaText)) continue;
    visitedSheets.add(sheet);
    let list;
    try { list = sheet.cssRules; } catch { /* Cross-origin stylesheet. */ }
    if (list) {
      if (++sheetCount > 128) throw fail();
      if (sheet.href) visitedUrls.add(sheet.href);
      await rules(list, sheet.href || doc.baseURI, 0);
    } else if (sheet.href) await load(resolve(sheet.href, doc.baseURI), 0);
    else throw fail();
  }
  return output.join('\n');
}
