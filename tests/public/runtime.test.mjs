import test from "node:test";
import { MIT_LICENSE } from "../../packages/runtime/src/license.js";
import assert from "node:assert/strict";
import { openRuntime } from "./runtime-fixture.mjs";
import { parseHTML } from "linkedom";
import { createRuntimeCode, createRuntime } from "@pageon/runtime";
import { VISUAL_EXPORT_FACTORY_SOURCE } from "../../packages/runtime/src/visual-export-bundle.js";


test("all interaction layouts retain the official brand and fixed destination", () => {
  for (const ui of ["floating", "sidebar", false]) {
    const page = openRuntime(ui, undefined, { homeUrl: "https://invalid.example", branding: false });
    assert.equal(page.shadow.querySelector("a").getAttribute("href"), "https://pageon.cc");
    assert.ok(page.shadow.querySelector("a").textContent.includes("PageOn"));
    if (ui === false) assert.ok(page.shadow.querySelector("button").hidden);
    page.controller.enterEdit(); page.controller.exitEdit();
    assert.ok(page.shadow.querySelector("a"));
    page.controller.destroy(); page.controller.destroy();
  }
});

test("controller edits, serializes, saves and reopens without a private converter", async () => {
  const page = openRuntime();
  page.controller.enterEdit();
  const nodeId = page.document.querySelector("h1").getAttribute("data-artifact-local-node");
  let changed = 0;
  const off = page.controller.on("change", () => changed++);
  page.controller.apply({ type: "set-text", nodeId, value: "Updated" });
  assert.equal(changed, 1); off();
  const artifact = page.controller.serialize();
  assert.match(artifact.html, /Updated/);
  assert.equal(parseHTML(artifact.html).document.documentElement.hasAttribute("data-artifact-local-edit"), false);
  await page.controller.save();
  const reopened = openRuntime("floating", page.saved());
  assert.equal(reopened.document.querySelector("h1").textContent, "Updated");
  assert.ok(reopened.shadow.querySelector("a"));
  assert.equal(reopened.document.querySelectorAll("#pageon-local-runtime-script").length, 1);
  page.controller.destroy(); reopened.controller.destroy();
});

test("script config is safely embedded and complex text commands are rejected", () => {
  const source = createRuntimeCode({ fileName: '</script><script>alert(1)</script>.html' });
  assert.ok(!source.includes("</script>"));
  const page = openRuntime("floating", '<html><head></head><body><h1>Hello <em>world</em></h1></body></html>');
  page.controller.enterEdit();
  const nodeId = page.document.querySelector("h1").getAttribute("data-artifact-local-node");
  assert.throws(() => page.controller.apply({ type: "set-text", nodeId, value: "replace" }), /unsupported-edit-node/);
  page.controller.destroy();
});

test("custom save uses a single-flight guard and direct mounts serialize the standalone runtime", async () => {
  const { document } = parseHTML('<html><head></head><body><h1>Trusted document</h1></body></html>');
  let calls = 0;
  let rejectSave;
  const runtime = createRuntime({ document, ui: false, onSave: artifact => {
    calls++;
    assert.ok(artifact.html.includes('id="pageon-local-runtime-script"'));
    return new Promise((_, reject) => { rejectSave = reject; });
  } });
  try {
    const first = runtime.save();
    await runtime.save();
    assert.equal(calls, 1);
    rejectSave(new Error("storage-unavailable"));
    await assert.rejects(first, /storage-unavailable/);
    const retry = runtime.save();
    assert.equal(calls, 2);
    rejectSave(new Error("retry-failed"));
    await assert.rejects(retry, /retry-failed/);
  } finally { runtime.destroy(); }
});


test("Chinese runtime controls retain their language and brand after saving and reopening", () => {
  for (const ui of ["floating", "sidebar"]) {
    const page = openRuntime(ui, undefined, { lang: "zh" });
    assert.match([...page.shadow.querySelectorAll("button")].map(button => button.textContent).join(" "), /保存副本/);
    assert.match([...page.shadow.querySelectorAll("button")].map(button => button.textContent).join(" "), /编辑/);
    const reopened = openRuntime(ui, page.controller.serialize().html);
    assert.match([...reopened.shadow.querySelectorAll("button")].map(button => button.textContent).join(" "), /保存副本/);
    assert.equal(reopened.shadow.querySelector("a").getAttribute("href"), "https://pageon.cc");
    page.controller.destroy(); reopened.controller.destroy();
  }
});


