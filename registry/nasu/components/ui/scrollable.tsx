"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Scrollable — 狭い画面でも「潰さず、はみ出させず」に収める
 * ================================================================
 * 表やコードブロックのように、これ以上縮めると読めなくなるものがあります。
 * そういう中身は**その部分だけ横スクロールさせる**のが正解です。
 *
 * ```tsx
 * <Scrollable label="売上の表">
 *   <table>…</table>
 * </Scrollable>
 * ```
 *
 * 自動で面倒をみるもの:
 *   - 端が切れていることを示す影（スクロールできると気づける）
 *   - キーボードだけの人がスクロールできるよう tabIndex を付ける
 *     （スクロール領域に到達手段が無いのはアクセシビリティ違反です）
 *   - スクロールが不要な幅では影も tabIndex も付けない
 */
export interface ScrollableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** スクロール領域の説明。読み上げに使われます。 */
  label?: string;
  /** 縦にもスクロールさせたいとき。 */
  axis?: "x" | "y" | "both";
  /** 最大の高さ（axis に y を含むとき）。 */
  maxHeight?: string;
  children?: React.ReactNode;
}

export function Scrollable({
  label,
  axis = "x",
  maxHeight,
  className,
  style,
  children,
  ...props
}: ScrollableProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState({
    scrollable: false,
    atStart: true,
    atEnd: true,
  });

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const scrollable = el.scrollWidth > el.clientWidth + 1;
    setState({
      scrollable,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const showLeft = state.scrollable && !state.atStart;
  const showRight = state.scrollable && !state.atEnd;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        // スクロールできるときだけ、キーボードで到達できるようにする
        tabIndex={state.scrollable ? 0 : undefined}
        role={state.scrollable ? "region" : undefined}
        aria-label={state.scrollable ? (label ?? "横スクロール領域") : undefined}
        className={cn(
          "w-full",
          axis === "y"
            ? "overflow-y-auto overflow-x-hidden"
            : axis === "both"
              ? "overflow-auto"
              : "overflow-x-auto overflow-y-hidden",
          // スマホで指を離したときの慣性と、スクロール端の跳ね返り抑制
          "overscroll-x-contain",
        )}
        style={{ maxHeight, ...style }}
        {...props}
      >
        {children}
      </div>

      {/* 端が切れていることを示す影。押せる要素ではないので操作は奪いません。 */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-6 transition-opacity duration-200",
          "bg-gradient-to-r from-bg to-transparent",
          showLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-6 transition-opacity duration-200",
          "bg-gradient-to-l from-bg to-transparent",
          showRight ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
