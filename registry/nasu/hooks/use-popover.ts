"use client";

import * as React from "react";

export type PopoverPlacement = "auto" | "below" | "above";
export type PopoverAlign = "start" | "center" | "end";

/**
 * usePopover — 「開いたものを閉じる」の共通部分
 * ================================================================
 * 候補リスト・メニュー・ナビの下ろし物は、見た目も中身も違いますが、
 * **閉じ方の要件は同じ**です。
 *
 *   - 外側を押したら閉じる
 *   - Esc で閉じる（reason を受けた利用側が、開いた要素へ focus を戻す）
 *   - 画面の下のほうで開いたら、上に出す（画面外に出さない）
 *
 * `AsyncSelect` が個別に持っていたものをここへ出しました。
 * 3 つ目の部品を作るときに、また同じものを書かずに済ませるためです。
 *
 * ```tsx
 * const { anchorRef, floatingRef, floatingStyle, placement } = usePopover({
 *   open,
 *   onClose: () => setOpen(false),
 * });
 *
 * <div ref={anchorRef} className="relative">
 *   <button onClick={() => setOpen(!open)}>開く</button>
 *   {open && (
 *     <div ref={floatingRef} style={floatingStyle}
 *       className={placement === "above" ? "bottom-full" : "top-full"}>
 *       …
 *     </div>
 *   )}
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
   * `floatingRef`を付けない場合に使う高さの目安 (px)。既定 260。
   * refがあれば描画後の実寸を優先します。
   */
  estimatedHeight?: number;
  /** Esc を拾うか。既定 true。 */
  closeOnEscape?: boolean;
  /** 外側を押したら閉じるか。既定 true。 */
  closeOnOutside?: boolean;
  /** 希望する向き。`auto` は実際に空いている側を選びます。既定 auto。 */
  placement?: PopoverPlacement;
  /** anchor に対する横位置。既定 start。 */
  align?: PopoverAlign;
  /** viewport の端から残す余白 (px)。既定 8。 */
  viewportPadding?: number;
  /** anchor と浮かせる要素の間隔 (px)。既定 4。 */
  gap?: number;
}

export interface UsePopoverResult<T extends HTMLElement> {
  /** 「これの外側」の基準になる要素に付けてください。 */
  anchorRef: React.RefObject<T | null>;
  /** 実寸を測るとき、浮かせる要素に付けてください。 */
  floatingRef: React.RefObject<HTMLElement | null>;
  placement: Exclude<PopoverPlacement, "auto">;
  /** viewport 内へ収めるための style。浮かせる要素へ渡します。 */
  floatingStyle: React.CSSProperties;
  /** 中身が遅れて変わったときに、明示的に測り直すための関数。 */
  updatePosition: () => void;
}

interface Position {
  placement: Exclude<PopoverPlacement, "auto">;
  left: number | null;
  maxHeight: number | null;
}

const useBrowserLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function usePopover<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  estimatedHeight = 260,
  closeOnEscape = true,
  closeOnOutside = true,
  placement: preferredPlacement = "auto",
  align = "start",
  viewportPadding = 8,
  gap = 4,
}: UsePopoverOptions): UsePopoverResult<T> {
  const anchorRef = React.useRef<T>(null);
  const floatingRef = React.useRef<HTMLElement>(null);
  const [position, setPosition] = React.useState<Position>({
    placement: preferredPlacement === "above" ? "above" : "below",
    left: null,
    maxHeight: null,
  });

  // onClose の参照が毎回変わっても、購読を張り直さないようにします
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  /* --- 出す向き・viewport edge ----------------------------------
     以前は「高さ 260px と仮定して上下だけを選ぶ」実装でした。
     public component では長い翻訳や任意の中身が来るため、描画後の実寸を測り、
     左右も補正し、入り切らない高さだけをスクロールへ変えます。 */
  const updatePosition = React.useCallback(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const floating = floatingRef.current;
    const floatingRect = floating?.getBoundingClientRect();
    const wantedHeight = floating?.scrollHeight || estimatedHeight;
    const below = Math.max(
      0,
      window.innerHeight - anchorRect.bottom - gap - viewportPadding,
    );
    const above = Math.max(0, anchorRect.top - gap - viewportPadding);

    const automaticPlacement =
      below >= wantedHeight
        ? "below"
        : above >= wantedHeight
          ? "above"
          : above > below
            ? "above"
            : "below";
    // placement は「希望」です。希望側に入らず、反対側のほうが広ければ
    // viewport 内へ残すことを優先して反転します。
    const nextPlacement =
      preferredPlacement === "below"
        ? below >= wantedHeight || below >= above
          ? "below"
          : "above"
        : preferredPlacement === "above"
          ? above >= wantedHeight || above >= below
            ? "above"
            : "below"
          : automaticPlacement;
    const maxHeight = Math.floor(nextPlacement === "above" ? above : below);

    let left: number | null = null;
    if (floatingRect) {
      const naturalLeft =
        align === "end"
          ? anchorRect.width - floatingRect.width
          : align === "center"
            ? (anchorRect.width - floatingRect.width) / 2
            : 0;
      const viewportLeft = anchorRect.left + naturalLeft;
      const minLeft = viewportPadding;
      const maxLeft = Math.max(
        minLeft,
        window.innerWidth - viewportPadding - floatingRect.width,
      );
      left =
        Math.min(maxLeft, Math.max(minLeft, viewportLeft)) - anchorRect.left;
    }

    setPosition((current) => {
      if (
        current.placement === nextPlacement &&
        current.left === left &&
        current.maxHeight === maxHeight
      ) {
        return current;
      }
      return { placement: nextPlacement, left, maxHeight };
    });
  }, [
    align,
    estimatedHeight,
    gap,
    open,
    preferredPlacement,
    viewportPadding,
  ]);

  useBrowserLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    const update = () => updatePosition();
    window.addEventListener("resize", update);
    // 入れ子の scroll container でも anchor の画面上の位置は変わります。
    window.addEventListener("scroll", update, true);

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (floatingRef.current) observer?.observe(floatingRef.current);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [open, updatePosition]);

  /* --- 外側を押したら閉じる --------------------------------------
     click ではなく pointerdown で拾います。click だと、押した先の要素が
     その場で消える場合に「どこを押したか」が取れなくなるためです。 */
  React.useEffect(() => {
    if (!open || !closeOnOutside) return;
    const onDown = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node))
        onCloseRef.current("outside");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, closeOnOutside]);

  /* --- Esc ------------------------------------------------------- */
  React.useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current("escape");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape]);

  const fallbackHorizontal: React.CSSProperties =
    align === "end"
      ? { left: "auto", right: 0, transform: "none" }
      : align === "center"
        ? { left: "50%", right: "auto", transform: "translateX(-50%)" }
        : { left: 0, right: "auto", transform: "none" };
  const floatingStyle: React.CSSProperties = {
    ...(position.left === null
      ? fallbackHorizontal
      : { left: position.left, right: "auto", transform: "none" }),
    maxHeight: position.maxHeight ?? undefined,
  };

  return {
    anchorRef,
    floatingRef,
    placement: position.placement,
    floatingStyle,
    updatePosition,
  };
}
