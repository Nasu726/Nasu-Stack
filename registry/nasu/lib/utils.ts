import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** class 名を安全に結合します（後勝ちで Tailwind の衝突を解決）。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
