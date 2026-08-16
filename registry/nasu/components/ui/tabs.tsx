"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Scrollable } from "@/components/ui/scrollable";

/**
 * Tabs — 切り替えて見せる
 * ================================================================
 * ```tsx
 * const [tab, setTab] = React.useState("a");
 *
 * <Tabs items={[{ value: "a", label: "概要" }, { value: "b", label: "詳細" }]}
 *       value={tab} onValueChange={setTab}>
 *   <TabPanel value="a">概要の中身</TabPanel>
 *   <TabPanel value="b">詳細の中身</TabPanel>
 * </Tabs>
 * ```
 *
 * `value` を渡さなければ内部で持ちます。渡せば URL でも state でも繋げます。
 *
 * ----------------------------------------------------------------
 * 見た目の裏でやっていること
 * ----------------------------------------------------------------
 * **矢印キーで移動できること**が、タブの本体です。
 * `<button>` を並べただけでは Tab キーがタブの数だけ止まり、
 * 中身へたどり着くまでに 5 回も 6 回も押させることになります。
 *
 * そこで WAI-ARIA の「roving tabindex」を実装しています。
 *
 *   - Tab キーで止まるのは**選択中のタブ 1 つだけ**（他は tabIndex = -1）
 *   - タブの間の移動は ← → Home End
 *   - もう一度 Tab を押すと、タブ列を抜けて中身へ入る
 *
 * タブが多くて横に入りきらないときは、潰さずに横スクロールさせます。
 */

export interface TabItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** 選択中の値。渡すと制御コンポーネントになります。 */
  value?: string;
  /** 制御しないときの初期値。 */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * 矢印キーで移動した瞬間に切り替えるか（automatic）、
   * Enter / Space を押すまで切り替えないか（manual）。既定 automatic。
   *
   * 中身の描画が重いときや、切り替えで通信が走るときは manual にしてください。
   */
  activation?: "automatic" | "manual";
  /**
   * 選択されていないパネルを DOM から外すか。既定 false（`hidden` で隠すだけ）。
   *
   * **入力途中の値が消えるかどうかが変わります。**
   * `hidden` なら別のタブへ行って戻っても入力が残り、
   * 外すと消えます。フォームを載せるなら既定のままにしてください。
   */
  unmountInactive?: boolean;
  /** タブ列の説明。読み上げに使われます。 */
  label?: string;
  /**
   * id の接頭辞。省略すると自動で作ります。
   *
   * タブ列とパネルが**離れた場所にある**とき（ヘッダにタブ、本文にパネル）に
   * 使ってください。パネル側から `${idPrefix}-tab-${value}` を
   * `aria-labelledby` に指定できるようになります。
   */
  idPrefix?: string;
  /**
   * パネルが `Tabs` の外にあるときの、そのパネルの id。
   *
   * これを渡さずにパネルを外へ出すと、`aria-controls` が
   * **存在しない id を指したまま**になります。読み上げは
   * 「このタブは何を操作するのか」を言えなくなります。
   */
  panelId?: string;
  children?: React.ReactNode;
  className?: string;
}

interface TabsCtx {
  value: string;
  baseId: string;
  unmountInactive: boolean;
}

const TabsContext = React.createContext<TabsCtx | null>(null);

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  activation = "automatic",
  unmountInactive = false,
  label,
  idPrefix,
  panelId,
  children,
  className,
}: TabsProps) {
  const autoId = React.useId();
  const baseId = idPrefix ?? autoId;
  const [inner, setInner] = React.useState(
    () => defaultValue ?? items[0]?.value ?? "",
  );
  const current = value ?? inner;

  const select = React.useCallback(
    (next: string) => {
      if (value === undefined) setInner(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const listRef = React.useRef<HTMLDivElement>(null);

  /** 押せるタブだけを対象に、次の位置を求めます（無効なタブは飛ばす）。 */
  const move = (from: number, step: number) => {
    const n = items.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + step * i + n * n) % n;
      if (!items[idx].disabled) return idx;
    }
    return from;
  };

  const focusTab = (idx: number) => {
    const el = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )[idx];
    el?.focus();
    // 横スクロールしているとき、移動先が画面外なら送り込みます
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (activation === "automatic" && items[idx]) select(items[idx].value);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusTab(move(index, 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusTab(move(index, -1));
        break;
      case "Home":
        e.preventDefault();
        focusTab(move(-1, 1));
        break;
      case "End":
        e.preventDefault();
        focusTab(move(items.length, -1));
        break;
      default:
        break;
    }
  };

  return (
    <TabsContext.Provider value={{ value: current, baseId, unmountInactive }}>
      <div className={cn("flex w-full flex-col gap-md", className)}>
        <Scrollable label={label ?? "タブ"}>
          <div
            ref={listRef}
            role="tablist"
            aria-label={label}
            // wt-nowrap は「潰さずに横スクロール」。子の min-width を戻し、
            // flex-shrink を 0 にするので、タブの文字が縦積みになりません。
            className="wt-nowrap flex w-max gap-1 rounded-lg border border-border bg-card p-1"
          >
            {items.map((item, i) => {
              const selected = item.value === current;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${item.value}`}
                  aria-selected={selected}
                  aria-controls={panelId ?? `${baseId}-panel-${item.value}`}
                  disabled={item.disabled}
                  // roving tabindex: Tab キーで止まるのは選択中の 1 つだけ
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(item.value)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={cn(
                    // 文字の高さのままだと 20px 前後になり、
                    // WCAG 2.1 AA の 24px を下回ります
                    "min-h-8 rounded-md px-3 text-sm font-medium transition-colors",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "bg-primary text-primary-fg"
                      : "text-muted-fg hover:bg-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </Scrollable>

        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: React.ReactNode;
}

export function TabPanel({
  value,
  children,
  className,
  ...props
}: TabPanelProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error("TabPanel は Tabs の中に置いてください");
  }
  const selected = ctx.value === value;
  if (!selected && ctx.unmountInactive) return null;

  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      hidden={!selected}
      // パネル自体にフォーカスできるようにします。
      // タブから Tab キーを押した人が、中に押せる要素が無くても
      // 内容へ到達できる必要があるためです。
      tabIndex={selected ? 0 : undefined}
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
