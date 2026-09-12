import { createRuntimeCode } from "@pageon/runtime";
import { downloadHtml, outputFilename } from "@pageon/runtime/artifact-html";

/** Change interaction layout while preserving the official brand and target. */
export function prepareLocalExport({ html, fileName, ui, lang = "en", temporaryEdits = false }) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.documentElement.removeAttribute("data-pageon-tier");
  doc.querySelectorAll("#pageon-local-runtime-script,pageon-runtime").forEach(node => node.remove());
  const script = doc.createElement("script");
  script.id = "pageon-local-runtime-script";
  script.textContent = createRuntimeCode({ fileName, ui, lang, temporaryEdits });
  doc.body.appendChild(script);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

export function exportLocally(options) {
  downloadHtml(prepareLocalExport(options), outputFilename(options.fileName));
}
