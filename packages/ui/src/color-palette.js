// One palette for text, backgrounds, borders, notes and characters.
export const DEFAULT_COLORS = Object.freeze([
  '#bac1d3', '#02b1ff', '#ffcc39', '#dd6adc', '#b6d80d',
  '#fa70ab', '#ff8066', '#02bb9f', '#4678ff', '#a25aff',
]);

// Self-contained when colors are supplied: also embedded in standard HTML.
export function createColorPalette(host, { colors = DEFAULT_COLORS, label, value = '', disabled = false, compact = false, custom = true, customLabel = 'Custom color', allowOpacity = compact, closeOnSelect = true, onOpen, onChange } = {}) {
  const doc = host.ownerDocument;
  const root = doc.createElement('div'); root.className = 'pageon-color-palette'; root.setAttribute('role', 'group');
  const style = doc.createElement('style');
  style.textContent = '.pageon-color-palette{display:block;max-width:100%;color-scheme:light}.pageon-color-palette .pageon-color-swatch{box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;margin:0;padding:4px;border:1px solid #dfe5e7;border-radius:50%;background:#fff;color:#182022;cursor:pointer;font:12px/1 system-ui}.pageon-color-palette .pageon-color-swatch:hover,.pageon-color-palette .pageon-color-swatch[aria-pressed=true]{border-color:#087f73;background:#edf7f5}.pageon-color-palette .pageon-color-swatch:focus-visible{outline:2px solid #159d89;outline-offset:2px}.pageon-color-palette .pageon-color-swatch:disabled{opacity:.5;cursor:default}.pageon-color-palette .pageon-color-swatch span{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;color:#182022}';
  style.textContent += '.pageon-color-palette [hidden]{display:none!important}.pageon-color-palette.is-compact{display:block}.pageon-color-palette .palette-options{display:grid;grid-template-columns:repeat(5,32px);gap:8px}.pageon-color-palette.is-compact .palette-options{margin-top:8px}.pageon-color-palette .palette-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:4px 8px;border:1px solid #dfe5e7;border-radius:6px;background:#fff;color:#182022;cursor:pointer;font:12px/1.4 system-ui}.pageon-color-palette .palette-chip{width:18px;height:18px;border:1px solid #dfe5e7;border-radius:50%;flex-shrink:0}.pageon-color-palette .palette-caption{flex:1;text-align:left}.pageon-color-palette .palette-custom{grid-column:1/-1;display:flex;gap:8px;align-items:center;min-width:0}.pageon-color-palette .palette-picker{position:relative;display:block;width:32px;height:30px;border:1px solid #dfe5e7;border-radius:6px;overflow:hidden;flex-shrink:0}.pageon-color-palette .palette-picker input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.pageon-color-palette .palette-hex{box-sizing:border-box;min-width:0;width:100%;height:30px;padding:4px 6px;border:1px solid #dfe5e7;border-radius:6px;background:#fff;color:#182022;font:12px ui-monospace,monospace}.pageon-color-palette :is(.palette-trigger,.palette-hex):focus-visible,.pageon-color-palette .palette-picker:focus-within{outline:2px solid #159d89;outline-offset:2px}';
  style.textContent += '.pageon-color-palette .palette-chevron{width:16px;height:16px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;color:#647178;transition:transform .15s}.pageon-color-palette .palette-trigger[aria-expanded=true] .palette-chevron{transform:rotate(180deg)}';
  style.textContent += '.pageon-color-palette.is-compact .palette-options{position:fixed;inset:auto;margin:0;z-index:2147483647;box-sizing:border-box;width:256px;max-width:calc(100vw - 24px);padding:12px;overflow:auto;border:1px solid #dfe5e7;border-radius:12px;background:#fff;color:#24312f;box-shadow:0 8px 24px #102b2920;grid-template-columns:repeat(5,minmax(0,1fr))}.pageon-color-palette.is-compact .palette-custom{margin-bottom:4px}.pageon-color-palette.is-compact .palette-picker{width:42px;height:42px;border-radius:10px}.pageon-color-palette .palette-heading{font:500 12px/1.4 system-ui;min-width:0;flex:1}.pageon-color-palette.is-compact .palette-hex{width:86px;flex:none}.pageon-color-palette.is-compact .palette-trigger{height:36px}.pageon-color-palette.is-compact .palette-caption{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}';
  style.textContent += '.pageon-color-palette .opacity-section{grid-column:1/-1;font:12px/1.5 system-ui}.pageon-color-palette .opacity-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px}.pageon-color-palette .opacity-field{display:flex;align-items:center;border:1px solid #dfe5e7;border-radius:8px;padding-right:8px}.pageon-color-palette .opacity-field input{box-sizing:border-box;width:58px;height:28px;min-height:28px;margin:0;padding:4px 6px;border:0;background:transparent;color:inherit;font:inherit;text-align:right}.pageon-color-palette .opacity-slider{display:block;width:100%;height:24px;min-height:24px;padding:0;margin:8px 0 4px;border:0;accent-color:#159d89}.pageon-color-palette .opacity-endpoints{display:flex;justify-content:space-between;color:#6b7a83}.pageon-color-palette .opacity-section input:focus-visible{outline:2px solid #159d89;outline-offset:2px}.pageon-color-palette .palette-chip,.pageon-color-palette .palette-picker{background-image:repeating-conic-gradient(#d1d5db 0% 25%,#fff 0% 50%);background-size:8px 8px}.pageon-color-palette .palette-chip-fill{display:block;width:100%;height:100%;border-radius:inherit}.pageon-color-palette .palette-picker-fill{position:absolute;inset:0}.pageon-color-palette .color-value{display:block;font:11px ui-monospace,monospace;color:#6b7a83;margin-top:3px}';
  root.append(style);
  const trigger = doc.createElement('button'); trigger.type = 'button'; trigger.className = 'palette-trigger'; trigger.hidden = !compact;
  const chip = doc.createElement('span'); chip.className = 'palette-chip'; chip.setAttribute('aria-hidden', 'true');
  const chipFill = doc.createElement('span'); chipFill.className = 'palette-chip-fill'; chip.append(chipFill);
  const caption = doc.createElement('span'); caption.className = 'palette-caption';
  const arrow = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrow.setAttribute('viewBox', '0 0 24 24'); arrow.setAttribute('aria-hidden', 'true'); arrow.setAttribute('class', 'palette-chevron');
  arrow.innerHTML = '<path d="m6 9 6 6 6-6"/>';
  trigger.append(chip, caption, arrow);
  const options = doc.createElement('div'); options.className = 'palette-options'; options.hidden = compact;
  if (compact) root.classList.add('is-compact');
  if (compact) root.append(trigger);
  root.append(options);
  if (compact) { options.setAttribute('popover', 'manual'); options.setAttribute('role', 'dialog'); trigger.setAttribute('aria-haspopup', 'dialog'); }
  const win = doc.defaultView, cleanups = [];
  const position = () => {
    if (!compact || options.hidden) return;
    const rect = trigger.getBoundingClientRect(), box = options.getBoundingClientRect();
    const width = win.innerWidth || 1024, height = win.innerHeight || 768;
    const below = Math.max(0, height - rect.bottom - 20), above = Math.max(0, rect.top - 20);
    const upward = (box.height || 170) > below && above > below;
    options.style.left = Math.max(12, Math.min(rect.left, width - (box.width || 256) - 12)) + 'px';
    options.style.top = (upward ? Math.max(12, rect.top - Math.min(box.height || 170, above) - 8) : Math.max(12, Math.min(rect.bottom + 8, height - 52))) + 'px';
    options.style.maxHeight = Math.max(40, upward ? above : below) + 'px';
  };
  let current = { label, value, disabled, customLabel };
  const collapse = () => {
    if (!compact) return;
    const active = root.getRootNode().activeElement;
    if (active && options.contains(active)) trigger.focus({ preventScroll: true });
    options.hidePopover?.(); options.hidden = true; trigger.setAttribute('aria-expanded', 'false');
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
    if (!open) { collapse(); return; }
    onOpen?.(); options.hidden = false; options.showPopover?.(); trigger.setAttribute('aria-expanded', 'true'); position();
  });
  trigger.setAttribute('aria-expanded', 'false');
  const validColor = value => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value || '');
  const alphaByte = () => allowOpacity && validColor(current.value) && current.value.length === 9 ? current.value.slice(7).toLowerCase() : 'ff';
  const preserveAlpha = color => color.slice(0, 7).toLowerCase() + (alphaByte() === 'ff' ? '' : alphaByte());
  const emit = (color, close = closeOnSelect) => {
    if (!current.disabled) { update({ value: color }); onChange?.(color); if (close) collapse(); }
  };
  const buttons = colors.map(color => {
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'pageon-color-swatch';
    const swatch = doc.createElement('span'); swatch.style.backgroundColor = color; swatch.setAttribute('aria-hidden', 'true'); button.append(swatch);
    button.addEventListener('click', () => { emit(preserveAlpha(color)); });
    options.append(button); return button;
  });
  const customRow = doc.createElement('div'); customRow.className = 'palette-custom'; customRow.hidden = !custom;
  const pickerLabel = doc.createElement('label'); pickerLabel.className = 'palette-picker';
  const pickerFill = doc.createElement('span'); pickerFill.className = 'palette-picker-fill'; pickerLabel.append(pickerFill);
  const picker = doc.createElement('input'); picker.type = 'color'; pickerLabel.append(picker);
  const hex = doc.createElement('input'); hex.type = 'text'; hex.className = 'palette-hex'; hex.placeholder = '#RRGGBB'; hex.maxLength = 9; hex.spellcheck = false;
  const heading = doc.createElement('span'); heading.className = 'palette-heading'; heading.hidden = !compact;
  const headingText = doc.createElement('span'), colorValue = doc.createElement('span'); colorValue.className = 'color-value'; heading.append(headingText, colorValue);
  customRow.append(pickerLabel, heading, hex);
  if (compact) options.prepend(customRow); else options.append(customRow);
  const opacitySection = doc.createElement('div'); opacitySection.className = 'opacity-section'; opacitySection.hidden = !allowOpacity;
  const opacityRow = doc.createElement('div'); opacityRow.className = 'opacity-row';
  const opacityLabel = doc.createElement('label'), opacityField = doc.createElement('div'); opacityField.className = 'opacity-field';
  const opacity = doc.createElement('input'); opacity.type = 'number'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1';
  const percentLabel = doc.createElement('span'); percentLabel.textContent = '%'; opacityField.append(opacity, percentLabel); opacityRow.append(opacityLabel, opacityField);
  const alpha = doc.createElement('input'); alpha.type = 'range'; alpha.className = 'opacity-slider'; alpha.min = '0'; alpha.max = '100'; alpha.step = '1';
  const endpoints = doc.createElement('div'); endpoints.className = 'opacity-endpoints';
  const transparent = doc.createElement('span'), opaque = doc.createElement('span'); endpoints.append(transparent, opaque);
  opacitySection.append(opacityRow, alpha, endpoints); options.append(opacitySection);
  const commitOpacity = () => {
    const number = Number(opacity.value);
    if (!opacity.value.trim() || !Number.isFinite(number) || number < 0 || number > 100) return;
    const rgb = validColor(current.value) ? current.value.slice(0, 7) : '#000000';
    emit(rgb + (number === 100 ? '' : Math.round(number * 255 / 100).toString(16).padStart(2, '0')), false);
  };
  alpha.addEventListener('input', () => { opacity.value = alpha.value; commitOpacity(); });
  opacity.addEventListener('input', commitOpacity);
  opacity.addEventListener('change', () => { commitOpacity(); update(current); });
  opacity.addEventListener('blur', () => update(current));
  opacity.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitOpacity(); update(current); } });
  const listen = (target, type, handler, capture = false) => { target.addEventListener(type, handler, capture); cleanups.push(() => target.removeEventListener(type, handler, capture)); };
  if (compact) {
    for (let boundary = root; boundary;) {
      const scope = boundary.getRootNode() === boundary ? doc : boundary.getRootNode(), visibleHost = boundary;
      listen(scope, 'pointerdown', event => { if (!event.composedPath().includes(visibleHost)) collapse(); }, true);
      boundary = scope.host;
    }
    listen(win, 'resize', position);
    listen(doc, 'scroll', position, true);
  }
  const commit = () => {
    const raw = hex.value.trim(); const value = raw.startsWith('#') ? raw : '#' + raw;
    if (validColor(value)) { emit(value.length === 9 && allowOpacity ? value.toLowerCase() : preserveAlpha(value)); return true; }
    return false;
  };
  picker.addEventListener('input', () => { emit(preserveAlpha(picker.value), false); });
  picker.addEventListener('change', () => { emit(preserveAlpha(picker.value)); });
  hex.addEventListener('change', () => { if (!commit()) update(current); });
  hex.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); if (!commit()) update(current); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); update(current); collapse(); trigger.focus(); }
  });
  const update = next => {
    current = { ...current, ...next };
    root.setAttribute('aria-label', current.label); headingText.textContent = current.label; options.setAttribute('aria-label', current.label);
    trigger.setAttribute('aria-label', current.label); trigger.disabled = picker.disabled = hex.disabled = alpha.disabled = opacity.disabled = !!current.disabled;
    if (current.disabled) collapse();
    const color = validColor(current.value) ? current.value.toLowerCase() : '';
    const zh = current.customLabel === '自定义颜色';
    opacityLabel.textContent = zh ? '不透明度' : 'Opacity';
    opacity.setAttribute('aria-label', current.label + (zh ? ' 不透明度百分比' : ' opacity percent'));
    alpha.setAttribute('aria-label', current.label + (zh ? ' 不透明度' : ' opacity'));
    transparent.textContent = zh ? '完全透明' : 'Transparent'; opaque.textContent = zh ? '不透明' : 'Opaque';
    const percent = Math.round(parseInt(alphaByte(), 16) / 255 * 100);
    opacity.value = alpha.value = String(percent); alpha.setAttribute('aria-valuetext', percent + '%');
    colorValue.textContent = color.toUpperCase();
    chipFill.style.backgroundColor = color || 'transparent'; caption.textContent = current.label;
    picker.value = color.slice(0, 7) || '#000000'; pickerFill.style.backgroundColor = color || '#ffffff';
    picker.setAttribute('aria-label', current.label + ' · ' + current.customLabel);
    pickerLabel.title = current.customLabel; hex.setAttribute('aria-label', current.label + ' HEX'); hex.value = color;

    buttons.forEach((button, index) => {
      const active = String(current.value).slice(0, 7).toLowerCase() === colors[index];
      button.disabled = !!current.disabled;
      button.setAttribute('aria-label', current.label + ' ' + colors[index]);
      button.setAttribute('aria-pressed', String(active));
      button.firstChild.textContent = active ? '✓' : '';
    });
  };
  host.append(root); update(current);
  return { root, trigger, panel: options, position, update, collapse, destroy() { collapse(); cleanups.forEach(cleanup => cleanup()); root.remove(); } };
}
