import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@pageon/editor";
import { Languages, ChevronDown } from "lucide-react";
import { Button } from "@pageon/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@pageon/ui/dropdown-menu";
import { createEditorMessages } from "@pageon/editor/messages";
import { translate, readLanguage, rememberLanguage } from "./messages.js";
import { createOpenSourceClient } from "@pageon/api-client/public";
import { OPEN_SOURCE_TRANSFORM_URL, OPEN_SOURCE_HTML_LIMIT } from "@pageon/protocol/public";
import { createDemo } from "./demo.js";
import { exportLocally } from "./export.js";

const configuredEndpoint = import.meta.env.VITE_PAGEON_TRANSFORM_URL || OPEN_SOURCE_TRANSFORM_URL;
const endpoint = new URL(configuredEndpoint, window.location.href).href;
const errors = {
  "rate-limited": "The conversion service is busy. Wait a minute and retry.",
  "too-large": "Please choose an HTML file smaller than 1 MiB.",
  "result-too-large": "The converted document is too large. Try a smaller file.",
  "not-html": "Choose an .html or .htm file.",
  "parse-failed": "This file could not be converted. Your original file is unchanged.",
};

export default function App() {
  const [lang, setLang] = useState(readLanguage);
  const t = (value, values) => translate(value, lang, values);
  const editorMessages = useMemo(() => createEditorMessages(lang), [lang]);
  useEffect(() => {
    rememberLanguage(lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = "PageOn";
  }, [lang]);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [size, setSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [runtimeUi, setRuntimeUi] = useState("floating");
  const controller = useRef(null);
  const dirtyRef = useRef(false);
  const client = useMemo(() => createOpenSourceClient({ endpoint }), []);
  const markDirty = useCallback((value) => { dirtyRef.current = value; setDirty(value); }, []);
  useEffect(() => {
    const beforeUnload = event => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("beforeunload", beforeUnload); controller.current?.abort(); };
  }, []);

  const leaveEditor = () => {
    if (dirtyRef.current && !window.confirm(t("Discard changes that have not been downloaded?"))) return;
    markDirty(false); setFile(null); setSelected(null); setNotice("");
  };
  const choose = candidate => {
    if (controller.current || !candidate) return;
    if (!/\.html?$/i.test(candidate.name)) { setNotice(errors["not-html"]); return; }
    if (candidate.size > OPEN_SOURCE_HTML_LIMIT) { setNotice(errors["too-large"]); return; }
    setSelected(candidate);
    void convert(candidate);
  };
  const convert = async (candidate) => {
    if (!candidate || controller.current) return;
    const current = new AbortController(); controller.current = current;
    setBusy(true); setNotice("");
    try {
      const result = await client.transform(candidate, { signal: current.signal, lang });
      if (current.signal.aborted) return;
      setFile(result); setName(candidate.name); setSize(candidate.size); markDirty(false);
    } catch (error) {
      setNotice(current.signal.aborted ? "Conversion cancelled. Your file is ready to retry." : errors[error.code] || "The conversion service is unavailable. Try again, or use the offline example. The new official endpoint may not be deployed yet.");
    } finally {
      if (controller.current === current) { controller.current = null; setBusy(false); }
    }
  };
  const temporary = file?.stats.editableCount === 0 && (file?.stats.isolatedScripts ?? file?.stats.removedScripts ?? 0) > 0;
  const exportActions = [{ id: "download", label: t("Download HTML"), run: ({ html, fileName }) => {
    exportLocally({ html, fileName, ui: runtimeUi, lang, temporaryEdits: temporary });
    markDirty(false);
    setNotice("Download started. Keep the downloaded file to save your work.");
  } }];

  return <>
    <header className="app-header">
      <a className="brand" href="https://pageon.cc" target="_blank" rel="noreferrer">PageOn<span className="brand-dot" /></a>
      <button className="language-toggle" onClick={() => setLang(value => value === "en" ? "zh" : "en")}
        aria-label={t(lang === "en" ? "Switch to Chinese" : "Switch to English")}
        title={t(lang === "en" ? "Switch to Chinese" : "Switch to English")}>
        <Languages size={16} aria-hidden="true" />{lang === "en" ? "中" : "EN"}
      </button>
      {file && <>{dirty && <span className="header-label">{t("UNSAVED CHANGES")}</span>}<button className="text-button" onClick={leaveEditor}>{t("Open another file")}</button></>}
    </header>
    {notice && <div className="notice" role="status">{typeof notice === "string" ? t(notice) : editorMessages.t(notice.editor)}<button aria-label={t("Dismiss message")} onClick={() => setNotice("")}>×</button></div>}
    {file ? <Editor file={file} fileName={name} fileSize={size} t={editorMessages.t} message={editorMessages.message} onToast={value => setNotice({ editor: value })} exportActions={exportActions}
      exportControls={<DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={t("Export toolbar")}>
            {t("Export toolbar")}: {t(runtimeUi === "floating" ? "Floating" : "Sidebar")}<ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={runtimeUi} onValueChange={setRuntimeUi}>
            <DropdownMenuRadioItem value="floating">{t("Floating")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="sidebar">{t("Sidebar")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>}
      onReplace={leaveEditor} backLabel={t("Open file")} onDirtyChange={markDirty}
      onRequestExport={({ onConfirm }) => {
        if (!temporary || window.confirm(t("This page uses dynamic content. Text edits are temporary and cannot be saved back to component data. Continue downloading?"))) onConfirm();
      }} /> : <main className="start-page">
      <div className="intro">
        <h1>{t("Edit anywhere.")}{lang === "en" && <br />}<span>{t("Keep the page going.")}</span></h1>
        <p className="intro-subtitle">{t("A visual editor for AI-generated HTML.")}</p>
        <p className="intro-copy">{t("Edit pages created by ChatGPT, Claude, Codex and other AI tools without manually changing code. Download your HTML and keep building anywhere.")}</p>
      </div>
      <section className="upload-card" aria-label={t("Open HTML")}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
        <div className="file-icon" aria-hidden="true">&lt;/&gt;</div>
        <h2>{selected ? selected.name : t("Drop your HTML here")}</h2>
        <p>{selected ? `${(selected.size / 1024).toFixed(1)} KiB` : t(".html or .htm · Up to 1 MiB")}</p>
        <div className="upload-actions">
          <label className={`choose-button ${busy ? "is-disabled" : ""}`}>{t("Choose file")}
            <input type="file" accept=".html,.htm,text/html" disabled={busy} onChange={event => { choose(event.target.files[0]); event.target.value = ""; }} />
          </label>
          {busy && <><span role="status">{t("Converting…")}</span><button className="text-button" onClick={() => controller.current?.abort()}>{t("Cancel")}</button></>}
          {selected && !busy && <button className="primary-button" onClick={() => convert(selected)}>{t("Retry conversion")}</button>}
        </div>
        <p className="service-note">{t("Conversion sends your HTML to ")}<a href={new URL(endpoint).origin} target="_blank" rel="noreferrer">{new URL(endpoint).host}</a>{t(". Editing and downloading happen locally.")}</p>
        <p className="endpoint-note">{t("Service:")} {endpoint}</p>
      </section>
      <button className="demo-button" disabled={busy} onClick={() => { setFile(createDemo(runtimeUi, lang)); setName("pageon-editable-demo.html"); setSize(0); setNotice(""); markDirty(false); }}>{t("Try an offline example")} <span aria-hidden="true">↗</span></button>
      <div className="feature-row"><p><b>{t("One file, still editable")}</b><span>{t("Saved HTML includes its editing toolbar.")}</span></p><p><b>{t("Your session stays local")}</b><span>{t("Download before closing or refreshing.")}</span></p><p><b>{t("Make the controls yours")}</b><span>{t("Choose a floating toolbar or a sidebar.")}</span></p></div>
      <footer>{t("Made editable with ")}<a href="https://pageon.cc" target="_blank" rel="noreferrer">PageOn</a>{t(". Brand attribution remains in exported files.")}</footer>
    </main>}
  </>;
}
