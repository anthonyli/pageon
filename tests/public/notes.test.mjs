import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { installNotes, recordNote, readNote, attachNotesRuntime } from "../../packages/runtime/src/notes.js";
import { createExportHtml, applyArtifactDiffs } from "../../packages/runtime/src/artifact-html.js";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const source = '<html lang="en"><head></head><body><section class="slide active"><h1 data-artifact-edit="1" data-pageon-note="First">Title</h1><p data-artifact-edit="2" data-pageon-note="Second">Text</p></section><section class="slide" hidden><p>Next</p></section><section class="slide" hidden><p data-pageon-note="Last">End</p></section></body></html>';
const rectangle = { top: 20, left: 20, bottom: 120, right: 220, width: 200, height: 100 };
function fixture(html = source, search = "") {
  const dom = new JSDOM(html, { url: `https://example.test/slides.html${search}`, pretendToBeVisual: true });
  const { window: win } = dom;
  win.HTMLElement.prototype.getBoundingClientRect = () => rectangle;
  const api = installNotes(win.document, win);
  const key = (value = " ", type = "keydown", options = {}) => {
    const event = new win.KeyboardEvent(type, { key: value, code: value === " " ? "Space" : value, bubbles: true, cancelable: true, ...options });
    (options.target || win.document.body).dispatchEvent(event);
    return event;
  };
  const press = () => { const event = key(); key(" ", "keyup"); return event; };
  const tip = () => win.document.querySelector("pageon-notes")?.shadowRoot.querySelector('[role="status"]');
  return { win, doc: win.document, api, key, press, tip, close() { api.destroy(); win.close(); } };
}

test("notes persist with text edits, escape user content, delete cleanly, and inject once", () => {
  const f = fixture(); const previous = globalThis.DOMParser; globalThis.DOMParser = f.win.DOMParser;
  try {
    const entries = new Map([["1", "Changed title"]]);
    const note = 'Talk about <script>alert("x")</script> & the next topic';
    assert.equal(recordNote(entries, f.doc.querySelector("h1"), note), true);
    assert.deepEqual(entries.get("1"), { html: "Changed title", note });
    const output = createExportHtml(source, [...entries]);
    const parsed = new DOMParser().parseFromString(output, "text/html");
    assert.equal(parsed.querySelector("h1").textContent, "Changed title");
    assert.equal(readNote(parsed.querySelector("h1")), note);
    assert.equal(parsed.querySelectorAll("script").length, 1);
    assert.ok(parsed.querySelector("#pageon-notes-script"));
    assert.equal(parsed.querySelector('[data-artifact-edit]'), null);
    attachNotesRuntime(parsed);
    assert.equal(parsed.querySelectorAll("#pageon-notes-script").length, 1);
    recordNote(entries, f.doc.querySelector("h1"), "");
    const draft = new DOMParser().parseFromString(applyArtifactDiffs(source, [...entries]), "text/html");
    assert.equal(draft.querySelector("h1").hasAttribute("data-pageon-note"), false);
    assert.equal(draft.querySelector("h1").textContent, "Changed title");
  } finally { globalThis.DOMParser = previous; f.close(); }
});

test("Space shows one note per press, consumes all space phases, and delegates only after the last note", () => {
  const f = fixture(); const received = [];
  try {
    let index = 0;
    const slides = [...f.doc.querySelectorAll(".slide")];
    f.doc.addEventListener("keydown", event => {
      received.push(event.key);
      if (event.key === "ArrowRight") index = Math.min(index + 1, slides.length - 1);
      else if (event.key === "ArrowLeft") index = Math.max(index - 1, 0);
      else return;
      slides.forEach((slide, i) => { slide.hidden = i !== index; slide.classList.toggle("active", i === index); });
    });
    assert.equal(f.key().defaultPrevented, true);
    assert.equal(f.tip().textContent, "First");
    assert.equal(f.key(" ", "keydown", { repeat: true }).defaultPrevented, true);
    assert.equal(f.tip().textContent, "First");
    assert.equal(f.key(" ", "keypress").defaultPrevented, true);
    assert.equal(f.key(" ", "keyup").defaultPrevented, true);
    f.press(); assert.equal(f.tip().textContent, "Second"); assert.equal(index, 0);
    f.press(); assert.equal(index, 1); assert.equal(f.tip().hidden, true);
    f.press(); assert.equal(index, 2, "page without notes advances immediately");
    f.press(); assert.equal(f.tip().textContent, "Last"); assert.equal(index, 2);
    assert.equal(f.key("ArrowLeft").defaultPrevented, false);
    f.key("ArrowLeft");
    f.press(); assert.equal(f.tip().textContent, "First", "returning to a page starts its sequence again");
    assert.deepEqual(received, ["ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft"]);
  } finally { f.close(); }
});

