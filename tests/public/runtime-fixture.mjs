import vm from "node:vm";
import { parseHTML } from "linkedom";
import { createRuntimeCode } from "@pageon/runtime";

export function openRuntime(ui = "floating", html = '<html><head></head><body><h1>Hello</h1><p>World</p></body></html>', extra = {}) {
  const { document, window } = parseHTML(html);
  let shadow;
  let saved;
  const create = document.createElement.bind(document);
  document.createElement = tag => {
    const node = create(tag);
    if (tag === "pageon-runtime") { const attach = node.attachShadow.bind(node); node.attachShadow = options => (shadow = attach(options)); }
    if (tag === "a") node.click = () => {};
    return node;
  };
  const isolatedWindow = { addEventListener() {}, removeEventListener() {}, innerWidth: 1000, innerHeight: 800 };
  const script = document.querySelector("#pageon-local-runtime-script") || document.createElement("script");
  const source = script.textContent || createRuntimeCode({ fileName: "sample.html", ui, ...extra });
  script.id = "pageon-local-runtime-script"; script.textContent = source; document.body.appendChild(script);
  Object.defineProperty(document, "currentScript", { value: script, configurable: true });
  vm.runInNewContext(source, {
    document, window: isolatedWindow, Node: window.Node, MutationObserver: class { observe() {} disconnect() {} },
    queueMicrotask, setTimeout() {}, Blob: class { constructor(parts) { saved = parts.join(""); } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  });
  return { document, shadow, controller: isolatedWindow.PageOnRuntime, saved: () => saved };
}
