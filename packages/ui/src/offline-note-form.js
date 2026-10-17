import { createColorPalette, DEFAULT_COLORS } from "./color-palette.js";
// Dependency-free shared form for the standalone HTML runtime. Keep this
// factory self-contained: exported files embed it without React or a network.
export function createOfflineNoteForm({ document, lang, onChange, onMarkerModeChange, onClose, createFloatingPanel, createNoteTarget, animations, anchor, paletteFactory = createColorPalette, paletteColors = DEFAULT_COLORS }) {
  const zh = lang === 'zh';
  const panel = document.createElement('section');
  panel.className = 'note-form';
  panel.hidden = true;
  const style = document.createElement('style');
  style.textContent = '.note-form{box-sizing:border-box;position:fixed;z-index:2147483647;width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #dfe5e7;border-radius:12px;padding:0;color-scheme:light;background:#fff;color:#182022;box-shadow:0 8px 24px #102b2926;font:13px/1.5 system-ui}.note-form[hidden]{display:none}.note-form .note-body{display:grid;gap:8px;padding:12px;overflow:auto;min-height:0}.note-form label{font-weight:600}.note-form p{margin:0;white-space:normal;line-height:1.5;overflow-wrap:anywhere;font-size:12px;color:#647178}.note-form .note-context{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.note-form textarea{box-sizing:border-box;width:100%;height:64px;min-height:48px;max-height:128px;resize:vertical;border:1px solid #dfe5e7;border-radius:6px;padding:8px;background:#fff;color:#182022;font:14px/1.5 system-ui}.note-form button{box-sizing:border-box;border:1px solid #dfe5e7;border-radius:6px;padding:6px 8px;background:transparent;color:inherit;font:inherit;cursor:pointer}.note-form button:hover{background:#edf7f5}.note-form select{box-sizing:border-box;width:100%;border:1px solid #dfe5e7;border-radius:6px;padding:8px;background:#fff;color:#182022;font:14px/1.5 system-ui}.note-form [hidden]{display:none!important}.note-form .note-character-options{display:grid;gap:8px}.note-form .note-character-row{display:flex;gap:12px;align-items:center}.note-form .note-character-row img{width:40px;height:40px;object-fit:contain}.note-form .note-file{position:relative;display:flex;gap:8px;align-items:center;border:1px solid #dfe5e7;border-radius:6px;padding:8px;overflow:hidden}.note-form .note-file input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.note-form .note-file:focus-within{outline:2px solid #1f9d8b;outline-offset:-2px}.note-form .note-file span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.note-form :is(textarea,button,select):focus-visible{outline:2px solid #1f9d8b;outline-offset:-2px}.note-form :disabled{opacity:.5;cursor:default}@media print{.note-form{display:none!important}}';
  style.textContent += '.note-form summary{cursor:pointer;font-size:12px;padding:4px 0}.note-form summary:focus-visible{outline:2px solid #159d89;outline-offset:2px}.note-form details>label,.note-form details>p{display:block;margin-top:8px}.note-form .note-actions{display:flex;gap:8px}.note-form .note-character-options{padding-top:8px}';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', zh ? '批注' : 'Notes');
  const body = document.createElement('div'); body.className = 'note-body';
  const label = document.createElement('label');
  label.htmlFor = 'pageon-note-text';
  label.textContent = zh ? '批注内容' : 'Note text';
  const context = document.createElement('p');
  context.id = 'pageon-note-context';
  context.className = 'note-context';
  const input = document.createElement('textarea');
  input.id = 'pageon-note-text';
  input.maxLength = 2000;
  input.setAttribute('aria-describedby', context.id);
  const animationLabel = document.createElement('label');
  animationLabel.htmlFor = 'pageon-note-animation';
  animationLabel.textContent = zh ? '出现方式' : 'Entrance animation';
  const animation = document.createElement('select');
  animation.id = 'pageon-note-animation';
  for (const effect of animations.effects) {
    const option = document.createElement('option'); option.value = effect.id;
    option.textContent = effect.label[zh ? 'zh' : 'en']; animation.append(option);
  }
  const selectAnimation = id => {
    const options = [...animation.options];
    options.forEach(option => { option.selected = false; });
    const chosen = options.find(option => option.value === id);
    if (chosen) chosen.selected = true;
  };
  const highlight = document.createElement('div');
  let highlightColor = '#ffcc39';
  const highlightPalette = paletteFactory(highlight, { compact: true, customLabel: zh ? '自定义颜色' : 'Custom color', colors: paletteColors, label: zh ? '批注颜色' : 'Note color',
    onChange: color => { highlightColor = color; renderHighlight(); change(); } });

  const renderHighlight = () => {
    highlight.hidden = !selected;
    highlightPalette.update({ value: highlightColor, disabled: !selected });
  };
  const foreground = document.createElement('div');
  const originalColor = document.createElement('button'); originalColor.type = 'button';
  originalColor.textContent = zh ? '使用原色' : 'Use original color';
  let textColor = '';
  const foregroundPalette = paletteFactory(foreground, { compact: true, customLabel: zh ? '自定义颜色' : 'Custom color', colors: paletteColors, label: zh ? '划选文字颜色' : 'Selected text color',
    onChange: color => { textColor = color; renderForeground(); change(); } });
  foreground.prepend(originalColor);
  const renderForeground = () => {
    foreground.hidden = !target?.inline;
    originalColor.setAttribute('aria-pressed', String(!textColor));
    foregroundPalette.update({ value: textColor, disabled: !selected });
  };
  originalColor.addEventListener('click', () => { textColor = ''; renderForeground(); change(); });
  const characterDetails = document.createElement('details');
  const characterSummary = document.createElement('summary'); characterSummary.textContent = zh ? '角色形象' : 'Character'; characterDetails.append(characterSummary);
  const appearance = document.createElement('div'); appearance.className = 'note-character-options'; appearance.hidden = true; characterDetails.append(appearance);
  const characterLabel = document.createElement('label'); characterLabel.htmlFor = 'pageon-note-character'; characterLabel.textContent = zh ? '角色形象' : 'Character';
  const row = document.createElement('div'); row.className = 'note-character-row';
  const avatar = document.createElement('img'); avatar.alt = '';
  const characterSelect = document.createElement('select'); characterSelect.id = 'pageon-note-character';
  animations.characters.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label[zh ? 'zh' : 'en']; characterSelect.append(option); });
  row.append(avatar, characterSelect);
  const palette = document.createElement('div');
  const characterPalette = paletteFactory(palette, { compact: true, customLabel: zh ? '自定义颜色' : 'Custom color', colors: paletteColors, label: zh ? '角色颜色' : 'Character color', onChange: color => changeCharacter({ color }) });
  const upload = document.createElement('div');
  const fileLabel = document.createElement('label'); fileLabel.htmlFor = 'pageon-note-image'; fileLabel.textContent = zh ? '上传角色图片' : 'Upload character image';
  const fileField = document.createElement('div'); fileField.className = 'note-file';
  const file = document.createElement('input'); file.type = 'file'; file.id = 'pageon-note-image'; file.accept = 'image/png,image/webp,image/jpeg';
  const fileName = document.createElement('span'); fileName.setAttribute('aria-hidden', 'true');
  fileField.append(file, fileName);
  const uploadHint = document.createElement('p'); uploadHint.textContent = zh ? '支持 PNG、WebP、JPG（最大 2 MB），推荐透明背景。图片随 HTML 保存。' : 'PNG, WebP or JPG, up to 2 MB. Transparent backgrounds work best. The image is saved in the HTML.';
  upload.append(fileLabel, fileField, uploadHint);
  const error = document.createElement('p'); error.setAttribute('role', 'status');
  const motionHint = document.createElement('p'); motionHint.textContent = zh ? '随机跳跃、滚动或滑行，停稳后在角色旁显示文字。' : 'A random hop, roll or glide, then text appears beside the character.';
  appearance.append(characterLabel, row, palette, upload, error, motionHint);
  let character = '', uploadVersion = 0;
  const renderCharacter = () => {
    const config = animations.normalizeCharacter(character);
    characterDetails.hidden = appearance.hidden = animation.value !== 'companion';
    [...characterSelect.options].forEach(option => { option.selected = false; });
    [...characterSelect.options].find(option => option.value === config.id).selected = true;
    avatar.src = animations.characterImage(config); palette.hidden = config.id === 'custom'; upload.hidden = config.id !== 'custom';
    characterPalette.update({ value: config.color, disabled: !selected });
    fileName.textContent = zh ? (config.image ? '已保存图片 · 点击替换' : '选择图片') : (config.image ? 'Image saved · Replace' : 'Choose image');
  };
  const invalidateUpload = () => { uploadVersion++; file.disabled = false; error.textContent = ''; };
  const changeCharacter = patch => {
    invalidateUpload(); character = JSON.stringify(animations.normalizeCharacter({ ...animations.normalizeCharacter(character), ...patch })); renderCharacter(); change();
  };
  characterSelect.addEventListener('change', () => changeCharacter(animations.selectCharacter(character, characterSelect.value)));
  file.addEventListener('change', async () => {
    if (!file.files?.[0]) return;
    const version = ++uploadVersion, currentTarget = target;
    file.disabled = true; error.textContent = zh ? '正在处理图片…' : 'Processing image…';
    try {
      const image = await animations.readImage(file.files[0], document);
      if (version !== uploadVersion || target !== currentTarget || !selected?.isConnected) return;
      character = JSON.stringify(animations.normalizeCharacter({ ...animations.normalizeCharacter(character), id: 'custom', image }));
      renderCharacter(); change(); error.textContent = '';
    } catch { if (version === uploadVersion) error.textContent = zh ? '图片无法读取，请选择 2 MB 以内的 PNG、WebP 或 JPG。' : 'Could not read the image. Choose a PNG, WebP or JPG under 2 MB.'; }
    finally { if (version === uploadVersion) { file.disabled = false; file.value = ''; } }
  });
  let bubble = '';
  const bubbleDetails = document.createElement('details');
  const bubbleSummary = document.createElement('summary'); bubbleSummary.textContent = zh ? '批注气泡' : 'Note bubble';
  const bubbleBackground = document.createElement('div'), bubbleForeground = document.createElement('div');
  const bubbleBackgroundPalette = paletteFactory(bubbleBackground, { compact: true, customLabel: zh ? '自定义颜色' : 'Custom color', colors: paletteColors,
    label: zh ? '气泡背景颜色' : 'Bubble background color', onChange: background => changeBubble({ background }) });
  const bubbleForegroundPalette = paletteFactory(bubbleForeground, { compact: true, customLabel: zh ? '自定义颜色' : 'Custom color', colors: paletteColors,
    label: zh ? '气泡字体颜色' : 'Bubble text color', onChange: color => changeBubble({ color }) });
  const bubbleLabel = document.createElement('label'); bubbleLabel.htmlFor = 'pageon-note-bubble-shape'; bubbleLabel.textContent = zh ? '气泡形状' : 'Bubble shape';
  const bubbleShape = document.createElement('select'); bubbleShape.id = bubbleLabel.htmlFor;
  animations.bubbleShapes.forEach(shape => { const option = document.createElement('option'); option.value = shape.id; option.textContent = shape.label[zh ? 'zh' : 'en']; bubbleShape.append(option); });
  const durationLabel = document.createElement('label'); durationLabel.htmlFor = 'pageon-note-duration'; durationLabel.textContent = zh ? '显示时长' : 'Display duration';
  const duration = document.createElement('select'); duration.id = durationLabel.htmlFor;
  animations.noteDurations.forEach(item => { const option = document.createElement('option'); option.value = String(item.id); option.textContent = item.label[zh ? 'zh' : 'en']; duration.append(option); });
  duration.addEventListener('change', () => changeBubble({ duration: Number(duration.value) }));
  const renderBubble = () => {
    const config = animations.normalizeBubble(bubble);
    bubbleBackgroundPalette.update({ value: config.background, disabled: !selected });
    bubbleForegroundPalette.update({ value: config.color, disabled: !selected });
    [...bubbleShape.options].forEach(option => { option.selected = false; });
    [...bubbleShape.options].find(option => option.value === config.shape).selected = true;
    bubbleShape.disabled = duration.disabled = !selected;
    [...duration.options].forEach(option => { option.selected = false; });
    [...duration.options].find(option => option.value === String(config.duration ?? 3)).selected = true;
  };
  const changeBubble = patch => {
    bubble = JSON.stringify(animations.normalizeBubble({ ...animations.normalizeBubble(bubble), ...patch })); renderBubble(); change();
  };
  bubbleShape.addEventListener('change', () => changeBubble({ shape: bubbleShape.value }));
  bubbleDetails.append(bubbleSummary, durationLabel, duration, bubbleBackground, bubbleForeground, bubbleLabel, bubbleShape);
  const more = document.createElement('details'); const moreSummary = document.createElement('summary'); moreSummary.textContent = zh ? '更多设置' : 'More settings'; more.append(moreSummary);
  const markerLabel = document.createElement('label'); markerLabel.htmlFor = 'pageon-note-markers'; markerLabel.textContent = zh ? '批注标记（整个文档）' : 'Note markers (whole document)';
  const markerMode = document.createElement('select'); markerMode.id = markerLabel.htmlFor;
  for (const [value, label] of [['auto', zh ? '自动' : 'Auto'], ['always', zh ? '始终显示' : 'Always show'], ['edit', zh ? '仅编辑时显示' : 'Show only while editing']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; markerMode.append(option);
  }
  const selectMarkerMode = () => {
    const value = document.documentElement.getAttribute('data-pageon-note-markers');
    const mode = ['always', 'edit'].includes(value) ? value : 'auto';
    [...markerMode.options].forEach(option => { option.selected = false; });
    [...markerMode.options].find(option => option.value === mode).selected = true;
  };
  markerMode.addEventListener('change', () => onMarkerModeChange?.(markerMode.value));
  const markerHint = document.createElement('p'); markerHint.textContent = zh ? '自动：演示稿预览和播放时隐藏序号，普通文档显示。高亮背景始终保留。' : 'Auto: hide numbers when previewing or presenting slides; show them in ordinary documents. Highlight backgrounds stay visible.';
  const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'note-preview'; preview.textContent = zh ? '预览效果' : 'Preview';
  preview.addEventListener('click', () => { if (target?.read()) document.dispatchEvent(new document.defaultView.CustomEvent('pageon:note-preview', { detail: { node: target.node } })); });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'note-delete';
  remove.textContent = zh ? '删除批注' : 'Delete note';
  const hint = document.createElement('p');
  hint.textContent = zh ? '修改即时生效；请使用工具栏的保存或保存副本保留到 HTML。' : 'Changes apply immediately. Use Save or Save copy in the toolbar to keep them in the HTML.';
  let selected = null, target = null, lastNote = null, lastAnimation = null;
  const select = node => {
    selectMarkerMode();
    const next = node?.isConnected ? node : null;
    if (selected !== next) { hide(); target = createNoteTarget(next, { capture: false }); }
    const note = target?.read() || '';
    const effect = animations.normalize(target?.animation);
    if (selected === next && lastNote === note && (!note || (lastAnimation === effect && character === (target?.character || '') && highlightColor === target?.color && textColor === target?.textColor && bubble === (target?.bubble || '')))) return;
    selected = next; lastNote = note; lastAnimation = effect;
    bubble = target?.bubble || ''; renderBubble();
    character = target?.character || '';
    highlightColor = target?.color || '#ffcc39'; renderHighlight();
    textColor = target?.textColor || ''; renderForeground();
    selectAnimation(effect); renderCharacter(); animation.disabled = !selected;
    input.disabled = !selected;
    input.value = note;
    remove.disabled = preview.disabled = !note;
    context.textContent = selected
      ? (zh ? '已选择：' : 'Selected: ') + (target?.text || selected.getAttribute('alt') || selected.localName).trim().slice(0, 80)
      : (zh ? '选择元素或划选文字，再点击批注。' : 'Select an element or text, then click Notes.');
  };
  const change = () => {
    if (!selected?.isConnected) { select(null); return; }
    lastNote = input.value.trim().slice(0, 2000);
    lastAnimation = animation.value;
    onChange(selected, input.value.slice(0, 2000), target, animation.value, character, highlightColor, textColor, bubble);
    remove.disabled = preview.disabled = !target?.read();
  };
  input.addEventListener('input', change);
  animation.addEventListener('change', () => { invalidateUpload(); renderCharacter(); change(); });
  remove.addEventListener('click', () => { input.value = ''; change(); dismiss(); });
  for (const summary of [characterSummary, bubbleSummary, moreSummary]) {
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24'); chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<path d="m6 9 6 6 6-6"/>'; summary.prepend(chevron);
  }
  style.textContent += '.note-form summary{display:flex;align-items:center;gap:8px;list-style:none;border-radius:6px;padding:6px}.note-form summary::-webkit-details-marker{display:none}.note-form summary svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transform:rotate(-90deg)}.note-form details[open]>summary svg{transform:none}.note-form summary:focus-visible{outline:2px solid #159d89;outline-offset:-2px}';
  more.append(markerLabel, markerMode, markerHint, hint);
  const actions = document.createElement('div'); actions.className = 'note-actions'; actions.append(preview, remove);
  body.append(label, context, input, highlight, foreground, animationLabel, animation, ...(animations.normalize('companion') === 'companion' ? [characterDetails] : []), bubbleDetails, more, actions);
  panel.append(style, body);
  let floating;
  const hide = () => { invalidateUpload(); highlightPalette.collapse(); foregroundPalette.collapse(); characterPalette.collapse(); bubbleBackgroundPalette.collapse(); bubbleForegroundPalette.collapse(); panel.hidden = true; onClose?.(); };
  const dismiss = () => { hide(); anchor?.focus?.({ preventScroll: true }); };
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); } });
  const cleanups = [];
  let bound = false;
  const outside = event => {
    const path = event.composedPath();
    if (path.includes(panel) || path.includes(anchor)) return;
    const root = panel.getRootNode();
    if (event.currentTarget === document.defaultView && root.host && path.includes(root.host)) return;
    hide();
  };
  const show = (capture = true) => {
    selectMarkerMode();
    if (!selected) return;
    target = createNoteTarget(selected, { capture });
    selectAnimation(animations.normalize(target.animation)); lastAnimation = animation.value;
    bubble = target.bubble; renderBubble();
    character = target.character; renderCharacter();
    highlightColor = target.color; renderHighlight();
    textColor = target.textColor; renderForeground();
    input.value = target.read(); lastNote = input.value; remove.disabled = preview.disabled = !input.value;
    context.textContent = (zh ? '已选择：' : 'Selected: ') + (target.text || selected.getAttribute('alt') || selected.localName).trim().slice(0, 80);
    if (!bound) {
      bound = true;
      for (const root of [document.defaultView, panel.getRootNode()]) {
        root.addEventListener('pointerdown', outside, true);
        cleanups.push(() => root.removeEventListener('pointerdown', outside, true));
      }
    }
    panel.hidden = false;
    floating ||= createFloatingPanel({ panel, win: document.defaultView, anchor });
    floating.refresh();
  };
  select(null);
  return { panel, select, input, show, hide, close: dismiss, refresh: () => floating?.refresh(), destroy: () => { highlightPalette.destroy(); foregroundPalette.destroy(); characterPalette.destroy(); bubbleBackgroundPalette.destroy(); bubbleForegroundPalette.destroy(); invalidateUpload(); floating?.destroy(); cleanups.forEach(fn => fn()); panel.remove(); } };
}
