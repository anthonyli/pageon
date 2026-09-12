import test from "node:test";
import assert from "node:assert/strict";
import { translate, readLanguage, rememberLanguage } from "../../apps/playground/src/messages.js";
import { createEditorMessages } from "../../packages/editor/src/messages.js";

test("language defaults to English, persists Chinese, and tolerates blocked storage", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    const values = new Map();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    } });
    assert.equal(readLanguage(), "en");
    rememberLanguage("zh"); assert.equal(readLanguage(), "zh");
    rememberLanguage("en"); assert.equal(readLanguage(), "en");
    rememberLanguage("invalid"); assert.equal(readLanguage(), "en");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    assert.equal(readLanguage(), "en");
    assert.doesNotThrow(() => rememberLanguage("zh"));
    assert.equal(translate("Download HTML", "zh"), "下载 HTML");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("existing notices and interpolated editor messages follow language changes", () => {
  const en = createEditorMessages();
  const zh = createEditorMessages("zh");
  const notice = en.t("导出失败，请重新打开文件后再试");
  assert.equal(zh.t(notice), "导出失败，请重新打开文件后再试");
  assert.equal(en.t(zh.t(notice)), notice);
  assert.equal(en.message("pendingChanges", { count: 2 }), "2 unsaved changes");
  assert.equal(zh.message("pendingChanges", { count: 2 }), "2 处未保存的修改");
  assert.equal(zh.message("localFileSize", { size: "10 KB" }), "本地文件 · 10 KB");
  assert.equal(translate("{size} KiB · Ready to convert", "zh", { size: "1.0" }), "1.0 KiB · 可以开始转换");
  assert.equal(translate("Download HTML"), "Download HTML");
});
