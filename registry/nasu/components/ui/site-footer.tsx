"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageBlock } from "@/components/ui/layout";
import { withBase } from "@/lib/base";

/**
 * SiteFooter — ページの下端
 * ================================================================
 * ```tsx
 * <SiteFooter
 *   brand="Example Studio"
 *   groups={[
 *     { label: "サイト", items: [{ href: "/blog", label: "ブログ" }] },
 *   ]}
 *   note="© 2026 Example Studio"
 * />
 * ```
 *
 * 見た目だけの部品に見えますが、**中身は構造の問題**です。
 *
 *   - `<footer>` は landmark なので、読み上げが「フッター」と言って飛べる
 *   - リンクの群れには見出しが要る（`<h2>` + `aria-labelledby`）。
 *     無いと「リンク 20 個」がのっぺり並ぶだけになる
 *   - リンクの当たり判定は `wt-tap`（高さ 44px / 幅 24px 以上）。
 *     **高さだけでは足りません。** `RSS` のような短いラベルは幅が 23px にしかならず、
 *     しかもフォント次第なので Linux の CI では緑のまま通ります（v0.9a で実測）
 *
 * `.astro` から使うので、`groups` は **JSON になる値だけ**で組んでいます。
 */

export interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface FooterGroup {
  label: string;
  items: FooterLink[];
}

export interface SiteFooterProps {
  brand?: string;
  brandHref?: string;
  description?: string;
  groups?: FooterGroup[];
  /** 著作権表記など。 */
  note?: string;
  width?: "narrow" | "content" | "wide" | "full";
  className?: string;
}

export function SiteFooter({
  brand,
  brandHref = "/",
  description,
  groups = [],
  note,
  width = "content",
  className,
}: SiteFooterProps) {
  return (
    <footer className={cn("mt-3xl border-t border-border", className)}>
      <PageBlock width={width} gutter="md" className="py-xl">
        {/* ----------------------------------------------------------------
            リンクの列を先に確保します
            ----------------------------------------------------------------
            **説明文とリンクの列がぶつかると、縮むのはリンクの側でした。**
            説明文は max-w-prose の分まで伸びるので、残りが足りなくなると
            リンクの列が 1 列ずつ縦に折り返し、左に大きな空白が残ります
            （実測: 器 704 に対して説明文 468、リンク側は 164 しか残らず、
            56px と 75px の 2 列が並べられませんでした）。

            リンクの列は shrink-0 で必要な幅を確保し、**折り返すのは説明文の
            側にします。** 説明文は何行になっても読めますが、リンクの列は
            縦に割れると「まとまり」が見えなくなります。

            外側に flex-wrap を足してあるのは保険です。列が増えて器に
            収まらなくなったら、説明文を潰さずに次の行へ落とします。 */}
        <div className="flex flex-col gap-xl md:flex-row md:flex-wrap md:justify-between">
          <div className="flex min-w-0 flex-col gap-2xs">
            {brand && (
              <a
                href={withBase(brandHref)}
                className="inline-flex wt-tap items-center font-display text-base hover:text-primary"
              >
                {brand}
              </a>
            )}
            {description && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-fg">
                {description}
              </p>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-lg">
              {groups.map((group) => (
                <FooterColumn key={group.label} group={group} />
              ))}
            </div>
          )}
        </div>

        {note && (
          <p className="mt-xl text-xs text-muted-fg">{note}</p>
        )}
      </PageBlock>
    </footer>
  );
}

function FooterColumn({ group }: { group: FooterGroup }) {
  // 見出しと一覧を結びます。これが無いと、読み上げは
  // 「リンク、リンク、リンク…」と読むだけで、何の一覧か分かりません。
  const id = React.useId();
  return (
    <nav aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="mb-2xs text-xs font-medium text-fg">
        {group.label}
      </h2>
      <ul className="flex flex-col">
        {group.items.map((item) => (
          <li key={item.href}>
            <a
              // base は部品側で付けます（理由は @/lib/base）
              href={withBase(item.href)}
              {...(item.external
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
              className="inline-flex wt-tap items-center text-sm text-muted-fg hover:text-fg"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
