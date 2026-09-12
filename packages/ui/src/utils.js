import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui 的 className 合并工具：clsx + tailwind-merge */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
