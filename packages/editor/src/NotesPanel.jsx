"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare } from "lucide-react";
import { Button } from "@pageon/ui/button";
import { Label } from "@pageon/ui/label";
import { Textarea } from "@pageon/ui/textarea";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@pageon/ui/tooltip";
import { createFloatingPanel } from "@pageon/ui/floating-panel";
import { NOTE_LIMIT, readNote } from "@pageon/runtime/notes";
import { createNoteTarget } from "@pageon/runtime/note-target";

export function NotesPanel({ node, revision, onSave, t, notice, disabled = false }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const trigger = useRef(null), panel = useRef(null);
  const target = useRef(null), prepared = useRef(null);
  const written = useRef(null), composing = useRef(false);
  const saved = target.current?.read() ?? readNote(node);
  useLayoutEffect(() => { setOpen(false); target.current = null; prepared.current = null; }, [node]);
  useEffect(() => {
    if (saved !== written.current) { written.current = saved; setValue(saved); }
  }, [node, saved, revision]);
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const floating = createFloatingPanel({ panel: panel.current,
      win: panel.current.ownerDocument.defaultView, anchor: trigger.current });
    const dismiss = event => {
      const path = event.composedPath();
      if (!path.includes(panel.current) && !path.includes(trigger.current)) setOpen(false);
    };
    const docs = new Set([panel.current.ownerDocument, node?.ownerDocument].filter(Boolean));
    docs.forEach(doc => doc.addEventListener('pointerdown', dismiss, true));
    const scroll = event => { if (!panel.current?.contains(event.target)) setOpen(false); };
    docs.forEach(doc => doc.addEventListener('scroll', scroll, true));
    return () => { floating.destroy(); docs.forEach(doc => { doc.removeEventListener('pointerdown', dismiss, true); doc.removeEventListener('scroll', scroll, true); }); };
  }, [open, node]);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const toggle = () => {
    if (open) { setOpen(false); return; }
    target.current = prepared.current || createNoteTarget(node); prepared.current = null;
    setValue(target.current.read()); setOpen(true);
  };
  const save = value => {
    setValue(value);
    if (composing.current) return;
    written.current = value.trim().slice(0, NOTE_LIMIT);
    onSave(value, target.current || createNoteTarget(node, { capture: false }));
  };
  return <>
    <TooltipProvider delayDuration={250}><Tooltip>
      <TooltipTrigger asChild>
        <Button ref={trigger} size="icon" variant="ghost" className="relative h-8 w-8" aria-label={t("批注")}
          aria-expanded={open} aria-controls={id + "-panel"} disabled={disabled || !node}
          onPointerDown={() => { prepared.current = createNoteTarget(node); }} onClick={toggle}>
          <MessageSquare aria-hidden="true" />
          {saved && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("批注")}</TooltipContent>
    </Tooltip></TooltipProvider>
    {open && createPortal(<section ref={panel} id={id + "-panel"} role="dialog" aria-label={t("批注")}
      data-pageon-extension="" className="fixed z-[100] flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"
      style={{ top: 8, left: 8, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)", colorScheme: "light",
        "--background": "0 0% 100%", "--foreground": "195 17% 12%", "--input": "195 14% 89%",
        "--muted-foreground": "193 8% 42%", "--accent": "164 38% 95%", "--accent-foreground": "173 88% 26%" }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <div className="grid min-h-0 gap-2 overflow-auto p-3">
        {!node ? <p className="text-sm text-muted-foreground">{t("选择页面中的内容以添加批注。")}</p> : <>
          <p className="truncate text-xs text-slate-500">{target.current?.text}</p>
          <Label htmlFor={id}>{t("批注内容")}</Label>
          <Textarea id={id} value={value} rows={3} maxLength={NOTE_LIMIT} disabled={disabled}
            className="min-h-20 max-h-44 resize-y" onChange={event => save(event.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; save(event.currentTarget.value); }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={disabled || !saved} onClick={() => { save(""); close(); }}>{t("删除批注")}</Button>
            <span className="text-xs text-muted-foreground">{value.length} / {NOTE_LIMIT}</span>
          </div>
        </>}
        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
        <p className="text-xs text-muted-foreground">{t("点击标记查看；幻灯片按空格逐条显示，每条 2 秒。")}</p>
      </div>
    </section>, trigger.current.ownerDocument.body)}
  </>;
}
