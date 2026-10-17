// Self-contained: the standard offline runtime embeds this exact function.
export function createNoteTarget(node, { capture = true } = {}) {
  const doc = node?.ownerDocument;
  const normalizeColor = value => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value || "") ? value.toLowerCase() : "#ffcc39";
  const ownerSelector = '[data-artifact-edit],[data-artifact-local-node],[data-artifact-node]';
  const element = value => value?.nodeType === 1 ? value : value?.parentElement;
  const owner = value => element(value)?.closest('[data-artifact-edit],[data-artifact-local-node]') || element(value)?.closest(ownerSelector);
  let selected = node, group = node?.closest?.('[data-pageon-note-range]')?.getAttribute('data-pageon-note-range');
  let segments = [];
  const selection = capture ? doc?.getSelection?.() : null;
  if (selection?.rangeCount && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    if (range.intersectsNode(node) && doc.body.contains(range.commonAncestorContainer) && !element(range.commonAncestorContainer)?.closest('pageon-runtime,pageon-advanced-runtime,[data-pageon-extension]')) {
      const walker = doc.createTreeWalker(range.commonAncestorContainer, 4);
      const texts = range.commonAncestorContainer.nodeType === 3 ? [range.commonAncestorContainer] : [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      segments = texts.filter(text => range.intersectsNode(text) && owner(text) &&
        !text.parentElement.closest('script,style,textarea,select,[data-artifact-no-edit],svg')).map(text => ({
        text, start: text === range.startContainer ? range.startOffset : 0,
        end: text === range.endContainer ? range.endOffset : text.length, original: text.data,
      })).filter(part => part.end > part.start);
      const groups = new Set(segments.map(part => part.text.parentElement.closest('[data-pageon-note-range]')?.getAttribute('data-pageon-note-range')));
      if (groups.size === 1 && !groups.has(undefined)) { group = [...groups][0]; segments = []; }
      else if (segments.length) group = null;
    }
  } else if (capture && selection?.anchorNode && node?.contains(selection.anchorNode)) {
    group ||= element(selection.anchorNode)?.closest('[data-pageon-note-range]')?.getAttribute('data-pageon-note-range');
  }
  const marks = () => group ? [...doc.querySelectorAll('[data-pageon-note-range]')].filter(mark => mark.getAttribute('data-pageon-note-range') === group) : [];
  if (group) selected = marks()[0] || node;
  const api = {
    get node() { return marks()[0] || selected; },
    get inline() { return !!group || segments.length > 0; },
    get text() { return segments.length ? segments.map(part => part.original.slice(part.start, part.end)).join('') : (marks().length ? marks().map(mark => mark.textContent).join('') : selected?.textContent || ''); },
    read() { return segments.length ? '' : ((group ? marks()[0] : selected)?.getAttribute('data-pageon-note') || ''); },
    get animation() { return segments.length ? "none" : ((group ? marks()[0] : selected)?.getAttribute("data-pageon-note-animation") || "none"); },
    get bubble() { return segments.length ? "" : ((group ? marks()[0] : selected)?.getAttribute("data-pageon-note-bubble") || ""); },
    get character() { return segments.length ? "" : ((group ? marks()[0] : selected)?.getAttribute("data-pageon-note-character") || ""); },
    get color() { return normalizeColor(segments.length ? null : (group ? marks()[0] : selected)?.getAttribute("data-pageon-note-color")); },
    get textColor() {
      const value = segments.length ? '' : (group ? marks()[0] : selected)?.getAttribute('data-pageon-note-text-color');
      return /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value || '') ? value.toLowerCase() : '';
    },
    write(value, animation = api.animation, character = api.character, color = api.color, textColor = api.textColor, bubble = api.bubble) {
      bubble = typeof bubble === "string" && bubble.length <= 500 ? bubble : "";
      textColor = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(textColor || '') ? textColor.toLowerCase() : '';
      color = normalizeColor(color);
      const note = String(value || '').trim().slice(0, 2000);
      animation = typeof animation === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(animation) ? animation : "none";
      character = typeof character === "string" && character.length <= 190000 ? character : "";
      const orderAttribute = 'data-pageon-note-order';
      const existingOrder = !segments.length && api.read() ? Number(api.node?.getAttribute(orderAttribute)) : null;
      const order = existingOrder !== null && Number.isSafeInteger(existingOrder) && existingOrder >= 0 ? existingOrder : [...doc.querySelectorAll(`[${orderAttribute}]`)]
        .reduce((next, item) => Math.max(next, (Number(item.getAttribute(orderAttribute)) || 0) + 1), Date.now());
      const writeAnimation = node => {
        if (note) node.setAttribute(orderAttribute, String(order));
        else node.removeAttribute(orderAttribute);
        if (note && bubble) node.setAttribute("data-pageon-note-bubble", bubble);
        else node.removeAttribute("data-pageon-note-bubble");
        if (note) node.setAttribute("data-pageon-note-color", color);
        else node.removeAttribute("data-pageon-note-color");
        if (note && character) node.setAttribute("data-pageon-note-character", character);
        else node.removeAttribute("data-pageon-note-character");
        if (note && animation !== "none") node.setAttribute("data-pageon-note-animation", animation);
        else node.removeAttribute("data-pageon-note-animation");
      };
      if (note === api.read() && animation === api.animation && character === api.character && color === api.color && textColor === api.textColor && bubble === api.bubble && !segments.length) return null;
      if (!note && !api.read()) return null;
      const changed = new Set();
      if (segments.length) {
        if (!note || segments.some(part => !part.text.isConnected || part.text.data !== part.original)) return null;
        group = doc.defaultView?.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        for (const part of segments) {
          const parent = owner(part.text); if (parent) changed.add(parent);
          const text = part.text;
          if (part.end < text.length) text.splitText(part.end);
          const chosen = part.start ? text.splitText(part.start) : text;
          const mark = doc.createElement('span');
          mark.setAttribute('data-pageon-note-range', group);
          // Only the selected text is wrapped; links, emphasis and original
          // element styles stay intact and reappear when the note is removed.
          // Pages often style heading spans as full-width blocks. This new
          // wrapper must behave like the text it replaces, not a page module.
          mark.style.setProperty('all', 'unset', 'important');
          for (const [property, value] of Object.entries({
            display: 'inline', position: 'static', float: 'none',
            width: 'auto', height: 'auto', margin: '0', padding: '0', border: '0',
            font: 'inherit', 'line-height': 'inherit', 'vertical-align': 'baseline',
            'white-space': 'inherit', 'letter-spacing': 'inherit', transform: 'none',
          })) mark.style.setProperty(property, value, 'important');
          chosen.before(mark); mark.append(chosen);
        }
        segments = [];
      }
      if (group) {
        const nodes = marks();
        for (const mark of nodes) {
          const parent = owner(mark.parentElement); if (parent) changed.add(parent);
          if (note) {
            mark.setAttribute('data-pageon-note', note); writeAnimation(mark);
            mark.style.setProperty('background-color', color, 'important');
            if (textColor) mark.setAttribute('data-pageon-note-text-color', textColor);
            else mark.removeAttribute('data-pageon-note-text-color');
            mark.style.setProperty('color', textColor || 'inherit', 'important');
            mark.style.setProperty('-webkit-text-fill-color', textColor || 'inherit', 'important');
          }
          else {
            // Keep the selected text available if the user clears the note
            // and types again without closing the immediate-edit panel.
            const walker = doc.createTreeWalker(mark, 4);
            while (walker.nextNode()) {
              const text = walker.currentNode;
              segments.push({ text, start: 0, end: text.length, original: text.data });
            }
            mark.replaceWith(...mark.childNodes);
          }
        }
        selected = note ? nodes[0] : [...changed][0];
        if (!note) group = null;
        return { inline: true, owners: [...changed], node: selected };
      }
      if (!selected?.isConnected) return null;
      if (note) selected.setAttribute('data-pageon-note', note); else selected.removeAttribute('data-pageon-note');
      writeAnimation(selected);
      return { inline: false, owners: [selected], node: selected };
    },
  };
  return api;
}

