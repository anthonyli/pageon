import test from "node:test";
import { MIT_LICENSE } from "../../packages/runtime/src/license.js";
import assert from "node:assert/strict";
import { openRuntime } from "./runtime-fixture.mjs";
import { parseHTML } from "linkedom";
import { createRuntimeCode, createRuntime } from "@pageon/runtime";


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
