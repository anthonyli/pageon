"use client";

import { forwardRef } from "react";

const VIEWPORT_WIDTH = { desktop: "100%", tablet: "768px", mobile: "390px" };

/** Editing receives sanitized HTML; interactive previews have an opaque origin. */
export const PreviewFrame = forwardRef(function PreviewFrame({ html, title, viewport = "desktop", interactive = false, onLoad }, ref) {
  return (
    <div className="canvas-grid min-h-0 flex-1 overflow-auto p-5">
      <div
        className="mx-auto h-full min-h-[360px] overflow-hidden rounded-xl bg-white shadow-md"
        style={{ maxWidth: VIEWPORT_WIDTH[viewport] }}
      >
        {/* Recreate the document when HTML changes, including sanitized → interactive initialization. */}
        <iframe
          key={`${interactive ? "preview" : "edit"}:${html}`}
          ref={ref}
          title={title}
          sandbox={interactive ? "allow-scripts" : "allow-same-origin"}
          srcDoc={html}
          className="block h-full min-h-[360px] w-full border-0 bg-white"
          onLoad={onLoad}
        />
      </div>
    </div>
  );
});