export function recordNoteTarget(entries, target, value, animation, character, color, textColor, bubble) {
  const previousBubble = target?.bubble;
  const previousColor = target?.color;
  const previousCharacter = target?.character;
  const previousAnimation = target?.animation;
  const result = target?.write(value, animation, character, color, textColor, bubble);
  if (!result) return false;
  for (const node of result.owners) {
    const id = node.getAttribute('data-artifact-edit') || node.getAttribute('data-artifact-node');
    if (!id) continue;
    const previous = entries.get(id);
    const entry = typeof previous === 'string' ? { html: previous } : previous;
    const patch = result.inline ? { html: node.innerHTML } : { note: node.getAttribute('data-pageon-note') || '', noteOrder: node.getAttribute('data-pageon-note-order') || '' };
    if (!result.inline && (previousAnimation !== 'none' || node.hasAttribute('data-pageon-note-animation') || entry?.noteAnimation)) {
      patch.noteAnimation = target.animation;
    }
    if (!result.inline && (previousCharacter || target.character || entry?.noteCharacter)) patch.noteCharacter = target.character;
    if (!result.inline && (previousColor !== "#ffcc39" || target.color !== "#ffcc39" || entry?.noteColor)) patch.noteColor = target.color;
    if (!result.inline && (previousBubble || target.bubble || entry?.noteBubble)) patch.noteBubble = target.bubble;
    entries.set(id, { ...entry, ...patch });
  }
  return true;
}
