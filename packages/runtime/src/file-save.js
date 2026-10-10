/** Self-contained: also embedded in standalone HTML via Function#toString. */
export function createFileSaver({ window: win, lang, fileName, isDestroyed = () => false, onStatus = () => {} }) {
  const zh = lang === 'zh';
  const labels = zh ? {
    save: '保存', copy: '另存副本', export: '导出',
    choose: '首次保存请在原文件夹中保留当前文件名，并确认覆盖。',
    writing: '正在保存…', saved: '已保存到', cancelled: '已取消保存',
    failed: '保存失败，原文件未确认更新。请重试或另存副本。',
    downloaded: '已下载副本，原文件未更新。',
  } : {
    save: 'Save', copy: 'Save a copy', export: 'Export',
    choose: 'For the first save, keep the current file name in its original folder and confirm replacement.',
    writing: 'Saving…', saved: 'Saved to', cancelled: 'Save cancelled',
    failed: 'Save failed; the original file has not been confirmed updated. Retry or save a copy.',
    downloaded: 'Copy downloaded. The original file was not updated.',
  };
  const canSave = typeof win.showSaveFilePicker === 'function' && win.isSecureContext !== false && (!win.top || win.top === win);
  let handle = null;
  // The URL supplies a suggested name, never authority to access that path.
  let localName = '';
  if (win.location?.protocol === 'file:') {
    try { localName = decodeURIComponent(win.location.pathname.split('/').pop()); } catch { /* Use the selected file name. */ }
  }
  const suggestedName = localName || String(fileName || 'document.html').split(/[\\/]/).pop() || 'document.html';
  const save = async serialize => {
    if (!canSave || isDestroyed()) return false;
    let target = handle;
    if (!target) {
      onStatus(labels.choose);
      try {
        target = await win.showSaveFilePicker({
          id: 'pageon-save-html', suggestedName,
          types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }],
          excludeAcceptAllOption: true,
        });
      } catch (error) {
        if (error.name === 'AbortError') { if (!isDestroyed()) onStatus(labels.cancelled); return false; }
        throw error;
      }
    }
    if (isDestroyed()) return false;
    if (!target) throw new Error(labels.failed);
    // Re-check write permission on every save; handles are session-local.
    if (target.requestPermission && await target.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      const error = new Error(labels.failed); error.name = 'NotAllowedError'; throw error;
    }
    if (isDestroyed()) return false;
    // Obtain permission before serializing: the picker needs user activation.
    const artifact = serialize();
    onStatus(labels.writing);
    let writable;
    try {
      writable = await target.createWritable();
      if (isDestroyed()) { await writable.abort(); return false; }
      await writable.write(artifact.html);
      if (isDestroyed()) { await writable.abort(); return false; }
      await writable.close();
    } catch (error) {
      try { await writable?.abort(); } catch { /* Preserve the original write error. */ }
      throw error;
    }
    handle = target;
    if (!isDestroyed()) onStatus(`${labels.saved} ${target.name || fileName}`);
    return true;
  };
  return { canSave, labels, save };
}
