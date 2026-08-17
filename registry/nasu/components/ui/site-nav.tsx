"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageBlock } from "@/components/ui/layout";
import { withBase } from "@/lib/base";

/**
 * SiteNav — サイトのヘッダとナビゲーション
 * ================================================================
 * ```tsx
 * <SkipLink />
 * <SiteHeader
 *   brand={<a href="/">Studio Nasu</a>}
 *   items={[
 *     { href: "/works", label: "Works" },
 *     { href: "/blog",  label: "Blog"  },
 *   ]}
 *   currentPath={Astro.url.pathname}
 *   actions={<ThemeSwitcher />}
 * />
 * ```
 *
 * ----------------------------------------------------------------
 * なぜ狭い画面のメニューが `<details>` なのか
 * ----------------------------------------------------------------
 * 「ハンバーガーを押したら開く」を `useState` で書くと、
 * **JavaScript が届くまでメニューが開けません。**
 * Astro のページでヘッダを island にした場合、読み込みの遅い回線では
 * 「押しても何も起きない数秒」が生まれます。
 *
 * `<details>` はブラウザ自身の機能なので、
 *
 *   - JS が 1 行も無くても開閉する（Astro なら island にすらしなくていい）
 *   - キーボード（Enter / Space）で開閉する
 *   - 読み上げが開閉状態を正しく言う
 *   - Ctrl+F のページ内検索が、閉じた中のリンクも見つける
 *
 * Esc で閉じる処理だけは JS で足していますが、**無くても困りません**
 * （もう一度押せば閉じます）。これが正しい足し方の順序です。
 *
 * ----------------------------------------------------------------
 * リンクは両方の並びに出しています
 * ----------------------------------------------------------------
 * 広い画面用の並びと、狭い画面用の並びに、同じリンクを 2 回書き出します。
 * 片方を JS で作ると、その片方が JS 無しで消えるためです。
 * 重複を嫌って 1 つにすると、必ずどちらかが壊れます。
 */

export interface NavItem {
  href: string;
  label: React.ReactNode;
  /** 別タブで開くリンク。 */
  external?: boolean;
}

export interface SiteHeaderProps {
  brand?: React.ReactNode;
  /**
   * ブランド名を押したときの行き先。ふつうは `/`。
   *
   * **`brand` に `<a>` を入れて渡すことはできません。**
   * `.astro` のファイルでは、props に要素を書けないためです
   * （`brand={<a href="/">…</a>}` はビルドで構文エラーになります）。
   * Astro の island に渡せるのは JSON になる値だけ、という制約の一部です。
   * だから行き先だけを文字列で受け取ります。
   */
  brandHref?: string;
  items?: NavItem[];
  /**
   * いま開いているページのパス。
   *
   * ルーターに依存しないよう、**外から受け取る形にしています。**
   * Astro なら `Astro.url.pathname`、React なら `location.pathname`、
   * React Router なら `useLocation().pathname` を渡してください。
   */
  currentPath?: string;
  /** 右端に置くもの（テーマ切り替え、ログインボタンなど）。 */
  actions?: React.ReactNode;
  /** 画面上端に貼り付けるか。既定 true。 */
  sticky?: boolean;
  /** 中身の最大幅。既定 content。 */
  width?: "narrow" | "content" | "wide" | "full";
  className?: string;
}

/** そのリンクが現在のページか。末尾の / の有無で外さないようにします。 */
function isCurrent(href: string, currentPath?: string) {
  if (!currentPath) return false;
  const norm = (s: string) => (s.length > 1 ? s.replace(/\/$/, "") : s);
  /* **比べる前に base を付けます。** `currentPath` は
     `Astro.url.pathname` で、公開先の階層を含んでいます（`/my-site/about/`）。
     一方 `href` は利用者が書いた `/about/` です。そのまま比べると、
     サブパスに公開した瞬間に「いまここ」が一度も一致しなくなります
     （色も aria-current も出ません）。 */
  return norm(withBase(href)) === norm(currentPath);
}