test("sidebar and floating toolbars support pointer dragging, keyboard movement and viewport bounds", () => {
  for (const ui of ["sidebar", "floating"]) {
    const page = openRuntime(ui);
    const host = page.document.querySelector("pageon-runtime");
    const handle = page.shadow.querySelector(".drag-handle");
    assert.ok(!handle.hidden);
    assert.ok(!page.shadow.querySelector("style").textContent.includes(".drag-handle{display:none}"));
    let captured = null;
    handle.setPointerCapture = id => { captured = id; };
    handle.hasPointerCapture = id => captured === id;
    handle.releasePointerCapture = () => { captured = null; };
    host.style.left = '600px'; host.style.top = '100px';
    page.shadow.querySelector('.bar').getBoundingClientRect = () => ({ width: 180, height: 150 });
    host.getBoundingClientRect = () => ({ left: parseFloat(host.style.left) || 600, top: parseFloat(host.style.top) || 100, width: 180, height: 150 });
    const pointer = (type, x, y) => {
      const event = new page.document.defaultView.Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y });
      handle.dispatchEvent(event);
    };
    pointer("pointerdown", 610, 110); assert.equal(captured, 1);
    pointer("pointermove", 210, 310);
    assert.equal(host.style.left, "200px"); assert.equal(host.style.top, "300px");
    pointer("pointermove", -1000, 2000);
    assert.equal(host.style.left, "8px"); assert.equal(host.style.top, "642px");
    pointer("pointercancel", -1000, 2000); assert.equal(captured, null);
    pointer("pointermove", 400, 400); assert.equal(host.style.left, "8px");
    const key = new page.document.defaultView.Event("keydown", { bubbles: true, cancelable: true });
    key.key = "ArrowRight"; handle.dispatchEvent(key); assert.equal(host.style.left, "28px");
    page.controller.destroy();
  }
});


test("standalone runtime and saved copies retain the full MIT notice and official branding", async () => {
  assert.ok(createRuntimeCode().startsWith(`/*!\n${MIT_LICENSE}*/`));
  const page = openRuntime();
  page.controller.enterEdit();
  await page.controller.save();
  assert.ok(page.saved().includes(MIT_LICENSE));
  const reopened = openRuntime("floating", page.saved());
  assert.ok(reopened.controller.serialize().html.includes(MIT_LICENSE));
  assert.equal(reopened.shadow.querySelector("a").getAttribute("href"), "https://pageon.cc");
  page.controller.destroy(); reopened.controller.destroy();
});

test("image export can be excluded without losing offline text editing or saved copies", async () => {
  const enabledSource = createRuntimeCode();
  const disabledSource = createRuntimeCode({ imageExport: false });
  assert.match(disabledSource, /"imageExport":false/);
  assert.doesNotMatch(disabledSource, /html-to-image/);
  assert.ok(enabledSource.includes(VISUAL_EXPORT_FACTORY_SOURCE));
  assert.ok(!disabledSource.includes(VISUAL_EXPORT_FACTORY_SOURCE), "omit the renderer, not just its controls");
  for (const ui of ["floating", "sidebar", false]) {
    const page = openRuntime(ui, undefined, { imageExport: false, lang: "zh" });
    let reopened;
    try {
      assert.equal(page.controller.exportImage, undefined);
      assert.equal(page.controller.exportPdf, undefined);
      assert.doesNotMatch([...page.shadow.querySelectorAll("button")].map(button => button.textContent).join(" "), /导出图片|导出 PDF|Export image|Export PDF/);
      assert.equal(page.shadow.querySelector('.file-status[aria-live="polite"]').hidden, true, 'save feedback is available without image export');
      page.controller.enterEdit();
      const nodeId = page.document.querySelector("h1").getAttribute("data-artifact-local-node");
      page.controller.apply({ type: "set-text", nodeId, value: "Still editable offline" });
      await page.controller.save();
      assert.doesNotMatch(page.saved(), /html-to-image/);
      reopened = openRuntime(ui, page.saved());
      assert.equal(reopened.document.querySelector("h1").textContent, "Still editable offline");
      assert.equal(reopened.controller.exportPdf, undefined);
      assert.equal(reopened.shadow.querySelector("a").getAttribute("href"), "https://pageon.cc");
      reopened.controller.enterEdit();
      assert.ok(reopened.document.querySelector("h1").hasAttribute("contenteditable"));
    } finally { page.controller.destroy(); reopened?.controller.destroy(); }
  }
});

test("direct runtime mounts honor the image export capability and serialize it", async () => {
  const { document } = parseHTML('<html><head></head><body><h1>Trusted document</h1></body></html>');
  let saved;
  const runtime = createRuntime({ document, ui: false, imageExport: false, onSave: artifact => { saved = artifact.html; } });
  try {
    assert.equal(runtime.exportImage, undefined);
    assert.equal(runtime.exportPdf, undefined);
    await runtime.save();
    assert.match(saved, /"imageExport":false/);
    assert.doesNotMatch(saved, /html-to-image/);
    assert.equal(parseHTML(saved).document.querySelectorAll("#pageon-local-runtime-script").length, 1);
  } finally { runtime.destroy(); }
});

test("enabled runtime copies keep image and PDF controls when reopened offline", () => {
  const page = openRuntime("floating", undefined, { imageExport: true });
  let reopened;
  try {
    const html = page.controller.serialize().html;
    assert.match(html, /html-to-image/);
    reopened = openRuntime("floating", html);
    assert.equal(typeof reopened.controller.exportImage, "function");
    assert.equal(typeof reopened.controller.exportPdf, "function");
    const buttons = [...reopened.shadow.querySelectorAll("button")].map(button => button.textContent);
    assert.ok(buttons.includes("Export image"));
    assert.ok(buttons.includes("Export PDF"));
  } finally { page.controller.destroy(); reopened?.controller.destroy(); }
});
