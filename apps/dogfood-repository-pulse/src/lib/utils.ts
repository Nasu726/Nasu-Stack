import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** class 名を安全に結合します（後勝ちで Tailwind の衝突を解決）。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 入力欄の見た目。input / textarea / select / 日付 / 補完つき入力で共通です。
 *
 * ここを 1 か所にまとめておかないと、テーマを変えたときに
 * 「この欄だけ枠線が違う」が必ず起きます。とくに `text-base`（16px）は、
 * 忘れると iOS Safari が触れた瞬間に画面を自動拡大し、手動でしか戻せません。
 * 幅の狭い端末だけの問題ではなく iPad でも起きるので、常に 16px 以上にします。
 *
 * 見た目を変えたいときは `className` で上書きしてください（後勝ちです）。
 */
export function inputClass(
  opts: { error?: unknown; className?: ClassValue } = {},
) {
  return cn(
    "w-full rounded-md border bg-card px-3 py-2 text-card-fg",
    "text-base", // ← iOS の自動拡大よけ。下げないでください。
    "placeholder:text-muted-fg",
    "transition-colors disabled:opacity-60",
    opts.error ? "border-danger" : "border-input",
    opts.className,
  );
}
