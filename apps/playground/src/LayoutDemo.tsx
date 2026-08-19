import * as React from "react";
import {
  Box,
  Column,
  Columns,
  ContentBlock,
  Divider,
  Inline,
  PageBlock,
  Section,
  Spread,
  Stack,
  Tiles,
  type SpaceToken,
} from "@/components/ui/layout";
import { Button } from "@/components/ui/action-button";
import { Blk, Panel } from "./Panel";
import { t } from "./lang";

const SPACES: SpaceToken[] = [
  "none",
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
];

export function LayoutDemo() {
  return (
    <Stack space="3xl">
      <SpaceScale />
      <StackDemo />
      <InlineDemo />
      <ColumnsDemo />
      <TilesDemo />
      <PageDemo />
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function SpaceScale() {
  return (
    <Panel
      title={t("余白の既定は 9 段階")}
      description={
        <>
          {t("入力補完に出るのはこの 9 つだけなので、迷わずに済みます。\r\n          ただし壁ではありません。")}<code className="text-fg">space=&quot;13px&quot;</code>{" "}
          {t("のように段階に無い値もそのまま書けます（Tailwind の")}{" "}
          <code className="text-fg">p-4</code> {t("と")}{" "}
          <code className="text-fg">p-[13px]</code> {t("の関係と同じです）。\r\n          段階ごとの実寸はテーマで変わるので、上のスイッチを切り替えると幅も変わります。")}
        </>
      }
    >
      <Stack space="2xs">
        {SPACES.map((s) => (
          <Inline key={s} space="sm" alignY="center" wrap={false}>
            <code className="w-12 shrink-0 text-xs text-muted-fg">{s}</code>
            <div className="h-4 rounded-sm bg-primary" style={{ width: `var(--space-${s})` }} />
          </Inline>
        ))}
      </Stack>
    </Panel>
  );
}

function StackDemo() {
  const [space, setSpace] = React.useState<string>("md");
  const [custom, setCustom] = React.useState("13px");
  const isToken = SPACES.includes(space as SpaceToken);

  return (
    <Panel
      title={t("Stack — 縦に積む")}
      description={t("いちばん使う部品です。子側に margin を書く必要はありません。")}
      code={`<Stack space="${space}">\n  <A /> <B /> <C />\n</Stack>`}
    >
      <Stack space="xs">
        <Inline space="2xs">
          {SPACES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={space === s ? "primary" : "outline"}
              onClick={() => setSpace(s)}
            >
              {s}
            </Button>
          ))}
        </Inline>

        <Inline space="xs" alignY="center">
          <span className="text-xs text-muted-fg">{t("段階に無い値も書けます:")}</span>
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setSpace(e.target.value);
            }}
            aria-label={t("任意の余白")}
            className="w-44 rounded-md border border-input bg-card px-2 py-1 text-base"
          />
          <Button
            size="sm"
            variant={!isToken ? "primary" : "outline"}
            onClick={() => setSpace(custom)}
          >
            {t("適用")}
          </Button>
        </Inline>
      </Stack>

      <Stack space={space}>
        <Blk>A</Blk>
        <Blk>B</Blk>
        <Blk>C</Blk>
      </Stack>

      <Stack space="2xs">
        <span className="text-xs font-medium text-muted-fg">
          {t("dividers（線は実際の要素なので、上下の余白が揃います。上のボタンで変わります）")}
        </span>
        <Stack space={space} dividers>
          <Blk>A</Blk>
          <Blk>B</Blk>
          <Blk>C</Blk>
        </Stack>
      </Stack>
    </Panel>
  );
}

function InlineDemo() {
  return (
    <Panel
      title={t("Inline — 横に並べて折り返す")}
      description={t("画面が狭くなると自動で折り返すので、はみ出しません。ウィンドウ幅を変えてみてください。")}
      code={`<Inline space="sm">\n  {tags.map((t) => <Tag key={t} />)}\n</Inline>`}
    >
      <Stack space="2xs">
        <span className="text-xs font-medium text-muted-fg">
          {t("wrap（既定）— 入り切らなければ折り返す")}
        </span>
        <Inline space="sm">
        {[
          "TypeScript",
          "React",
          "Astro",
          "Tailwind",
          "Vite",
          "shadcn",
          t("アクセシビリティ"),
          t("レイアウト"),
          t("状態管理"),
        ].map((t) => (
          <Blk key={t}>{t}</Blk>
        ))}
        </Inline>
      </Stack>

      <Stack space="2xs">
        <span className="text-xs font-medium text-muted-fg">
          wrap={"{false}"} {t("— 折り返さず、入り切らなければ横スクロール")}
        </span>
        <Inline space="sm" wrap={false}>
          {[
            t("折り返さない長いラベル 1"),
            t("折り返さない長いラベル 2"),
            t("折り返さない長いラベル 3"),
            t("折り返さない長いラベル 4"),
          ].map((t) => (
            <Blk key={t}>{t}</Blk>
          ))}
        </Inline>
      </Stack>
    </Panel>
  );
}

/**
 * いま縦積みかどうかの表示は、**CSS で出し分けます。**
 *
 * JS で測る案を 2 つ試して、どちらも古い表示が残りました。
 *   - ResizeObserver … 描画が止まっているタブでは発火しません
 *   - matchMedia の change … 同上
 *
 * 畳む条件は部品と同じメディアクエリなので、**同じ仕組みで出せば
 * ずれようがありません。** `<details>` を使うのと同じ考え方です。
 *
 * Tailwind はクラス名を文字列として静的に探します。
 * 変数で組み立てたクラス名は出力に含まれないので、literal で並べます。
 */
