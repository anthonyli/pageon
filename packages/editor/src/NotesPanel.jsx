"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createNoteAnimations, NOTE_ANIMATIONS } from "@pageon/note-animations";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@pageon/ui/select";
import { MessageSquare, RotateCcw, Play, Trash2 } from "lucide-react";
import { ColorPalette } from "@pageon/ui/color-palette-react";
import { Disclosure } from "@pageon/ui/disclosure";
import { Button } from "@pageon/ui/button";
import { FileInput } from "@pageon/ui/file-input";
import { Label } from "@pageon/ui/label";
import { Textarea } from "@pageon/ui/textarea";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@pageon/ui/tooltip";
import { createFloatingPanel } from "@pageon/ui/floating-panel";
import { NOTE_LIMIT, NOTE_MARKER_MODES, readNoteMarkerMode, readNote, readNoteAnimation, readNoteCharacter, readNoteColor, readNoteBubble } from "@pageon/runtime/notes";
import { createNoteTarget } from "@pageon/runtime/note-target";

const animations = createNoteAnimations();

export function NotesPanel({ node, revision, onSave, onMarkerModeChange, t, notice, disabled = false, allowCharacters = true, docked = false, dockedContainer, active = false, onActivate, captureRequest }) {
  const normalizeAnimation = id => !allowCharacters && id === "companion" ? "none" : animations.normalize(id);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [contextText, setContextText] = useState("");
  const [animation, setAnimation] = useState("none");
  const [bubble, setBubble] = useState("");
  const bubbleAppearance = animations.normalizeBubble(bubble);
  const [character, setCharacter] = useState("");
  const [markerMode, setMarkerMode] = useState("auto");
  const savedMarkerMode = readNoteMarkerMode(node?.ownerDocument);
  useEffect(() => { setMarkerMode(savedMarkerMode); }, [node, savedMarkerMode, revision]);
  const [textColor, setTextColor] = useState("");
  const [color, setColor] = useState("#ffcc39");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadVersion = useRef(0);
  const appearance = animations.normalizeCharacter(character);
  const trigger = useRef(null);
  // The Select portal needs the mounted panel on the next render. A ref alone
  // leaves its initial container null until text editing happens to rerender.
  const [panel, setPanel] = useState(null);
  const target = useRef(null), prepared = useRef(null);
  const written = useRef(null), composing = useRef(false);
  const saved = target.current?.read() ?? readNote(node);
  const savedAnimation = normalizeAnimation(target.current?.animation ?? readNoteAnimation(node));
  const savedBubble = target.current?.bubble ?? readNoteBubble(node);
  useEffect(() => { setBubble(savedBubble); }, [node, savedBubble, revision]);
  const savedCharacter = target.current?.character ?? readNoteCharacter(node);
  const savedTextColor = target.current?.textColor || "";
  useEffect(() => { setTextColor(savedTextColor); }, [node, savedTextColor, revision]);
  const savedColor = target.current?.color ?? readNoteColor(node);
  useEffect(() => { setColor(savedColor); }, [node, savedColor, revision]);
  useEffect(() => { setCharacter(savedCharacter); }, [node, savedCharacter, revision]);
  useEffect(() => { uploadVersion.current++; setUploading(false); setImageError(""); return () => { uploadVersion.current++; }; }, [node, open, docked, active]);
  useLayoutEffect(() => { setOpen(false); target.current = null; prepared.current = null; }, [node]);
  useEffect(() => {
    if (saved !== written.current) { written.current = saved; setValue(saved); }
  }, [node, saved, revision]);
  useEffect(() => { setAnimation(savedAnimation); }, [node, savedAnimation, revision]);
  useLayoutEffect(() => {
    if (docked || !open || !panel) return;
    const floating = createFloatingPanel({ panel,
      win: panel.ownerDocument.defaultView, anchor: trigger.current });
    const dismiss = event => {
      const path = event.composedPath();
      if (!path.includes(panel) && !path.includes(trigger.current)) setOpen(false);
    };
    const docs = new Set([panel.ownerDocument, node?.ownerDocument].filter(Boolean));
    docs.forEach(doc => doc.addEventListener('pointerdown', dismiss, true));
    const scroll = event => { if (!panel?.contains(event.target)) setOpen(false); };
    docs.forEach(doc => doc.addEventListener('scroll', scroll, true));
    return () => { floating.destroy(); docs.forEach(doc => { doc.removeEventListener('pointerdown', dismiss, true); doc.removeEventListener('scroll', scroll, true); }); };
  }, [open, node, panel, docked]);
  const close = () => { if (docked) return; setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const loadTarget = next => {
    target.current = next; setContextText(next.text);
    written.current = next.read();
    setBubble(next.bubble); setTextColor(next.textColor); setColor(next.color); setValue(next.read()); setCharacter(next.character); setAnimation(normalizeAnimation(next.animation));
    setMarkerMode(readNoteMarkerMode(node?.ownerDocument));
  };
  useEffect(() => {
    if (!docked || !active) return;
    loadTarget(prepared.current || (captureRequest?.node === node ? captureRequest : createNoteTarget(node)));
    prepared.current = null;
  }, [docked, active, node, captureRequest]);
  useEffect(() => {
    if (!docked || !active || !node) return;
    const doc = node.ownerDocument;
    const capture = () => {
      if (panel?.contains(panel.ownerDocument.activeElement) || doc.getSelection()?.isCollapsed) return;
      loadTarget(createNoteTarget(node));
    };
    doc.addEventListener('selectionchange', capture);
    return () => doc.removeEventListener('selectionchange', capture);
  }, [docked, active, node, panel]);
  const toggle = () => {
    if (!docked && open) { setOpen(false); return; }
    const next = prepared.current || createNoteTarget(node); loadTarget(next);
    prepared.current = docked && !active ? next : null;
    if (docked) onActivate?.(); else setOpen(true);
  };
  const save = (value, effect = animation, config = character, highlight = color, foreground = textColor, bubbleConfig = bubble) => {
    setValue(value);
    if (composing.current) return;
    written.current = value.trim().slice(0, NOTE_LIMIT);
    onSave(value, target.current || createNoteTarget(node, { capture: false }), effect, config, highlight, foreground, bubbleConfig);
  };
  const changeBubble = patch => {
    const config = JSON.stringify(animations.normalizeBubble({ ...bubbleAppearance, ...patch }));
    setBubble(config); save(value, animation, character, color, textColor, config);
  };
  const changeCharacter = patch => {
    uploadVersion.current++; setUploading(false); setImageError("");
    const config = JSON.stringify(animations.normalizeCharacter({ ...appearance, ...patch }));
    setCharacter(config); save(value, animation, config);
  };
  const uploadImage = async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const version = ++uploadVersion.current, selected = target.current;
    setUploading(true); setImageError("");
    try {
      const image = await animations.readImage(file, event.currentTarget.ownerDocument);
      if (version !== uploadVersion.current || selected !== target.current || !selected?.node?.isConnected) return;
      // Read the current note: typing during image decoding must never restore old text.
      const config = JSON.stringify(animations.normalizeCharacter({ ...appearance, id: "custom", image }));
      setCharacter(config); onSave(selected.read(), selected, "companion", config, selected.color, selected.textColor, selected.bubble);
    } catch {
      if (version === uploadVersion.current) setImageError(t("图片无法读取，请选择 2 MB 以内的 PNG、WebP 或 JPG。"));
    } finally { if (version === uploadVersion.current) setUploading(false); }
  };
  const preview = () => {
    const selected = target.current?.node || node, doc = selected?.ownerDocument;
    doc?.dispatchEvent(new doc.defaultView.CustomEvent("pageon:note-preview", { detail: { node: selected } }));
  };
  return <>
    <TooltipProvider delayDuration={250}><Tooltip>
      <TooltipTrigger asChild>
        <Button ref={trigger} size="icon" variant="ghost" className="relative h-8 w-8" aria-label={t("批注")}
          aria-expanded={docked ? active : open} aria-controls={id + "-panel"} disabled={disabled || !node}
          onPointerDown={() => { prepared.current = createNoteTarget(node); }} onClick={toggle}>
          <MessageSquare aria-hidden="true" />
          {saved && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("批注")}</TooltipContent>
    </Tooltip></TooltipProvider>
    {(docked ? active && dockedContainer : open) && createPortal(<section ref={setPanel} id={id + "-panel"} role={docked ? "region" : "dialog"} aria-label={t("批注")}
      data-pageon-extension="" className={docked ? "flex min-w-0 flex-col bg-card text-foreground" : "fixed z-[100] flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"}
      style={docked ? undefined : { top: 8, left: 8, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)", colorScheme: "light",
        "--background": "0 0% 100%", "--foreground": "195 17% 12%", "--input": "195 14% 89%",
        "--muted-foreground": "193 8% 42%", "--accent": "164 38% 95%", "--accent-foreground": "173 88% 26%" }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      {node && <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2" data-note-actions="">
        <TooltipProvider delayDuration={250}>
          <Tooltip><TooltipTrigger asChild><span className="inline-flex">
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("预览效果")} disabled={disabled || !saved || uploading} onClick={preview}><Play aria-hidden="true" className="h-4 w-4" /></Button>
          </span></TooltipTrigger><TooltipContent>{t("预览效果")}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><span className="inline-flex">
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("删除批注")} disabled={disabled || !saved} onClick={() => { save(""); close(); }}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
          </span></TooltipTrigger><TooltipContent>{t("删除批注")}</TooltipContent></Tooltip>
        </TooltipProvider>
        <span className="ml-auto text-xs text-muted-foreground">{value.length} / {NOTE_LIMIT}</span>
      </div>}
      <div className="grid min-h-0 gap-2 overflow-auto p-3">
        {!node ? <p className="text-sm text-muted-foreground">{t("选择页面中的内容以添加批注。")}</p> : <>
          <p className="truncate text-xs text-slate-500">{contextText}</p>
          <Label htmlFor={id}>{t("批注内容")}</Label>
          <Textarea id={id} value={value} rows={2} maxLength={NOTE_LIMIT} disabled={disabled}
            className="min-h-14 max-h-32 resize-y" onChange={event => save(event.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; save(event.currentTarget.value); }} />
          <ColorPalette compact customLabel={t("自定义颜色")} value={color} label={t("批注颜色")} disabled={disabled}
            onChange={shade => { setColor(shade); save(value, animation, character, shade); }} />
          {target.current?.inline && <>
            <Button size="sm" variant="outline" aria-pressed={!textColor} disabled={disabled}
              onClick={() => { setTextColor(""); save(value, animation, character, color, ""); }}><RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />{t("使用原色")}</Button>
            <ColorPalette compact customLabel={t("自定义颜色")} value={textColor} label={t("划选文字颜色")} disabled={disabled}
              onChange={shade => { setTextColor(shade); save(value, animation, character, color, shade); }} />
          </>}
          <Label htmlFor={id + "-animation"}>{t("出现方式")}</Label>
          <Select value={animation} disabled={disabled} onValueChange={effect => { uploadVersion.current++; setUploading(false); setAnimation(effect); save(value, effect); }}>
            <SelectTrigger id={id + "-animation"}><SelectValue /></SelectTrigger>
            <SelectContent container={panel}>
              {NOTE_ANIMATIONS.filter(effect => allowCharacters || effect.id !== "companion").map(effect => <SelectItem key={effect.id} value={effect.id}>{t(effect.label.zh)}</SelectItem>)}
            </SelectContent>
          </Select>
          {animation === "companion" && <Disclosure title={t("角色形象")} defaultOpen={docked}>
            {notice && <p className="text-xs text-muted-foreground">{t("角色形象仅高级导出支持 · 1 Credit")}</p>}
            <Label htmlFor={id + "-character"}>{t("角色形象")}</Label>
            <div className="flex items-center gap-3">
              <img src={animations.characterImage(character)} alt="" className="h-10 w-10 shrink-0" />
              <Select value={appearance.id} disabled={disabled} onValueChange={id => changeCharacter(animations.selectCharacter(character, id))}>
                <SelectTrigger id={id + "-character"}><SelectValue /></SelectTrigger>
                <SelectContent container={panel}>
                  {animations.characters.map(item => <SelectItem key={item.id} value={item.id}>{t(item.label.zh)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {appearance.id !== "custom" ? <ColorPalette compact customLabel={t("自定义颜色")} value={appearance.color} label={t("角色颜色")} disabled={disabled}
              onChange={color => changeCharacter({ color })} /> : <>
              <Label htmlFor={id + "-image"}>{t("上传角色图片")}</Label>
              <FileInput id={id + "-image"} accept="image/png,image/webp,image/jpeg" disabled={disabled || uploading}
                chooseLabel={t("选择图片")} emptyLabel={t(appearance.image ? "已保存自定义图片" : "尚未选择图片")} onChange={uploadImage} />
              <p className="text-xs text-muted-foreground">{t("支持 PNG、WebP、JPG（最大 2 MB），推荐透明背景。图片随 HTML 保存。")}</p>
            </>}
            {uploading && <p role="status" className="text-xs">{t("正在处理图片…")}</p>}
            {imageError && <p role="alert" className="text-xs text-red-600">{imageError}</p>}
            <p className="text-xs text-muted-foreground">{t("随机跳跃、滚动或滑行，停稳后在角色旁显示文字。")}</p>
          </Disclosure>}
          <Disclosure title={t("批注气泡")} defaultOpen={docked}>
            <Label htmlFor={id + "-duration"}>{t("显示时长")}</Label>
            <Select value={String(bubbleAppearance.duration ?? 3)} disabled={disabled} onValueChange={duration => changeBubble({ duration: Number(duration) })}>
              <SelectTrigger id={id + "-duration"}><SelectValue /></SelectTrigger>
              <SelectContent container={panel}>
                {animations.noteDurations.map(item => <SelectItem key={item.id} value={String(item.id)}>{t(item.label.zh)}</SelectItem>)}
              </SelectContent>
            </Select>
            <ColorPalette compact customLabel={t("自定义颜色")} value={bubbleAppearance.background} label={t("气泡背景颜色")} disabled={disabled}
              onChange={background => changeBubble({ background })} />
            <ColorPalette compact customLabel={t("自定义颜色")} value={bubbleAppearance.color} label={t("气泡字体颜色")} disabled={disabled}
              onChange={color => changeBubble({ color })} />
            <Label htmlFor={id + "-bubble-shape"}>{t("气泡形状")}</Label>
            <Select value={bubbleAppearance.shape} disabled={disabled} onValueChange={shape => changeBubble({ shape })}>
              <SelectTrigger id={id + "-bubble-shape"}><SelectValue /></SelectTrigger>
              <SelectContent container={panel}>
                {animations.bubbleShapes.map(shape => <SelectItem key={shape.id} value={shape.id}>{t(shape.label.zh)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Disclosure>
          <Disclosure title={t("更多设置")} defaultOpen={docked}>
          <Label htmlFor={id + "-markers"}>{t("批注标记（整个文档）")}</Label>
          <Select value={markerMode} disabled={disabled} onValueChange={mode => { setMarkerMode(mode); onMarkerModeChange?.(mode, node?.ownerDocument); }}>
            <SelectTrigger id={id + "-markers"}><SelectValue /></SelectTrigger>
            <SelectContent container={panel}>
              {NOTE_MARKER_MODES.map(item => <SelectItem key={item.id} value={item.id}>{t(item.label)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("自动：演示稿预览和播放时隐藏序号，普通文档显示。高亮背景始终保留。")}</p>
          {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
          </Disclosure>

        </>}
      </div>
    </section>, docked ? dockedContainer : trigger.current.ownerDocument.body)}
  </>;
}
