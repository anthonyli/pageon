"use client";

import { useState } from "react";

export function Disclosure({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group/disclosure -mx-3 border-b border-border">
    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open/disclosure:rotate-0"><path d="m6 9 6 6 6-6" /></svg>
      <span>{title}</span>
    </summary>
    <div className="grid gap-2 px-3 pb-2.5">{children}</div>
  </details>;
}
