/** Ordinary CORS fetch with byte and time bounds. Never use a proxy/no-cors fallback. */
export async function fetchExportText(win, url, maxBytes = 4_000_000) {
  const controller = new win.AbortController();
  const timer = win.setTimeout(() => controller.abort(), 15000);
  let reader;
  try {
    const response = await win.fetch(url, { credentials: 'same-origin', signal: controller.signal });
    const length = Number(response.headers?.get('content-length'));
    if (!response.ok || length > maxBytes || !response.body?.getReader) throw new Error('assets');
    reader = response.body.getReader();
    const decoder = new win.TextDecoder();
    let total = 0, text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('assets');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    controller.abort();
    win.clearTimeout(timer);
    try { await reader?.cancel(); } catch { /* Already closed or aborted. */ }
    reader?.releaseLock();
  }
}