export function SiteHeader({
  brand,
  brandHref,
  items = [],
  currentPath,
  actions,
  sticky = true,
  width = "content",
  className,
}: SiteHeaderProps) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  /* --- Esc で閉じる（あくまで上乗せ。無くても開閉はできます） --- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = detailsRef.current;
      if (el?.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "relative z-30 border-b border-border bg-bg/85 backdrop-blur-md",
        // 高さは --header-h と同じ値を使います。
        // この値は html の scroll-padding-top にも使われているので、
        // ここを変えるとアンカーリンクの位置も自動でついてきます。
        "min-h-[var(--header-h)]",
        sticky && "sticky top-0",
        className,
      )}
    >
      <PageBlock width={width} gutter="md">
        {/* 横一列。**どの子も縮めるようにしておく必要があります。**
            flex の子は既定で min-width:auto なので、中身より小さくなれません。
            幅のある actions（テーマ切り替えなど）を渡された瞬間、
            行が画面からはみ出します（実測: 375px で 15px はみ出し）。
            min-w-0 を与えて、縮むか折り返すかできるようにします。 */}
        <div className="flex min-h-[var(--header-h)] min-w-0 items-center gap-sm">
          {brand && (
            <div className="min-w-0 shrink font-display text-lg">
              {brandHref ? (
                // 文字の高さのままだと押しづらいので、ここでも 44px 確保します
                <a
                  href={withBase(brandHref)}
                  className="inline-flex wt-tap items-center rounded-md hover:text-primary"
                >
                  {brand}
                </a>
              ) : (
                brand
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* 広い画面: 横に並べる */}
          {items.length > 0 && (
            <nav aria-label="サイト内" className="hidden md:block">
              <ul className="flex items-center gap-2xs">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} current={isCurrent(item.href, currentPath)} />
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {actions && <div className="flex min-w-0 items-center">{actions}</div>}

          {/* 狭い画面: <details> で開閉する。JS 不要。 */}
          {items.length > 0 && (
            <details ref={detailsRef} className="md:hidden">
              <summary
                aria-label="メニュー"
                className={cn(
                  "wt-summary flex size-11 cursor-pointer items-center justify-center",
                  "rounded-md text-muted-fg hover:bg-muted hover:text-fg",
                )}
              >
                <MenuIcon />
              </summary>

              {/* ヘッダの内側ではなく、ヘッダの真下へ絶対配置します。
                  ここを普通の流し込みにすると、開くたびに本文が下へずれます。 */}
              <nav
                aria-label="サイト内"
                className={cn(
                  "absolute inset-x-0 top-full border-b border-border bg-bg p-md shadow-e2",
                  // 項目が多いときに画面から溢れないよう、この中でスクロールさせます
                  "max-h-[calc(100dvh-var(--header-h))] overflow-y-auto",
                )}
              >
                <ul className="flex flex-col gap-2xs">
                  {items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        item={item}
                        current={isCurrent(item.href, currentPath)}
                        block
                        onClick={() => {
                          // 同じページ内のアンカーへ飛ぶときは、開いたままだと
                          // 飛んだ先がメニューに隠れます
                          if (detailsRef.current) detailsRef.current.open = false;
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}
        </div>
      </PageBlock>
    </header>
  );
}

export function NavLink({
  item,
  current,
  block,
  onClick,
}: {
  item: NavItem;
  current?: boolean;
  block?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      /* **base は部品側で付けます。** 利用者は `/about/` と書けば済みます。
         書き忘れても手元では壊れないので、覚えてもらう形にすると必ず漏れます
         （理由は @/lib/base のコメント）。 */
      href={withBase(item.href)}
      onClick={onClick}
      // 「いまここ」を伝える正式な方法です。色だけで示すと、
      // 読み上げの利用者と、色を見分けにくい人には届きません。
      aria-current={current ? "page" : undefined}
      {...(item.external
        ? { target: "_blank", rel: "noreferrer noopener" }
        : {})}
      className={cn(
        // 文字だけだと高さが 20px 前後になり、指で押せません。
        // tokens.css が 44px を保証するのは指で触る端末だけなので、
        // マウスの端末のためにここでも確保します。
        "inline-flex wt-tap items-center rounded-md px-3 text-sm transition-colors",
        block && "w-full",
        current
          ? "bg-muted font-medium text-fg"
          : "text-muted-fg hover:bg-muted hover:text-fg",
      )}
    >
      {item.label}
      {item.external && <ExternalIcon />}
    </a>
  );
}

/**
 * SkipLink — キーボードで本文へ飛ぶ
 * ================================================================
 * ふだんは見えず、**Tab キーを最初に押した瞬間だけ**現れます。
 * ナビゲーションのリンクが 10 個あるページで、キーボードだけの人が
 * 毎回 10 回 Tab を押さずに済むようにするためのものです。
 *
 * 飛び先には `id` と `tabIndex={-1}` の両方が要ります。
 * `tabIndex` が無いと、URL は変わるのにフォーカスが移りません。
 */
export function SkipLink({
  href = "#main",
  children = "本文へスキップ",
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:left-4 focus:top-4 focus:z-50",
        "focus:inline-flex focus:wt-tap focus:items-center focus:rounded-md",
        "focus:bg-primary focus:px-4 focus:text-sm focus:font-medium focus:text-primary-fg",
        "focus:shadow-e3 focus:outline-2 focus:outline-offset-2 focus:outline-ring",
      )}
    >
      {children}
    </a>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" className="size-5">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      className="ml-1 size-3.5 shrink-0"
    >
      <path
        d="M14 5h5v5M19 5l-7 7M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