const COLLAPSE = [
  {
    value: "tablet",
    label: t("tablet（既定）"),
    note: t("768px 未満で縦積み"),
    stacked: "md:hidden",
    row: "hidden md:inline",
  },
  {
    value: "desktop",
    label: "desktop",
    note: t("1024px 未満で縦積み"),
    stacked: "lg:hidden",
    row: "hidden lg:inline",
  },
  { value: null, label: "null", note: t("畳まない"), stacked: "hidden", row: "" },
] as const;

function ColumnsDemo() {
  const [collapse, setCollapse] =
    React.useState<(typeof COLLAPSE)[number]["value"]>("tablet");

  const current = COLLAPSE.find((c) => c.value === collapse)!;

  return (
    <Panel
      title={t("Columns / Column — 段組")}
      description={
        <>
          <strong className="text-fg">{t("狭い画面では縦に畳みます。")}</strong>
          {t("畳んでいる間は")} <code className="text-fg">width</code>{" "}
          {t("の指定は効きません（1/3 のまま縦に並べても読みにくいだけなので、\r\n          全幅にします）。いつ畳むかは")}{" "}
          <code className="text-fg">collapseBelow</code> {t("で変えられます。")}
        </>
      }
      code={`<Columns space="md" collapseBelow={${
        collapse === null ? "null" : `"${collapse}"`
      }}>
  <Column width="1/3"><Nav /></Column>
  <Column><Article /></Column>
</Columns>`}
    >
      <Stack space="md">
        <Inline space="xs" alignY="center">
          {COLLAPSE.map((c) => (
            <Button
              key={String(c.value)}
              size="sm"
              /* **色だけでは伝わりません。** 読み上げには「3 つのボタン」
                 としか見えず、どれが選ばれているか分かりません。
                 アクセシビリティを売りにしている以上、デモ自身が手本であるべきです。 */
              aria-pressed={collapse === c.value}
              variant={collapse === c.value ? "primary" : "outline"}
              onClick={() => setCollapse(c.value)}
            >
              {c.label}
            </Button>
          ))}
          {/* いまの状態。**これが無いと「1/3 と書いてあるのに全幅」に見えます。**
              畳んでいる間は幅の指定が効かないのが正しい姿ですが、
              そう書いていないと不具合に見えます（作者の指摘）。 */}
          <span className="text-xs text-muted-fg">
            {current.note} {t("— いまは")}
            <strong className={`text-fg ${current.stacked}`}>
              {t("縦積み（width は効きません）")}
            </strong>
            <strong className={`text-fg ${current.row}`}>{t("横並び")}</strong>
          </span>
        </Inline>

        <Columns space="md" collapseBelow={collapse}>
          <Column width="1/3">
            <Blk h="h-20">width=&quot;1/3&quot;</Blk>
          </Column>
          <Column>
            <Blk h="h-20">{t("width=&quot;auto&quot;（残りを埋める）")}</Blk>
          </Column>
        </Columns>

        <Columns space="md" collapseBelow={collapse}>
          <Column width="18rem">
            <Blk h="h-16">{t("width=&quot;18rem&quot;（段階外）")}</Blk>
          </Column>
          <Column>
            <Blk h="h-16">auto</Blk>
          </Column>
        </Columns>
      </Stack>
    </Panel>
  );
}

function TilesDemo() {
  return (
    <Panel
      title={t("Tiles — 等間隔グリッド")}
      description={t("要素数が半端でも崩れません。列数は画面幅ごとに指定できます。列数を決めず、幅で自動的に折り返させることもできます。")}
      code={t("<Tiles columns={{ mobile: 2, tablet: 3, desktop: 4 }} space=\"md\" />\n\n// 列数を決めない書き方\n<Tiles columns=\"repeat(auto-fill, minmax(9rem, 1fr))\" space=\"md\" />")}
    >
      <Stack space="md">
        <Tiles columns={{ mobile: 2, tablet: 3, desktop: 4 }} space="md">
          {Array.from({ length: 7 }).map((_, i) => (
            <Blk key={i} h="h-16">
              {i + 1}
            </Blk>
          ))}
        </Tiles>
        <Tiles columns="repeat(auto-fill, minmax(9rem, 1fr))" space="sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <Blk key={i} h="h-12">
              auto {i + 1}
            </Blk>
          ))}
        </Tiles>
      </Stack>
    </Panel>
  );
}

function PageDemo() {
  return (
    <Panel
      title="PageBlock / ContentBlock / Spread / Section"
      description={t("ページ全体の骨格。最大幅・左右の余白・上下のリズムをこれらが持ちます。")}
      code={`<PageBlock>\n  <Section space="2xl">\n    <Spread><Logo /><Nav /></Spread>\n  </Section>\n</PageBlock>`}
    >
      <Box background="muted" radius="lg">
        <PageBlock width="narrow" gutter="md">
          <Section space="lg">
            <Stack space="md">
              <Spread>
                <Blk>{t("ロゴ")}</Blk>
                <Inline space="xs">
                  <Blk>Works</Blk>
                  <Blk>About</Blk>
                </Inline>
              </Spread>
              <Divider />
              <ContentBlock width="prose" className="text-sm">
                <p className="leading-relaxed text-muted-fg">
                  {t("ContentBlock は本文の幅を制限します。prose は em 単位なので、\r\n                  文字を小さくすると幅も自動的に狭まり、1 行の字数が保たれます。")}
                </p>
              </ContentBlock>
            </Stack>
          </Section>
        </PageBlock>
      </Box>
    </Panel>
  );
}

