"use client";

import { defaultTranslate, defaultMessage } from "./messages.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Monitor, Tablet, Smartphone, PenLine, Play } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@pageon/ui/tabs";
import { Button } from "@pageon/ui/button";
import { PreviewFrame } from "./PreviewFrame.jsx";
import { applyArtifactDiffs, createExportHtml, downloadHtml, outputFilename } from "@pageon/runtime/artifact-html";
import { createInteractivePreviewHtml } from "@pageon/runtime/preview-html";

import { createDeckEditSession } from "@pageon/runtime/deck-edit";

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const EXPORT_CLICK_GUARD_MS = 600;
const EMPTY_DIFF = [];

export default function Editor({
  file,
  fileName,
  fileSize,
  onToast,
  onExported,
  exportActions,
  exportControls,
  onRequestExport,
  onReplace,
  initialDiff = EMPTY_DIFF,
  initialMode = "edit",
  onDraftChange,
  saveStatus,
  backLabel,
  t = defaultTranslate,
  message = defaultMessage,
  onDirtyChange,
}) {
  const iframeRef = useRef(null);
  const deckEditRef = useRef(null);
  const diffRef = useRef(new Map());
  const editableCount = file.stats?.editableCount ?? 0;
  const canEdit = editableCount > 0;
  const startingMode = canEdit ? initialMode : "preview";
  const [mode, setMode] = useState(startingMode);
  const [frameHtml, setFrameHtml] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(startingMode === "preview");
  const [viewport, setViewport] = useState("desktop");
  const [selectedTag, setSelectedTag] = useState(null);
  const [changeCount, setChangeCount] = useState(0);
  const [exportingType, setExportingType] = useState(null);
  const modeRef = useRef(startingMode);
  const exportInFlightRef = useRef(false);
  const exportUnlockTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(exportUnlockTimerRef.current), []);

  useEffect(() => {
    const onPreviewMessage = (event) => {
      if (modeRef.current !== "preview" || event.source !== iframeRef.current?.contentWindow ||
        event.data?.type !== "pageon-preview-error" || typeof event.data.message !== "string") return;
      setPreviewError(event.data.message.slice(0, 500));
      setPreviewLoading(false);
    };
    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, []);

  const applyMode = useCallback(() => {
    modeRef.current = mode;
    if (mode !== "edit") return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    deckEditRef.current?.enter();
    doc.documentElement.dataset.artifactMode = mode;
    doc.querySelectorAll("[data-artifact-edit]").forEach((node) => {
      node.setAttribute("contenteditable", mode === "edit" ? "true" : "false");
    });
  }, [mode]);

  useEffect(() => {
    applyMode();
  }, [applyMode]);

  useEffect(() => {
    diffRef.current = new Map(initialDiff);
    setChangeCount(diffRef.current.size);
    setSelectedTag(null);
    setPreviewError("");
    setPreviewLoading(startingMode === "preview");
    modeRef.current = startingMode;
    setMode(startingMode);
    setFrameHtml(startingMode === "preview"
      ? createInteractivePreviewHtml(file.exportTemplate, initialDiff)
      : applyArtifactDiffs(file.previewHtml, initialDiff));
  }, [file.previewHtml, file.exportTemplate, initialDiff, startingMode]);

  const publishDraft = useCallback(() => {
    onDraftChange?.(Array.from(diffRef.current.entries()));
    if (!onDraftChange) onDirtyChange?.(true);
  }, [onDraftChange, onDirtyChange]);

  useEffect(() => {
    if (!onDraftChange) onDirtyChange?.(changeCount > 0);
  }, [changeCount, onDraftChange, onDirtyChange]);

  const bindFrame = useCallback(() => {
    if (modeRef.current !== "edit") return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    deckEditRef.current = createDeckEditSession(doc);
    doc.documentElement.dataset.artifactMode = modeRef.current;

    doc.addEventListener(
      "click",
      (event) => {
        const link = event.target.closest?.("a[href]");
        if (link) event.preventDefault();
        if (modeRef.current !== "edit") return;
        const editable = event.target.closest?.("[data-artifact-edit]");
        if (!editable) return;
        doc.querySelectorAll('[data-artifact-selected="true"]').forEach((n) => {
          n.removeAttribute("data-artifact-selected");
        });
        editable.setAttribute("data-artifact-selected", "true");
        setSelectedTag(`<${editable.tagName.toLowerCase()}>`);
        // SVG <text> 的 contenteditable 浏览器基本不支持，用覆盖层编辑
        if (editable.tagName.toLowerCase() === "text") {
          event.preventDefault();
          const cs = doc.defaultView.getComputedStyle(editable);
          const rect = editable.getBoundingClientRect();
          const overlay = doc.createElement("div");
          overlay.setAttribute("contenteditable", "true");
          overlay.style.cssText =
            `position:absolute;left:${rect.left + (doc.documentElement.scrollLeft || 0)}px;` +
            `top:${rect.top + (doc.documentElement.scrollTop || 0)}px;z-index:99999;` +
            `min-width:${rect.width}px;min-height:${rect.height}px;box-sizing:border-box;` +
            `outline:1px dashed rgba(31,157,139,.6);background:rgba(31,157,139,.05);` +
            `color:${cs.fill && cs.fill !== "none" ? cs.fill : "#111"};` +
            `font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};` +
            `white-space:pre;line-height:normal;padding:0;border-radius:2px;display:inline-block;`;
          editable.style.visibility = "hidden";
          overlay.textContent = editable.textContent;
          doc.body.appendChild(overlay);
          overlay.focus();
          const range = doc.createRange();
          range.selectNodeContents(overlay);
          const sel = doc.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          const finish = () => {
            editable.textContent = overlay.textContent;
            editable.style.visibility = "";
            diffRef.current.set(editable.dataset.artifactEdit, editable.innerHTML);
            setChangeCount(diffRef.current.size);
            publishDraft();
            overlay.remove();
          };
          overlay.addEventListener("blur", finish);
          overlay.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { e.preventDefault(); overlay.blur(); }
          });
        } else {
          editable.focus();
        }
      },
      true,
    );

    doc.addEventListener("input", (event) => {
      const editable = event.target.closest?.("[data-artifact-edit]");
      if (!editable) return;
      diffRef.current.set(editable.dataset.artifactEdit, editable.innerHTML);
      setChangeCount(diffRef.current.size);
      publishDraft();
    });

    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      doc.querySelectorAll('[data-artifact-selected="true"]').forEach((n) => {
        n.removeAttribute("data-artifact-selected");
      });
      setSelectedTag(null);
    });
  }, [publishDraft]);

  const handleMode = (next) => {
    if (next === mode || (next === "edit" && !canEdit)) return;
    // Blur first so an active SVG text overlay commits before taking the snapshot.
    if (mode === "edit") iframeRef.current?.contentDocument?.activeElement?.blur();
    const entries = Array.from(diffRef.current.entries());
    setPreviewError("");
    setPreviewLoading(next === "preview");
    setFrameHtml(next === "preview"
      ? createInteractivePreviewHtml(file.exportTemplate, entries)
      : applyArtifactDiffs(file.previewHtml, entries));
    modeRef.current = next;
    setMode(next);
    setSelectedTag(null);
  };

  const actions = exportActions || [{ id: "download", label: t("导出文件") }];
  const exportHtml = async (action) => {
    const template = file.exportTemplate;
    if (!template) {
      onToast(t("请先打开一个 HTML 文件"));
      return;
    }
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setExportingType(action.id);
    try {
      if (mode === "edit") iframeRef.current?.contentDocument?.activeElement?.blur();
      const entries = Array.from(diffRef.current.entries());
      const output = createExportHtml(template, entries);
      if (action.run) {
        const result = await action.run({ html: output, template, entries, fileName });
        if (result === false) return;
      } else {
        downloadHtml(output, outputFilename(fileName));
      }
      onExported?.(action.id);

    } catch (error) {
      console.error("export failed:", error);
      onToast(t("导出失败，请重新打开文件后再试"));
    } finally {
      window.clearTimeout(exportUnlockTimerRef.current);
      exportUnlockTimerRef.current = window.setTimeout(() => {
        exportInFlightRef.current = false;
        setExportingType(null);
      }, EXPORT_CLICK_GUARD_MS);
    }
  };

  const compatibility = file.stats?.compatibility;
  const isolatedScripts = file.stats?.isolatedScripts ?? file.stats?.removedScripts ?? 0;
  const requestExport = (action) => {
    if (exportInFlightRef.current) return;
    if (onRequestExport) {
      onRequestExport({ editableCount, hasScripts: isolatedScripts > 0, actionId: action.id, onConfirm: () => exportHtml(action) });
    } else {
      exportHtml(action);
    }
  };
  const unsafeAttributeCount = file.stats?.unsafeAttributeCount ?? 0;
  const embeddedContentCount =
    (compatibility?.canvasCount || 0) + (compatibility?.iframeCount || 0);
  const compatibilityLevel = compatibility?.level || (editableCount ? "good" : "limited");
  const compatibilityLabel = {
    good: t("兼容良好"),
    partial: t("部分兼容"),
    limited: t("兼容受限"),
  }[compatibilityLevel];
  const compatibilityHint = {
    good: t("以静态内容为主，预览和文本编辑的兼容性较好。"),
    partial: t("预览运行原页面脚本；编辑支持静态文字，导出保留原 CDN 和交互。"),
    limited: t("未识别到静态文字，已切换到预览；动态文字暂不支持直接编辑。"),
  }[compatibilityLevel];

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[240px_1fr] max-lg:grid-cols-1">
      <aside className="overflow-y-auto border-r bg-card p-4 max-lg:hidden">
        <div className="mb-3 flex items-center justify-between text-xs uppercase text-muted-foreground">
          <span>{t("当前文件")}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onReplace}>
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel || t("返回")}
          </Button>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">
            HTML
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{fileName}</div>
            <div className="text-xs text-muted-foreground">
              {message("localFileSize", { size: formatBytes(fileSize) })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="flex justify-between text-xs font-medium">
            <span>{t("文档扫描")}</span>
            <b className="text-primary">{compatibilityLabel}</b>
          </div>
          <div className="mt-2 divide-y text-xs">
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("可编辑内容")}</span>
              <span className="font-medium">{editableCount}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("编辑中隔离脚本")}</span>
              <span className="font-medium">{isolatedScripts}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("外部资源")}</span>
              <span className="font-medium">{compatibility?.externalResourceCount || 0}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("Canvas / 嵌入内容")}</span>
              <span className="font-medium">{embeddedContentCount}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("已清理风险属性")}</span>
              <span className="font-medium">{unsafeAttributeCount}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("当前修改")}</span>
              <span className="font-medium">{changeCount}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t("建议大小")}</span>
              <span className="font-medium">≤ 2 MB</span>
            </div>
          </div>
          <p className="mt-2 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
            {compatibilityHint}
          </p>
        </div>

        <div className="mt-4 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">{t(canEdit ? "点击正文即可修改" : "当前文件仅支持预览")}</strong>
          <br />
          {t("编辑静态文字后点击完成，即可预览原页面效果。外部资源需要网络可用。")}
        </div>

        <Button variant="ghost" size="sm" className="mt-4 w-full justify-start" onClick={onReplace}>
          ＋ {t("处理另一个 HTML")}
        </Button>
      </aside>

      <section className="relative flex min-h-[70vh] flex-col max-lg:h-auto">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2">
          <Tabs value={mode} onValueChange={handleMode}>
            <TabsList>
              <TabsTrigger value="edit" disabled={!canEdit} className="gap-1.5"><PenLine className="h-4 w-4" /> {t("编辑")}</TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5"><Play className="h-4 w-4" /> {t(mode === "edit" ? "完成" : "预览")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-3">
            {exportControls}
            {actions.map((action) => (
              <Button key={action.id} variant={action.variant || "outline"} size="sm"
                disabled={!!exportingType} onClick={() => requestExport(action)}>
                {exportingType === action.id ? t("正在生成…") : action.label}
              </Button>
            ))}
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {saveStatus === "saving"
                ? t("正在保存…")
                : saveStatus === "error"
                  ? t("保存失败")
                  : saveStatus
                    ? t("已保存在当前浏览器")
                    : changeCount
                      ? message("pendingChanges", { count: changeCount })
                      : t("尚未修改")}
            </span>
            <div className="flex gap-1">
              {[
                ["desktop", Monitor, t("桌面宽度")],
                ["tablet", Tablet, t("平板宽度")],
                ["mobile", Smartphone, t("手机宽度")],
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => setViewport(key)}
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-md " +
                    (viewport === key
                      ? "bg-secondary text-primary"
                      : "text-muted-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {!canEdit && (
          <p className="border-b bg-secondary/60 px-4 py-2 text-xs text-muted-foreground" role="status">
            {t("未识别到静态文字，已切换到预览；动态文字暂不支持直接编辑。")}
          </p>
        )}

        {mode === "preview" && previewError && (
          <p className="break-words border-b bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
            {t("预览遇到错误：")}{previewError}
          </p>
        )}

        {mode === "preview" && previewLoading && !previewError && (
          <p className="border-b px-4 py-2 text-xs text-muted-foreground" role="status">
            {t("正在加载预览及外部资源…")}
          </p>
        )}

        {frameHtml !== null && <PreviewFrame
          ref={iframeRef}
          html={frameHtml}
          interactive={mode === "preview"}
          title={t("HTML 本地预览")}
          viewport={viewport}
          onLoad={() => {
            if (mode !== "edit") {
              setPreviewLoading(false);
              return;
            }
            bindFrame();
            applyMode();
          }}
        />}

        {selectedTag && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-2 text-xs shadow-md">
            <span className="flex items-center gap-2">
              <i className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t("已选择：")} <b>{selectedTag}</b>
            </span>
            <small className="text-muted-foreground">{t("直接输入即可修改，按 Esc 取消选择")}</small>
          </div>
        )}
      </section>
    </div>
  );
}
