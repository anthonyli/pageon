import { createRuntimeCode } from "@pageon/runtime";
import { PREVIEW_EDIT_STYLE } from "@pageon/runtime/edit-styles";
import { getDemoHtml } from "@pageon/editor/demo-html";

// Only prepares our fixed, trusted website example. Never accepts uploaded HTML.
export function createDemo(ui = "floating", lang = "en", Parser = globalThis.DOMParser) {
  const doc = new Parser().parseFromString(getDemoHtml(lang), "text/html");
  const nodes = doc.querySelectorAll("main > p, main > h1, .card .metric, .card h2, .card p");
  nodes.forEach((node, index) => node.setAttribute("data-artifact-edit", String(index + 1)));
  const runtime = createRuntimeCode({ fileName: "pageon-editable-demo.html", ui, lang });
  const exportTemplate = `<!doctype html>\n${doc.documentElement.outerHTML}`.replace("</body>", `<script id="pageon-local-runtime-script">${runtime}</script></body>`);
  const style = doc.createElement("style");
  style.id = "pageon-preview-style";
  style.textContent = PREVIEW_EDIT_STYLE;
  doc.head.appendChild(style);
  doc.documentElement.setAttribute("data-artifact-mode", "edit");
  nodes.forEach(node => { node.setAttribute("contenteditable", "true"); node.setAttribute("spellcheck", "true"); });
  return { previewHtml: `<!doctype html>\n${doc.documentElement.outerHTML}`, exportTemplate, transformVersion: 1,
    stats: { editableCount: nodes.length, isolatedScripts: 0, compatibility: { level: "good", scriptCount: 0, externalResourceCount: 0 } } };
}
