import { createExportHtml } from "./artifact-html.js";

// Adapt browser APIs to opaque-origin srcdoc previews while retaining isolation.
// This helper is only injected into previews, never into downloaded files.
function installPreviewStorage() {
  window.addEventListener("error", (event) => {
    const resource = event.target?.src || event.target?.href;
    window.parent.postMessage({ type: "pageon-preview-error", message: event.message || `Resource failed: ${resource || "unknown"}` }, "*");
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    window.parent.postMessage({ type: "pageon-preview-error", message: String(event.reason?.message || event.reason || "Preview failed") }, "*");
  });
  // A srcdoc inherits the parent's base URL, so History resolves '#1' to the
  // editor URL and rejects it. Keep same-document anchors on about:srcdoc.
  // Use native History for state/cloning/navigation and propagate other errors.
  const history = window.history;
  if (history && window.location?.href.split("#")[0] === "about:srcdoc") {
    for (const method of ["replaceState", "pushState"]) {
      const original = history[method];
      history[method] = function (...args) {
        if (this === history && args.length > 2 && args[2] != null && args[2] !== "") {
          const url = String(args[2]);
          let target;
          let base;
          try {
            base = new URL(document.baseURI);
            target = new URL(url, base);
          } catch {
            // Native History will report invalid URLs normally.
          }
          if (target && base && target.href.split("#")[0] === base.href.split("#")[0]) {
            args[2] = "about:srcdoc" + target.hash;
          }
        }
        return Reflect.apply(original, this, args);
      };
    }
  }
  // Some CDN component libraries read cookies during module initialization,
  // even for unauthenticated prototypes. An opaque origin must not see the
  // host site's cookies; emulate an empty cookie store for this preview only.
  try {
    void document.cookie;
  } catch {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() { return ""; },
      set() {},
    });
  }
  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      window[name].getItem("pageon-preview");
    } catch {
      const values = new Map();
      Object.defineProperty(window, name, {
        configurable: true,
        value: {
          get length() { return values.size; },
          key(index) { return [...values.keys()][index] ?? null; },
          getItem(key) { return values.get(String(key)) ?? null; },
          setItem(key, value) { values.set(String(key), String(value)); },
          removeItem(key) { values.delete(String(key)); },
          clear() { values.clear(); },
        },
      });
    }
  }
}

/** Run only in an iframe sandboxed with allow-scripts, without allow-same-origin. */
export function createInteractivePreviewHtml(template, entries = []) {
  if (!template || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(createExportHtml(template, entries), "text/html");
  doc.querySelectorAll(
    "#pageon-local-runtime-script, #pageon-local-style, pageon-runtime, #pageon-preview-storage",
  ).forEach((node) => node.remove());
  // Keep source scripts, handlers, styles and CDN URLs. The parent must never
  // read or edit this document; editing uses the separate sanitized copy.
  const storage = doc.createElement("script");
  storage.id = "pageon-preview-storage";
  storage.textContent = `(${installPreviewStorage.toString()})();`;
  doc.head.prepend(storage);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
