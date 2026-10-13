// Dependency-free shared form for the standalone HTML runtime. Keep this
// factory self-contained: exported files embed it without React or a network.
export function createOfflineNoteForm({ document, lang, onChange, onClose, createFloatingPanel, createNoteTarget, anchor }) {
  const zh = lang === 'zh';
  const panel = document.createElement('section');
  panel.className = 'note-form';
  panel.hidden = true;
  const style = document.createElement('style');
  style.textContent = '.note-form{box-sizing:border-box;position:fixed;z-index:2147483647;width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #dfe5e7;border-radius:12px;padding:0;color-scheme:light;background:#fff;color:#182022;box-shadow:0 8px 24px #102b2926;font:13px/1.5 system-ui}.note-form[hidden]{display:none}.note-form .note-body{display:grid;gap:8px;padding:12px;overflow:auto;min-height:0}.note-form label{font-weight:600}.note-form p{margin:0;white-space:normal;line-height:1.5;overflow-wrap:anywhere;font-size:12px;color:#647178}.note-form .note-context{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.note-form textarea{box-sizing:border-box;width:100%;height:96px;min-height:64px;max-height:180px;resize:vertical;border:1px solid #dfe5e7;border-radius:6px;padding:8px;background:#fff;color:#182022;font:14px/1.5 system-ui}.note-form button{box-sizing:border-box;border:1px solid #dfe5e7;border-radius:6px;padding:6px 8px;background:transparent;color:inherit;font:inherit;cursor:pointer}.note-form button:hover{background:#edf7f5}.note-form :is(textarea,button):focus-visible{outline:2px solid #1f9d8b;outline-offset:-2px}.note-form :disabled{opacity:.5;cursor:default}@media print{.note-form{display:none!important}}';
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
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'note-delete';
  remove.textContent = zh ? '删除批注' : 'Delete note';
  const hint = document.createElement('p');
  hint.textContent = zh ? '修改即时生效；请使用工具栏的保存或保存副本保留到 HTML。' : 'Changes apply immediately. Use Save or Save copy in the toolbar to keep them in the HTML.';
  let selected = null, target = null, lastNote = null;
  const select = node => {
    const next = node?.isConnected ? node : null;
    if (selected !== next) { hide(); target = createNoteTarget(next, { capture: false }); }
    const note = target?.read() || '';
    if (selected === next && lastNote === note) return;
    selected = next; lastNote = note;
    input.disabled = !selected;
    input.value = note;
    remove.disabled = !note;
    context.textContent = selected
      ? (zh ? '已选择：' : 'Selected: ') + (target?.text || selected.getAttribute('alt') || selected.localName).trim().slice(0, 80)
      : (zh ? '选择元素或划选文字，再点击批注。' : 'Select an element or text, then click Notes.');
  };
  const change = () => {
    if (!selected?.isConnected) { select(null); return; }
    lastNote = input.value.trim().slice(0, 2000);
    onChange(selected, input.value.slice(0, 2000), target);
    remove.disabled = !target?.read();
  };
  input.addEventListener('input', change);
  remove.addEventListener('click', () => { input.value = ''; change(); dismiss(); });
  body.append(label, context, input, remove, hint);
  panel.append(style, body);
  let floating;
  const hide = () => { panel.hidden = true; onClose?.(); };
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
    if (!selected) return;
    target = createNoteTarget(selected, { capture });
    input.value = target.read(); lastNote = input.value; remove.disabled = !input.value;
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
  return { panel, select, input, show, hide, close: dismiss, refresh: () => floating?.refresh(), destroy: () => { floating?.destroy(); cleanups.forEach(fn => fn()); panel.remove(); } };
}
