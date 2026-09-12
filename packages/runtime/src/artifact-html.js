function findEditableNode(doc, id) {
  const value = String(id);
  return Array.from(doc.querySelectorAll("[data-artifact-edit]")).find(
    (node) => node.getAttribute("data-artifact-edit") === value,
  );
}

export function applyArtifactDiffs(html, entries = []) {
  if (!html || typeof DOMParser === "undefined") return html || "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  entries.forEach(([id, value]) => {
    const target = findEditableNode(doc, id);
    if (target) target.innerHTML = value;
  });
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

export function createExportHtml(template, entries = []) {
  const doc = new DOMParser().parseFromString(template, "text/html");
  entries.forEach(([id, value]) => {
    const target = findEditableNode(doc, id);
    if (target) target.innerHTML = value;
  });
  doc.querySelectorAll("[data-artifact-edit],[data-artifact-selected]").forEach((node) => {
    node.removeAttribute("data-artifact-edit");
    node.removeAttribute("data-artifact-selected");
    node.removeAttribute("contenteditable");
    node.removeAttribute("spellcheck");
  });
  doc.documentElement.removeAttribute("data-artifact-mode");
  doc.documentElement.removeAttribute("data-pageon-tier");
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

export function downloadHtml(content, filename) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1200);
}

export function outputFilename(filename) {
  const base = (filename || "document")
    .replace(/\.html?$/i, "")
    .replace(/^PageOn-/i, "");
  return `PageOn-${base}.html`;
}
