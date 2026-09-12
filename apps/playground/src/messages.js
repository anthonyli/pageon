const chinese = {
  "Export toolbar": "导出工具栏",
  "Floating": "悬浮工具栏",
  "Sidebar": "侧边栏",
  "Switch to Chinese": "切换到中文",
  "Switch to English": "切换到英文",
  "Retry conversion": "重试转换",
  "UNSAVED CHANGES": "有未下载的修改",
  "Open another file": "打开其他文件",
  "Dismiss message": "关闭提示",
  "Open file": "打开文件",
  "Download HTML": "下载 HTML",
  "Discard changes that have not been downloaded?": "放弃尚未下载的修改？",
  "This page uses dynamic content. Text edits are temporary and cannot be saved back to component data. Continue downloading?": "此页面包含动态内容。文字修改仅临时生效，无法写回组件数据。继续下载？",
  "Edit anywhere.": "随处可改，",
  "Keep the page going.": "让页面继续。",
  "A visual editor for AI-generated HTML.": "面向 AI 生成 HTML 的在线可视化编辑器。",
  "Edit pages created by ChatGPT, Claude, Codex and other AI tools without manually changing code. Download your HTML and keep building anywhere.": "无需手动修改代码，即可编辑 ChatGPT、Claude、Codex 等 AI 工具生成的 HTML 页面。下载你的 HTML，随处继续使用和开发。",
  "Open HTML": "打开 HTML",
  "Drop your HTML here": "将 HTML 文件拖到这里",
  ".html or .htm · Up to 1 MiB": ".html 或 .htm · 最大 1 MiB",
  "{size} KiB · Ready to convert": "{size} KiB · 可以开始转换",
  "Choose file": "选择文件",
  "Converting…": "转换中…",
  "Cancel": "取消",
  "Conversion sends your HTML to ": "转换时会将 HTML 发送至 ",
  ". Editing and downloading happen locally.": "。编辑和下载在本地完成。",
  "Service:": "服务地址：",
  "Try an offline example": "试用离线示例",
  "One file, still editable": "一个文件，始终可编辑",
  "Saved HTML includes its editing toolbar.": "下载的 HTML 自带编辑工具栏。",
  "Your session stays local": "当前会话保留在本地",
  "Download before closing or refreshing.": "关闭或刷新前，请先下载文件。",
  "Make the controls yours": "选择喜欢的交互方式",
  "Choose a floating toolbar or a sidebar.": "支持悬浮工具栏或侧边栏。",
  "Made editable with ": "编辑能力由 ",
  ". Brand attribution remains in exported files.": " 提供。导出文件保留品牌标识。",
  "The conversion service is busy. Wait a minute and retry.": "转换服务繁忙，请稍等一分钟后重试。",
  "Please choose an HTML file smaller than 1 MiB.": "请选择不超过 1 MiB 的 HTML 文件。",
  "The converted document is too large. Try a smaller file.": "转换后的文件过大，请尝试较小的文件。",
  "Choose an .html or .htm file.": "请选择 .html 或 .htm 文件。",
  "This file could not be converted. Your original file is unchanged.": "无法转换此文件，原文件未作修改。",
  "Conversion cancelled. Your file is ready to retry.": "已取消转换，可以重新尝试。",
  "The conversion service is unavailable. Try again, or use the offline example. The new official endpoint may not be deployed yet.": "转换服务暂不可用，请重试或使用离线示例。官网的新接口可能尚未部署。",
  "Download started. Keep the downloaded file to save your work.": "已开始下载，请保留下载的文件以保存修改。"
};

export function translate(value, lang = "en", values = {}) {
  const text = lang === "zh" ? (chinese[value] ?? value) : value;
  return text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

const LANGUAGE_KEY = "pageon-editor-language";
export function readLanguage() {
  try { return globalThis.localStorage?.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en"; }
  catch { return "en"; }
}
export function rememberLanguage(lang) {
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, lang === "zh" ? "zh" : "en"); }
  catch { /* Language switching also works when browser storage is unavailable. */ }
}
