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
 *   - スクロールバーを隠せる（`scrollbar="hidden"`。端の影は残します）
 *
 * ----------------------------------------------------------------
 * ホイールの扱い
 * ----------------------------------------------------------------
 * **横の動きだけを見ます。** タッチパッドの 2 本指の横払いや、
 * 横チルトのあるホイールがここに来ます。
 *
 * v0.9c では**縦の動きを横に回して**いました。**やめました。**
 * コード例や表の上を通っただけでページの縦読みが止まり、横に流れます。
 * 縦に読んでいる人の邪魔になるほうが害が大きい、というのが作者の判断です。
 */
export interface ScrollableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** スクロール領域の説明。読み上げに使われます。 */
  label?: string;
  /** 縦にもスクロールさせたいとき。 */
  axis?: "x" | "y" | "both";
  /**
   * スクロールバーを出すか。既定 "auto"（ブラウザ任せ）。
   *
   * "hidden" にしても**端の影は残します。** 影まで消すと、
   * そこがスクロールできることを示すものが 1 つも無くなります。
   * キーボードで到達できる点も変わりません。
   */
  scrollbar?: "auto" | "hidden";
  /** 最大の高さ（axis に y を含むとき）。 */
  maxHeight?: string;
  children?: React.ReactNode;
}

export function Scrollable({
  label,
  axis = "x",
  scrollbar = "auto",
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

  /* ホイールの**横**の動きを反映します。
     **端に着いたら preventDefault しません。** そこで止めてしまうと、
     一覧の端でページ全体のスクロールまで止まります。 */
  React.useEffect(() => {
    const el = ref.current;
    if (!el || axis === "y") return;
    const onWheel = (e: WheelEvent) => {
      // ピンチ（Ctrl+ホイール）は拡大縮小なので触りません
      if (e.ctrlKey) return;
      // 縦の動きには触りません。ページの縦読みを止めないためです。
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.min(max, Math.max(0, el.scrollLeft + e.deltaX));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    // passive: false でないと preventDefault が効きません
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [axis]);

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
              : // **overflow-y は指定しません。** `Inline wrap={false}`
                // （wt-nowrap）と同じ形に揃えています。
                "overflow-x-auto",
          // スマホで指を離したときの慣性と、スクロール端の跳ね返り抑制
          "overscroll-x-contain",
          scrollbar === "hidden" && "wt-noscrollbar",
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
