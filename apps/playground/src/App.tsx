import * as React from "react";
import { ThemeSwitcher, useTheme } from "@/components/ui/theme-provider";
import {
  Column,
  Columns,
  ContentBlock,
  Inline,
  PageBlock,
  Spread,
  Stack,
  Tiles,
} from "@/components/ui/layout";
import { Tabs } from "@/components/ui/tabs";
import { Panel } from "./Panel";
import { LayoutDemo } from "./LayoutDemo";
import { ResponsiveDemo } from "./ResponsiveDemo";
import { PartsDemo } from "./PartsDemo";
import { FormsDemo } from "./FormsDemo";
import { NavDemo } from "./NavDemo";
import { TextDemo } from "./TextDemo";
import { StateDemo } from "./state/StateDemo";
import { TABS, normalizeTab } from "./tabs.mjs";
import { LANG, langHref, t } from "./lang";

type Tab = string;

const params =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

/** 端末プレビューの iframe から読まれているときは、入れ子を避けて簡略表示にする。 */
const isEmbedded = params.has("embed");

/**
 * タブを URL で指定できるようにしています。
 * こうしないと `pnpm check` が既定タブしか検査できません
 * （実際、v0.4 と v0.5 で作った部品は一度も 320px で検査されていませんでした）。
 */
const initialTab = normalizeTab(params.get("tab"));

/**
 * タブごとの中身。**tabs.mjs にあるキーと対応させます。**
 * 対応が無いタブは黙って別の画面を出さず、未実装だと明示します
 * （黙って既定の画面を出すと、検査は通るのに中身が違う、が起きます）。
 */
const PANELS: Record<string, React.ReactNode> = {
  layout: <LayoutDemo />,
  responsive: <ResponsiveDemo />,
  parts: <PartsDemo />,
  forms: <FormsDemo />,
  nav: <NavDemo />,
  text: <TextDemo />,
  state: <StateDemo />,
};

function NotBuilt({ tab }: { tab: string }) {
  // 画面に出すのは見に来た人向けの一言だけ。
  // **こちらが気づくための情報はコンソールへ回します。**
  // 内部のファイル名を出しても、読む人には手がかりになりません。
  React.useEffect(() => {
    console.warn(
      `[catalog] tabs.mjs に "${tab}" がありますが、App.tsx の PANELS に中身がありません`,
    );
  }, [tab]);

  return (
    <Panel title={t("この章はまだ準備中です")} description={null}>
      <p className="text-sm text-muted-fg">
        {t("まだ中身がありません。他のタブをご覧ください。")}
      </p>
    </Panel>
  );
}

