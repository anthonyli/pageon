"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "./utils.js";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef(({ className, sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} collisionPadding={collisionPadding}
      className={cn("z-50 max-w-[min(20rem,calc(100vw-1rem))] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md", className)}
      {...props} />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
