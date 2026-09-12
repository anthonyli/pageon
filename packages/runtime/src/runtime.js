import { createDeckEditSession } from "./deck-edit.js";
import { MIT_LICENSE } from "./license.js";
import { RUNTIME_EDIT_STYLE } from "./edit-styles.js";
import { installRuntime } from "./install-runtime.js";

export const RUNTIME_VERSION = "0.2.1";
export const BRAND_URL = "https://pageon.cc";

function labels(lang) {
  return lang === "zh"
      ? {
          edit: "编辑",
          done: "完成",
          save: "保存副本",
          brand: "由 PageOn 编辑",
          move: "拖动工具栏；方向键移动",
          closeNotice: "关闭提示",
          warning: "此页面的动态文字只支持临时修改，暂不支持保存修改结果。“完成”仅退出编辑；“保存副本”也不会把修改写回组件数据。重新渲染或打开文件后，修改可能被原内容覆盖。",
        }
      : {
          edit: "Edit",
          done: "Done",
          save: "Save copy",
          brand: "Made editable with PageOn",
          move: "Drag toolbar; use arrow keys to move",
          closeNotice: "Dismiss notice",
          warning: "Edits to this page's dynamic text are temporary; saving these edits is not supported. Done only exits editing. Save copy does not write edits back to component data. Re-rendering or reopening may overwrite edits with the original content.",
        };
}

function options({ fileName = "document.html", lang = "en", temporaryEdits = false, ui = "floating", shortcuts = true } = {}) {
  if (!["floating", "sidebar", false].includes(ui)) throw new TypeError("invalid-runtime-ui");
  return { fileName: String(fileName), homeUrl: BRAND_URL, temporaryEdits: Boolean(temporaryEdits),
    ui, editStyle: RUNTIME_EDIT_STYLE, shortcuts: Boolean(shortcuts), text: labels(lang), version: RUNTIME_VERSION };
}

/** Self-contained browser script. Brand URL and attribution are not configurable. */
export function createRuntimeCode(input = {}) {
  const config = JSON.stringify(options(input)).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return "/*!\n" + MIT_LICENSE + "*/\n(" + installRuntime.toString() + ")(" + config + "," + createDeckEditSession.toString() + ",document,window);";
}

/** Use the same controller in a trusted document with custom controls. */
export function createRuntime({ document = globalThis.document, onSave, ...input } = {}) {
  if (!document?.defaultView) throw new TypeError("runtime-document-required");
  return installRuntime({ ...options(input), onSave }, createDeckEditSession, document, document.defaultView, createRuntimeCode(input));
}
