const english = {
  "Canvas / 嵌入内容": "Canvas / embedded content",
  "HTML 本地预览": "Local HTML preview",
  "以静态内容为主，预览和文本编辑的兼容性较好。": "Mostly static content. Preview and text editing should work well.",
  "保存失败": "Save failed",
  "兼容受限": "Limited compatibility",
  "兼容良好": "Good compatibility",
  "可编辑内容": "Editable content",
  "处理另一个 HTML": "Process another HTML",
  "外部资源": "External resources",
  "完成": "Done",
  "导出失败，请重新打开文件后再试": "Export failed. Reopen the file and try again.",
  "导出文件": "Export file",
  "尚未修改": "No changes yet",
  "已保存在当前浏览器": "Saved in this browser",
  "已清理风险属性": "Unsafe attributes removed",
  "已选择：": "Selected:",
  "平板宽度": "Tablet width",
  "建议大小": "Recommended size",
  "当前修改": "Current changes",
  "当前文件": "Current file",
  "当前文件仅支持预览": "Preview available; direct editing unavailable",
  "手机宽度": "Mobile width",
  "文档扫描": "Document scan",
  "未识别到静态文字，已切换到预览；动态文字暂不支持直接编辑。": "No static text was detected, so preview mode is selected. Direct editing of dynamic text is not supported yet.",
  "桌面宽度": "Desktop width",
  "正在保存…": "Saving…",
  "正在加载预览及外部资源…": "Loading preview and external resources…",
  "正在生成…": "Generating…",
  "点击正文即可修改": "Click body text to edit",
  "直接输入即可修改，按 Esc 取消选择": "Type directly to edit. Press Esc to clear the selection.",
  "编辑": "Edit",
  "编辑中隔离脚本": "Scripts isolated while editing",
  "编辑静态文字后点击完成，即可预览原页面效果。外部资源需要网络可用。": "Edit static text, then click Done to preview the original page. External resources require network access.",
  "请先打开一个 HTML 文件": "Open an HTML file first.",
  "返回": "Back",
  "部分兼容": "Partially compatible",
  "预览": "Preview",
  "预览运行原页面脚本；编辑支持静态文字，导出保留原 CDN 和交互。": "Preview runs the original scripts. Edit static text and export with the original CDN resources and interactions.",
  "预览遇到错误：": "Preview encountered an error: "
};
export function defaultTranslate(value) { return english[value] || value; }
export function defaultMessage(key, values = {}) {
  if (key === "localFileSize") return `Local file · ${values.size}`;
  if (key === "pendingChanges") return `${values.count} unsaved changes`;
  return key;
}

// Accept either language so an existing notification can follow a language change.
const chineseByEnglish = new Map(Object.entries(english).map(([zh, en]) => [en, zh]));
export function createEditorMessages(lang = "en") {
  return {
    t(value) {
      const key = chineseByEnglish.get(value) ?? value;
      return lang === "zh" ? key : defaultTranslate(key);
    },
    message(key, values = {}) {
      if (lang === "zh") {
        if (key === "localFileSize") return `本地文件 · ${values.size}`;
        if (key === "pendingChanges") return `${values.count} 处未保存的修改`;
      }
      return defaultMessage(key, values);
    },
  };
}