export function App() {
  const [tab, setTab] = React.useState<Tab>(initialTab);

  if (isEmbedded) return <EmbeddedPreview />;

  return (
    // data-active-tab は検証スクリプト用。?tab= で開いたつもりが
    // 別のタブだった、を黙って見逃さないための目印です。
    <div className="min-h-dvh bg-bg text-fg" data-active-tab={tab}>
      <Header tab={tab} onTab={setTab} />
      <PageBlock width="content" gutter="md" as="main" className="pb-3xl pt-2xl">
        <Stack space="3xl">
          <Intro />
          {/* タブ列はヘッダ、中身はここ、と離れています。
              離れていても読み上げが繋がるように、id を明示しています。 */}
          <div
            id="catalog-panel"
            role="tabpanel"
            aria-labelledby={`catalog-tab-${tab}`}
            tabIndex={0}
            className="outline-none"
          >
            {PANELS[tab] ?? <NotBuilt tab={tab} />}
          </div>
        </Stack>
      </PageBlock>
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { theme } = useTheme();
  return (
    // ナビのデモに置く SiteHeader は z-30 です（部品側の既定）。
    // カタログの枠がそれより上に無いと、スクロール中に潜られます。
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      {/* 狭いときは 3 段になるので、余白を詰めます。
          実測（375px）: py-sm/gap-sm だと 171px、py-xs/gap-xs で 155px。
          貼り付いたヘッダが画面の 2 割を占めるのは重いので、そこを削ります。 */}
      <PageBlock width="content" gutter="md" className="py-xs lg:py-sm">
        {/* ----------------------------------------------------------------
            1024px 未満は 2 段にします
            ----------------------------------------------------------------
            実測（1440px）: 器 1024px に対して
            ブランド 108 + タブ 531 + トンマナ 248 + 明暗 64 = 951。
            余りは 73px しかありません。器が 980 を切ると 1 行には入りません。

            v0.9c では「残りに合わせる」（flex-1）にしました。半画面は直りましたが、
            **375px でタブの可視幅が 13px になりました**（中身は 530px）。
            はみ出してはいないので、端末幅の検査は緑のまま通ります。
            狭いときは**潰さずに段を増やす**のが正解でした。

            段の入れ替えは order でやります。ThemeSwitcher を 2 つ置いて
            hidden で出し分けると、読み上げに同じものが 2 回現れます。
            ---------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-xs lg:gap-sm">
          <Inline space="sm" alignY="baseline" className="order-1 shrink-0">
            <span className="font-display text-lg">Nasu Stack</span>
            <span className="text-xs text-muted-fg">/ {theme}</span>
          </Inline>

          {/* 狭いとき: ブランドと同じ行の右端。広いとき: いちばん右。
              **shrink-0 を付けてはいけません。** 320px ではトンマナの
              4 ボタンが入り切らず、15px はみ出しました（実測）。
              ThemeSwitcher は自分で折り返せるので、縮めるほうを許します。 */}
          <div className="order-2 ms-auto flex min-w-0 items-center gap-xs lg:order-3 lg:ms-0">
            {/* 言語。**ただのリンクです。** 状態も context も持ちません。
                ?lang= を読んで 1 度決めるだけなので、切り替えは再読込で足ります
                （lang.ts に理由を書いてあります）。 */}
            <a
              href={langHref(LANG === "ja" ? "en" : "ja")}
              hrefLang={LANG === "ja" ? "en" : "ja"}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md px-xs text-xs text-muted-fg underline underline-offset-4 hover:text-fg"
            >
              {LANG === "ja" ? "English" : "日本語"}
            </a>
            <ThemeSwitcher />
          </div>

          {/* 配布している Tabs をそのまま使っています。
              自分で使わない部品は必ず腐るので、手書きの button 列から
              差し替えました（矢印キー・roving tabindex が付きます）。 */}
          <Tabs
            items={TABS.map((tab) => ({ value: tab.key, label: t(tab.label) }))}
            value={tab}
            onValueChange={(k) => {
              onTab(k);
              // 検査スクリプトが直接そのタブを開けるように URL を合わせる
              const u = new URL(window.location.href);
              u.searchParams.set("tab", k);
              window.history.replaceState(null, "", u);
            }}
            label={t("カタログの章")}
            idPrefix="catalog"
            panelId="catalog-panel"
            // basis-full で 2 段目へ落とします。**縮めません。**
            // 入り切らないときは Scrollable が横に流します。
            className="order-3 min-w-0 basis-full lg:order-2 lg:ms-auto lg:basis-auto"
          />
        </div>
      </PageBlock>
    </header>
  );
}

/**
 * 導入部。**広い画面では見出しと本文を横に並べます。**
 *
 * ----------------------------------------------------------------
 * なぜ縦に積まないのか
 * ----------------------------------------------------------------
 * 本文の 1 行は、和文なら 45 字までが読める上限です
 * （`check-responsive.mjs` が実際に測っています）。14px なら 630px。
 * 器は 1024px なので、**縦に積むと右に 360px 以上の空白が残ります。**
 *
 * 1920px で見ると、最初の画面が左半分だけになって「寄っている」と見えます
 * （作者の指摘）。器を狭めれば揃いますが、そうするとヘッダの
 * ブランド + タブ + トンマナ（合計 951px）が 1 行に入りません。
 *
 * **どちらも譲らずに済ませる方法が、横に並べることです。**
 * 1024px 未満では今までどおり縦に積みます。
 */
function Intro() {
  return (
    <Columns space="xl" collapseBelow="desktop" alignY="end">
      <Column width="1/2">
        <h1 className="text-3xl leading-tight sm:text-4xl">
          {t("余白は迷わせない。")}
          <br />
          {t("状態は書かせない。")}
        </h1>
      </Column>
      <Column>
        <ContentBlock width="prose" align="start" className="text-sm">
          <p className="leading-relaxed text-muted-fg">
            {t("余白は 9 段階が既定なので配置で迷いません。ただし 9 段階は制限ではなく、\r\n            段階に無い値もそのまま書けます。\r\n            非同期処理は関数を 1 つ渡すだけで、読込中・成功・失敗・空・二重送信・中断が付いてきます。\r\n            上のスイッチでトンマナ（見た目の系統）を切り替えると、\r\n            色・角丸・影・書体・余白の広さまで一斉に変わります。")}
          </p>
        </ContentBlock>
      </Column>
    </Columns>
  );
}

/* ---------------------------------------------------------------- */

/** 端末プレビュー用の簡略ページ。実際のレイアウト部品だけで組んであります。 */
function EmbeddedPreview() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <PageBlock width="content" gutter="md" className="py-lg">
        <Stack space="lg">
          <Spread space="sm">
            <span className="font-display text-base">Example Studio</span>
            <Inline space="xs">
              <span className="text-xs text-muted-fg">Works</span>
              <span className="text-xs text-muted-fg">About</span>
            </Inline>
          </Spread>

          <Stack space="xs">
            <h1 className="text-2xl leading-tight">
              {t("幅を変えても崩れません")}
            </h1>
            <ContentBlock width="prose" align="start" className="text-sm">
              <p className="leading-relaxed text-muted-fg">
                {t("段組は狭い画面で自動的に縦へ畳み、タイルは列数が変わり、\r\n                タグは折り返します。長い URL も折れます。\r\n                https://example.com/very/long/path/that/never/breaks/anywhere")}
              </p>
            </ContentBlock>
          </Stack>

          <Columns space="md">
            <Column width="1/3">
              <div className="rounded-md bg-accent px-sm py-xs text-xs text-accent-fg">
                1/3
              </div>
            </Column>
            <Column>
              <div className="rounded-md bg-accent px-sm py-xs text-xs text-accent-fg">
                auto
              </div>
            </Column>
          </Columns>

          <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="sm">
            {["A", "B", "C"].map((n) => (
              <div
                key={n}
                className="rounded-md border border-border bg-card px-sm py-xs text-xs"
              >
                {t("カード")} {n}
              </div>
            ))}
          </Tiles>

          <Inline space="xs">
            {["TypeScript", "React", "Astro", "Tailwind", t("アクセシビリティ")].map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg"
                >
                  {tag}
                </span>
              ),
            )}
          </Inline>
        </Stack>
      </PageBlock>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <PageBlock width="content" gutter="md" className="py-lg">
        <p className="text-xs text-muted-fg">Nasu Stack — MIT License</p>
      </PageBlock>
    </footer>
  );
}
