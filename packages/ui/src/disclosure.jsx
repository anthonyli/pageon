"use client";

import { useState } from "react";

export function Disclosure({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group/disclosure">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      {Icon && <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />}
      <span className="flex-1">{title}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 -rotate-90 text-muted-foreground transition-transform group-open/disclosure:rotate-0"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="grid gap-2 pb-2">{children}</div>
  </details>;
}