test("hiding after 2 seconds does not advance a page or reset note order", async () => {
  const f = fixture();
  try {
    f.press(); assert.equal(f.tip().hidden, false);
    await new Promise(resolve => setTimeout(resolve, 2050));
    assert.equal(f.tip().hidden, true);
    assert.equal(f.doc.querySelector(".slide.active h1").textContent, "Title");
    f.press(); assert.equal(f.tip().textContent, "Second");
  } finally { f.close(); }
});

test("ordinary HTML markers work without taking Space, and hidden targets have no visible markers", () => {
  const f = fixture('<html><body><p data-pageon-note="A note">Article</p><p hidden data-pageon-note="Hidden">Hidden</p></body></html>');
  try {
    assert.equal(f.press().defaultPrevented, false);
    const markers = [...f.doc.querySelector("pageon-notes").shadowRoot.querySelectorAll("button")];
    assert.equal(markers.length, 2); assert.equal(markers[1].hidden, true);
    markers[0].click(); assert.equal(f.tip().textContent, "A note");
  } finally { f.close(); }
});

test('off parameter hides only numbers while keeping highlights and Space cues', () => {
  const f = fixture(source.replace('Title', '<span style="background-color:yellow;color:black">Title</span>'), '?other=1&pageon-notes=off#slide-1');
  try {
    assert.equal(f.doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 0);
    assert.equal(f.doc.querySelector('h1 span').style.backgroundColor, 'yellow');
    assert.equal(f.press().defaultPrevented, true);
    assert.equal(f.tip().textContent, 'First');
    f.press(); assert.equal(f.tip().textContent, 'Second');
    assert.equal(f.key('ArrowRight').defaultPrevented, false);
    f.api.refresh();
    assert.equal(f.doc.querySelector('pageon-notes').shadowRoot.querySelectorAll('button').length, 0);
  } finally { f.close(); }
});

test("editing, native controls and modifier shortcuts retain their original keys", () => {
  const f = fixture();
  try {
    for (const tag of ["input", "textarea", "select", "button"]) {
      const target = f.doc.createElement(tag); f.doc.body.append(target);
      assert.equal(f.key(" ", "keydown", { target }).defaultPrevented, false);
    }
    const target = f.doc.querySelector("h1"); target.setAttribute("contenteditable", "true");
    assert.equal(f.key(" ", "keydown", { target }).defaultPrevented, false);
    assert.equal(f.key(" ", "keydown", { ctrlKey: true }).defaultPrevented, false);
    assert.equal(f.key(" ", "keydown", { isComposing: true }).defaultPrevented, false);
    f.doc.documentElement.dataset.artifactLocalEdit = "true";
    assert.equal(f.press().defaultPrevented, false);
    f.api.destroy();
    assert.equal(f.doc.querySelector("pageon-notes"), null);
    assert.equal(f.press().defaultPrevented, false);
  } finally { f.close(); }
});

test("standalone export installs before source scripts, survives reinstallation, and executes no note HTML", async () => {
  const parser = new JSDOM(); const doc = new parser.window.DOMParser().parseFromString(source, "text/html");
  doc.querySelector("h1").setAttribute("data-pageon-note", '<img src=x onerror="window.bad=true">');
  const original = doc.createElement("script"); original.textContent = 'window.nativeKeys=[];window.addEventListener("keydown",e=>window.nativeKeys.push(e.key),true);';
  doc.head.append(original); attachNotesRuntime(doc); const html = doc.documentElement.outerHTML;
  const dom = new JSDOM(html, { url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.getBoundingClientRect = () => rectangle; } });
  try {
    await new Promise(resolve => dom.window.addEventListener("load", resolve, { once: true }));
    dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }));
    assert.equal(dom.window.nativeKeys.length, 0);
    const tip = dom.window.document.querySelector("pageon-notes").shadowRoot.querySelector('[role="status"]');
    assert.equal(tip.querySelector("img"), null);
    assert.match(tip.textContent, /onerror/);
    installNotes(dom.window.document, dom.window);
    assert.equal(dom.window.document.querySelectorAll("pageon-notes").length, 1);
    assert.equal(dom.window.bad, undefined);
  } finally { dom.window.PageOnNotes.destroy(); dom.window.close(); parser.window.close(); }
});

test("minified production code still emits a self-contained notes script", async () => {
  const result = await build({ entryPoints: [fileURLToPath(new URL('../../packages/runtime/src/notes.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2020', minify: true, supported: { 'template-literal': false } });
  const production = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const parser = new JSDOM(source); production.attachNotesRuntime(parser.window.document);
  const dom = new JSDOM(parser.window.document.documentElement.outerHTML, { url: 'https://example.test/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.getBoundingClientRect = () => rectangle; } });
  try {
    await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
    dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    assert.equal(dom.window.document.querySelector('pageon-notes').shadowRoot.querySelector('[role="status"]').textContent, 'First');
  } finally { dom.window.PageOnNotes?.destroy(); dom.window.close(); parser.window.close(); }
});
