"use client";

import * as React from "react";

/**
 * usePopover — 「開いたものを閉じる」の共通部分
 * ================================================================
 * 候補リスト・メニュー・ナビの下ろし物は、見た目も中身も違いますが、
 * **閉じ方の要件は同じ**です。
 *
 *   - 外側を押したら閉じる
 *   - Esc で閉じる（フォーカスは開いた要素へ戻す）
 *   - 画面の下のほうで開いたら、上に出す（画面外に出さない）
 *
 * `AsyncSelect` が個別に持っていたものをここへ出しました。
 * 3 つ目の部品を作るときに、また同じものを書かずに済ませるためです。
 *
 * ```tsx
 * const { anchorRef, placement } = usePopover({ open, onClose: () => setOpen(false) });
 *
 * <div ref={anchorRef} className="relative">
 *   <button onClick={() => setOpen(!open)}>開く</button>
 *   {open && <div className={placement === "above" ? "bottom-full" : "top-full"}>…</div>}
 * </div>
 * ```
 */

/**
 * なぜ閉じたのか。**フォーカスを戻すかどうかがこれで変わります。**
 *
 *   escape  … キーボードで閉じた。開いたボタンへフォーカスを戻す
 *   outside … 別の場所を押した。押した先にフォーカスを譲る（戻すと奪ってしまう）
 */
export type CloseReason = "escape" | "outside";

export interface UsePopoverOptions {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /**
   * 開くものの高さの目安 (px)。既定 260。
   * 下にこれだけ入らなければ上に出します。
   */
  estimatedHeight?: number;
  /** Esc を拾うか。既定 true。 */
  closeOnEscape?: boolean;
  /** 外側を押したら閉じるか。既定 true。 */
  closeOnOutside?: boolean;
}

export interface UsePopoverResult<T extends HTMLElement> {
  /** 「これの外側」の基準になる要素に付けてください。 */
  anchorRef: React.RefObject<T | null>;
  placement: "below" | "above";
}

export function usePopover<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  estimatedHeight = 260,
  closeOnEscape = true,
  closeOnOutside = true,
}: UsePopoverOptions): UsePopoverResult<T> {
  const anchorRef = React.useRef<T>(null);
  const [placement, setPlacement] = React.useState<"below" | "above">("below");

  // onClose の参照が毎回変わっても、購読を張り直さないようにします
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  /* --- 出す向き。開いた瞬間に一度だけ測ります ------------------- */
  React.useEffect(() => {
    if (!open) return;
    const decide = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      setPlacement(below < estimatedHeight && above > below ? "above" : "below");
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, [open, estimatedHeight]);

  /* --- 外側を押したら閉じる --------------------------------------
     click ではなく pointerdown で拾います。click だと、押した先の要素が
     その場で消える場合に「どこを押したか」が取れなくなるためです。 */
  React.useEffect(() => {
    if (!open || !closeOnOutside) return;
    const onDown = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node))
        onCloseRef.current("outside");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, closeOnOutside]);

  /* --- Esc ------------------------------------------------------- */
  React.useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current("escape");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape]);

  return { anchorRef, placement };
}
