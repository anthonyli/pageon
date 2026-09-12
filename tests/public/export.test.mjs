import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
import { createDemo } from "../../apps/playground/src/demo.js";
import { prepareLocalExport } from "../../apps/playground/src/export.js";
import { getDemoHtml } from "@pageon/editor/demo-html";
import { openRuntime } from "./runtime-fixture.mjs";
import { createExportHtml } from "@pageon/runtime/artifact-html";

test("local export preserves second-page edits and reconstructs branded interaction controls", () => {
  const previous = globalThis.DOMParser; globalThis.DOMParser = DOMParser;
  try {
    const demo = { exportTemplate: '<html lang="en"><head></head><body><section><p data-artifact-edit="first">First page</p></section><section><p data-artifact-edit="second">Second page</p></section></body></html>' };
    for (const ui of ["floating", "sidebar"]) for (const lang of ["en", "zh"]) {
      const html = createExportHtml(demo.exportTemplate, [["second", "Saved second page"]], { premium: true });
      assert.ok(!html.includes('data-pageon-tier="premium"'));
      const output = prepareLocalExport({ html, fileName: "demo.html", ui, lang });
      const doc = new DOMParser().parseFromString(output, "text/html");
      assert.match(doc.body.textContent, /Saved second page/);
      assert.equal(doc.querySelectorAll("#pageon-local-runtime-script").length, 1);
      const runtime = doc.querySelector("script").textContent;
      assert.ok(runtime.includes(`"ui":"${ui}"`));
      assert.ok(runtime.includes(lang === "zh" ? '"save":"保存副本"' : '"save":"Save copy"'));
      assert.equal(doc.documentElement.lang, "en", "Toolbar language must not translate the source document");
      assert.ok(runtime.includes('"homeUrl":"https://pageon.cc"'));
    }
  } finally { globalThis.DOMParser = previous; }
});


test("offline sample uses the website content and keeps edit outlines after download and reopen", () => {
  const previous = globalThis.DOMParser; globalThis.DOMParser = DOMParser;
  try {
    const source = new DOMParser().parseFromString(getDemoHtml("zh"), "text/html");
    const demo = createDemo("sidebar", "zh");
    const preview = new DOMParser().parseFromString(demo.previewHtml, "text/html");
    assert.equal(preview.querySelector("main").textContent, source.querySelector("main").textContent);
    assert.equal(preview.querySelector("style").textContent, source.querySelector("style").textContent);
    assert.match(preview.querySelector("#pageon-preview-style").textContent, /outline:1px dashed/);
    assert.equal(demo.stats.editableCount, 12);
    const id = preview.querySelector("h1").getAttribute("data-artifact-edit");
    const html = prepareLocalExport({ html: createExportHtml(demo.exportTemplate, [[id, "Changed title"]]), fileName: "sample.html", ui: "sidebar", lang: "zh" });
    const page = openRuntime("sidebar", html);
    assert.equal(page.document.querySelector("h1").textContent, "Changed title");
    page.controller.enterEdit();
    assert.equal(page.document.querySelectorAll('html[data-artifact-local-edit="true"] [data-artifact-local-node]').length, 12);
    assert.match(page.document.querySelector("#pageon-local-style").textContent, /outline:1px dashed/);
    const reopened = openRuntime("sidebar", page.controller.serialize().html);
    reopened.controller.enterEdit();
    assert.equal(reopened.document.querySelectorAll("#pageon-local-style").length, 1);
    assert.match(reopened.document.querySelector("#pageon-local-style").textContent, /outline:1px dashed/);
    reopened.controller.exitEdit();
    assert.equal(reopened.document.querySelector('[data-artifact-local-edit="true"]'), null);
    page.controller.destroy(); reopened.controller.destroy();
  } finally { globalThis.DOMParser = previous; }
});

test("website and offline examples follow the entry language and exports retain localized content", () => {
  const previous = globalThis.DOMParser; globalThis.DOMParser = DOMParser;
  try {
    assert.equal(getDemoHtml(), getDemoHtml("en"));
    for (const lang of ["en", "zh"]) {
      const source = new DOMParser().parseFromString(getDemoHtml(lang), "text/html");
      const demo = createDemo("floating", lang);
      const preview = new DOMParser().parseFromString(demo.previewHtml, "text/html");
      assert.equal(preview.documentElement.lang, lang === "zh" ? "zh-CN" : "en");
      assert.equal(preview.querySelector("main").textContent, source.querySelector("main").textContent);
      assert.equal(preview.title, source.title);
      if (lang === "en") assert.doesNotMatch(preview.querySelector("main").textContent, /[\u4e00-\u9fff]/);
      else assert.match(preview.querySelector("h1").textContent, /这一页，不是终点/);
      const html = prepareLocalExport({ html: createExportHtml(demo.exportTemplate), fileName: "demo.html", lang, ui: "floating" });
      const downloaded = openRuntime("floating", html);
      assert.equal(downloaded.document.querySelector("main").textContent, source.querySelector("main").textContent);
      assert.match(downloaded.shadow.querySelector("button").textContent, lang === "zh" ? /编辑/ : /Edit/);
      downloaded.controller.destroy();
    }
  } finally { globalThis.DOMParser = previous; }
});
