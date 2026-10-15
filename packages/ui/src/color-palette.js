// One palette for text, backgrounds, borders, notes and characters.
export const DEFAULT_COLORS = Object.freeze([
  '#bac1d3', '#02b1ff', '#ffcc39', '#dd6adc', '#b6d80d',
  '#fa70ab', '#ff8066', '#02bb9f', '#4678ff', '#a25aff',
]);

// Self-contained when colors are supplied: also embedded in standard HTML.
export function createColorPalette(host, { colors = DEFAULT_COLORS, label, value = '', disabled = false, compact = false, custom = true, customLabel = 'Custom color', onChange } = {}) {
  const doc = host.ownerDocument;
  const root = doc.createElement('div'); root.className = 'pageon-color-palette'; root.setAttribute('role', 'group');
  const style = doc.createElement('style');
  style.textContent = '.pageon-color-palette{display:block;max-width:100%;color-scheme:light}.pageon-color-palette .pageon-color-swatch{box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;margin:0;padding:4px;border:1px solid #dfe5e7;border-radius:50%;background:#fff;color:#182022;cursor:pointer;font:12px/1 system-ui}.pageon-color-palette .pageon-color-swatch:hover,.pageon-color-palette .pageon-color-swatch[aria-pressed=true]{border-color:#087f73;background:#edf7f5}.pageon-color-palette .pageon-color-swatch:focus-visible{outline:2px solid #159d89;outline-offset:2px}.pageon-color-palette .pageon-color-swatch:disabled{opacity:.5;cursor:default}.pageon-color-palette .pageon-color-swatch span{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;color:#182022}';
  style.textContent += '.pageon-color-palette [hidden]{display:none!important}.pageon-color-palette.is-compact{display:block}.pageon-color-palette .palette-options{display:grid;grid-template-columns:repeat(5,32px);gap:8px}.pageon-color-palette.is-compact .palette-options{margin-top:8px}.pageon-color-palette .palette-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:4px 8px;border:1px solid #dfe5e7;border-radius:6px;background:#fff;color:#182022;cursor:pointer;font:12px/1.4 system-ui}.pageon-color-palette .palette-chip{width:18px;height:18px;border:1px solid #dfe5e7;border-radius:50%;flex-shrink:0}.pageon-color-palette .palette-caption{flex:1;text-align:left}.pageon-color-palette .palette-custom{grid-column:1/-1;display:flex;gap:8px;align-items:center;min-width:0}.pageon-color-palette .palette-picker{position:relative;display:block;width:32px;height:30px;border:1px solid #dfe5e7;border-radius:6px;overflow:hidden;flex-shrink:0}.pageon-color-palette .palette-picker input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.pageon-color-palette .palette-hex{box-sizing:border-box;min-width:0;width:100%;height:30px;padding:4px 6px;border:1px solid #dfe5e7;border-radius:6px;background:#fff;color:#182022;font:12px ui-monospace,monospace}.pageon-color-palette :is(.palette-trigger,.palette-hex):focus-visible,.pageon-color-palette .palette-picker:focus-within{outline:2px solid #159d89;outline-offset:2px}';
  style.textContent += '.pageon-color-palette .palette-chevron{width:16px;height:16px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;color:#647178;transition:transform .15s}.pageon-color-palette .palette-trigger[aria-expanded=true] .palette-chevron{transform:rotate(180deg)}';
  root.append(style);
  const trigger = doc.createElement('button'); trigger.type = 'button'; trigger.className = 'palette-trigger'; trigger.hidden = !compact;
  const chip = doc.createElement('span'); chip.className = 'palette-chip'; chip.setAttribute('aria-hidden', 'true');
  const caption = doc.createElement('span'); caption.className = 'palette-caption';
  const arrow = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrow.setAttribute('viewBox', '0 0 24 24'); arrow.setAttribute('aria-hidden', 'true'); arrow.setAttribute('class', 'palette-chevron');
  arrow.innerHTML = '<path d="m6 9 6 6 6-6"/>';
  trigger.append(chip, caption, arrow);
  const options = doc.createElement('div'); options.className = 'palette-options'; options.hidden = compact;
  if (compact) root.classList.add('is-compact');
  if (compact) root.append(trigger);
  root.append(options);
  let current = { label, value, disabled, customLabel };
  const collapse = () => {
    if (!compact) return;
    const active = root.getRootNode().activeElement;
    if (active && options.contains(active)) trigger.focus({ preventScroll: true });
    options.hidden = true; trigger.setAttribute('aria-expanded', 'false');
  };
  root.addEventListener('keydown', event => {
    if (compact && !options.hidden && event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); collapse(); trigger.focus({ preventScroll: true });
    }
  });
  trigger.addEventListener('click', () => {
    if (current.disabled) return;
    const open = options.hidden;
    // Only one palette is expanded in an annotation panel.
    root.getRootNode().querySelectorAll('.pageon-color-palette.is-compact .palette-trigger[aria-expanded=true]').forEach(button => { if (button !== trigger) button.click(); });
    options.hidden = !open; trigger.setAttribute('aria-expanded', String(open));
  });
  trigger.setAttribute('aria-expanded', 'false');
  const emit = color => { if (!current.disabled) { onChange?.(color); collapse(); } };
  const buttons = colors.map(color => {
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'pageon-color-swatch';
    const swatch = doc.createElement('span'); swatch.style.backgroundColor = color; swatch.setAttribute('aria-hidden', 'true'); button.append(swatch);
    button.addEventListener('click', () => { emit(color); });
    options.append(button); return button;
  });
  const customRow = doc.createElement('div'); customRow.className = 'palette-custom'; customRow.hidden = !custom;
  const pickerLabel = doc.createElement('label'); pickerLabel.className = 'palette-picker';
  const picker = doc.createElement('input'); picker.type = 'color'; pickerLabel.append(picker);
  const hex = doc.createElement('input'); hex.type = 'text'; hex.className = 'palette-hex'; hex.placeholder = '#RRGGBB'; hex.maxLength = 7; hex.spellcheck = false;
  customRow.append(pickerLabel, hex); options.append(customRow);
  const commit = () => {
    const raw = hex.value.trim(); const value = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-f]{6}$/i.test(value)) { emit(value.toLowerCase()); return true; }
    return false;
  };
  picker.addEventListener('input', () => { if (!current.disabled) onChange?.(picker.value); });
  picker.addEventListener('change', () => { emit(picker.value); });
  hex.addEventListener('change', () => { if (!commit()) update(current); });
  hex.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); if (!commit()) update(current); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); update(current); collapse(); trigger.focus(); }
  });
  const update = next => {
    current = { ...current, ...next };
    root.setAttribute('aria-label', current.label);
    trigger.setAttribute('aria-label', current.label); trigger.disabled = picker.disabled = hex.disabled = !!current.disabled;
    if (current.disabled) collapse();
    const color = /^#[0-9a-f]{6}$/i.test(current.value || '') ? current.value : '';
    chip.style.backgroundColor = color || 'transparent'; caption.textContent = current.label;
    picker.value = color || '#000000'; pickerLabel.style.backgroundColor = color || '#ffffff';
    picker.setAttribute('aria-label', current.label + ' · ' + current.customLabel);
    pickerLabel.title = current.customLabel; hex.setAttribute('aria-label', current.label + ' HEX'); hex.value = color;

    buttons.forEach((button, index) => {
      const active = String(current.value).toLowerCase() === colors[index];
      button.disabled = !!current.disabled;
      button.setAttribute('aria-label', current.label + ' ' + colors[index]);
      button.setAttribute('aria-pressed', String(active));
      button.firstChild.textContent = active ? '✓' : '';
    });
  };
  host.append(root); update(current);
  return { root, update, collapse, destroy() { root.remove(); } };
}
