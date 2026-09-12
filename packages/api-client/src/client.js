import { isTransformResult } from "@pageon/protocol/public";

export class PageOnApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "PageOnApiError";
    this.code = code;
    this.status = status;
  }
}

export async function readTransformResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new PageOnApiError(response.ok ? "invalid-response" : "http-error", response.status);
  }
  if (!response.ok) {
    throw new PageOnApiError(
      typeof result?.error === "string" ? result.error : "http-error",
      response.status,
    );
  }
  if (!isTransformResult(result)) throw new PageOnApiError("invalid-response", response.status);
  return result;
}

/** Browser and Node 22+ client. endpoint is the full transform URL or a same-origin path. */
export function createTransformClient({
  endpoint,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 60_000,
} = {}) {
  return {
    async transform(file, { fileName = file.name || "document.html", lang = "en", signal } = {}) {
      const body = new FormData();
      body.append("file", file, fileName);
      body.append("fileName", fileName);
      body.append("lang", lang);
      const timeout = AbortSignal.timeout(timeoutMs);
      const response = await fetchImpl(endpoint, {
        credentials: "omit",
        method: "POST",
        body,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      return readTransformResponse(response);
    },
  };
}
