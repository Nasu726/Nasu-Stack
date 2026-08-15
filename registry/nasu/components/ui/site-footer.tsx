"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageBlock } from "@/components/ui/layout";

/**
 * SiteFooter — ページの下端
 * ================================================================
 * ```tsx
 * <SiteFooter
 *   brand="Studio Nasu"
 *   groups={[
 *     { label: "サイト", items: [{ href: "/blog", label: "ブログ" }] },
 *   ]}
 *   note="© 2026 Studio Nasu"
 * />
 * ```
 *
 * 見た目だけの部品に見えますが、**中身は構造の問題**です。
 *
 *   - `<footer>` は landmark なので、読み上げが「フッター」と言って飛べる
 *   - リンクの群れには見出しが要る（`<h2>` + `aria-labelledby`）。
 *     無いと「リンク 20 個」がのっぺり並ぶだけになる
 *   - リンクの当たり判定は 44px（`tokens.css` が保証するのは指の端末だけ）
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
        <div className="flex flex-col gap-xl md:flex-row md:justify-between">
          <div className="flex min-w-0 flex-col gap-2xs">
            {brand && (
              <a
                href={brandHref}
                className="inline-flex min-h-11 items-center font-display text-base hover:text-primary"
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
            <div className="flex flex-wrap gap-xl">
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
              href={item.href}
              {...(item.external
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
              className="inline-flex min-h-11 items-center text-sm text-muted-fg hover:text-fg"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
