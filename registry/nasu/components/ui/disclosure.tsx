"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Disclosure / Accordion — 折りたたんで隠す
 * ================================================================
 * `<details>` と `<summary>` を使います。**JavaScript が 1 行も要りません。**
 *
 *   - クリックでもキーボード（Enter / Space）でも開閉する
 *   - 読み上げが「展開済み / 折りたたみ済み」を正しく言う
 *   - ページ内検索（Ctrl+F）が閉じた中身も見つけて開いてくれる
 *   - **JS が読み込まれる前から動く**
 *
 * 最後の 1 つが効きます。Astro のページに置けば、island にしなくても
 * そのまま動きます。自前で `useState` を書くと、この全部を失います。
 *
 * ```tsx
 * <Disclosure summary="送料について">
 *   3,000 円以上で無料です。
 * </Disclosure>
 *
 * <Accordion
 *   items={[
 *     { summary: "支払い方法は？", content: "カードと振込です。" },
 *     { summary: "返品できますか？", content: "8 日以内なら可能です。" },
 *   ]}
 * />
 * ```
 */

export interface DisclosureProps
  extends Omit<React.HTMLAttributes<HTMLDetailsElement>, "title"> {
  summary: React.ReactNode;
  /** 最初から開いておくか。 */
  defaultOpen?: boolean;
  /**
   * 同じ名前を付けた `<details>` は、**1 つだけしか開きません。**
   * HTML だけで排他アコーディオンが作れます（`Accordion` が使っています）。
   */
  name?: string;
  children?: React.ReactNode;
}

export function Disclosure({
  summary,
  defaultOpen,
  name,
  children,
  className,
  ...props
}: DisclosureProps) {
  return (
    <details
      open={defaultOpen}
      name={name}
      className={cn(
        "wt-disclosure group border-b border-border last:border-b-0",
        className,
      )}
      {...props}
    >
      <summary
        className={cn(
          // 既定の三角マーカーを消すので、代わりの矢印を必ず出します。
          // 消しただけだと「開けることが見えない」状態になります。
          "wt-summary flex min-h-11 cursor-pointer items-center justify-between gap-sm",
          "py-2 text-left text-sm font-medium",
          "hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
        )}
      >
        <span className="min-w-0">{summary}</span>
        <Chevron />
      </summary>

      <div className="pb-3 text-sm leading-relaxed text-muted-fg">
        {children}
      </div>
    </details>
  );
}

/** 開いていると 180 度回る矢印。`group-open:` は details[open] に反応します。 */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      className="size-4 shrink-0 text-muted-fg transition-transform duration-200 group-open:rotate-180"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface AccordionItem {
  summary: React.ReactNode;
  content: React.ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  /**
   * 一度に 1 つだけ開くか。既定 true。
   *
   * `<details name>` を使うのでブラウザだけで実現しています。
   * この属性に対応していない古いブラウザでは、単に複数開けるだけで、
   * **壊れはしません**（進歩的強化）。
   */
  exclusive?: boolean;
  className?: string;
}

export function Accordion({
  items,
  exclusive = true,
  className,
}: AccordionProps) {
  // 同じページに Accordion が 2 つあっても混ざらないよう、名前を分けます
  const groupName = React.useId();

  return (
    <div className={cn("rounded-lg border border-border bg-card px-md", className)}>
      {items.map((item, i) => (
        <Disclosure
          key={i}
          summary={item.summary}
          defaultOpen={item.defaultOpen}
          name={exclusive ? groupName : undefined}
        >
          {item.content}
        </Disclosure>
      ))}
    </div>
  );
}
