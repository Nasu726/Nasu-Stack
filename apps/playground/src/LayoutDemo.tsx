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
import { ActionButton, Button } from "@/components/ui/action-button";
import { useToast } from "@/components/ui/action-provider";

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
      <ToastDemo />
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function Panel({
  title,
  description,
  children,
  code,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  code?: string;
}) {
  return (
    <Stack space="md">
      <Stack space="2xs">
        <h2 className="text-xl">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-fg">{description}</p>
      </Stack>
      <Box padding="lg" background="card" border radius="xl" shadow="e1">
        <Stack space="md">
          {children}
          {code && (
            <pre className="overflow-x-auto rounded-md bg-muted p-sm text-[11px] leading-relaxed text-muted-fg">
              <code>{code}</code>
            </pre>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

/** 見た目の当たり判定を分かりやすくするための塗り。 */
function Blk({
  children,
  h,
}: {
  children?: React.ReactNode;
  h?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-md bg-accent px-sm py-xs text-xs text-accent-fg ${h ?? ""}`}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function SpaceScale() {
  return (
    <Panel
      title="余白の既定は 9 段階"
      description={
        <>
          入力補完に出るのはこの 9 つだけなので、迷わずに済みます。
          ただし壁ではありません。<code className="text-fg">space=&quot;13px&quot;</code>{" "}
          のように段階に無い値もそのまま書けます（Tailwind の{" "}
          <code className="text-fg">p-4</code> と{" "}
          <code className="text-fg">p-[13px]</code> の関係と同じです）。
          段階ごとの実寸はテーマで変わるので、上のスイッチを切り替えると幅も変わります。
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
      title="Stack — 縦に積む"
      description="いちばん使う部品です。子側に margin を書く必要はありません。"
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
          <span className="text-xs text-muted-fg">段階に無い値も書けます:</span>
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setSpace(e.target.value);
            }}
            aria-label="任意の余白"
            className="w-44 rounded-md border border-input bg-card px-2 py-1 text-xs"
          />
          <Button
            size="sm"
            variant={!isToken ? "primary" : "outline"}
            onClick={() => setSpace(custom)}
          >
            適用
          </Button>
        </Inline>
      </Stack>

      <Stack space={space}>
        <Blk>A</Blk>
        <Blk>B</Blk>
        <Blk>C</Blk>
      </Stack>
    </Panel>
  );
}

function InlineDemo() {
  return (
    <Panel
      title="Inline — 横に並べて折り返す"
      description="画面が狭くなると自動で折り返すので、はみ出しません。ウィンドウ幅を変えてみてください。"
      code={`<Inline space="sm">\n  {tags.map((t) => <Tag key={t} />)}\n</Inline>`}
    >
      <Inline space="sm">
        {[
          "TypeScript",
          "React",
          "Astro",
          "Tailwind",
          "Vite",
          "shadcn",
          "アクセシビリティ",
          "レイアウト",
          "状態管理",
        ].map((t) => (
          <Blk key={t}>{t}</Blk>
        ))}
      </Inline>
    </Panel>
  );
}

function ColumnsDemo() {
  return (
    <Panel
      title="Columns / Column — 段組"
      description="既定でタブレット幅より狭いと縦に畳みます。スマホで崩れないのが既定の挙動です。"
      code={`<Columns space="md">\n  <Column width="1/3"><Nav /></Column>\n  <Column><Article /></Column>\n</Columns>`}
    >
      <Stack space="md">
        <Columns space="md">
          <Column width="1/3">
            <Blk h="h-20">width=&quot;1/3&quot;</Blk>
          </Column>
          <Column>
            <Blk h="h-20">width=&quot;auto&quot;（残りを埋める）</Blk>
          </Column>
        </Columns>

        <Columns space="md">
          <Column width="18rem">
            <Blk h="h-16">width=&quot;18rem&quot;（段階外）</Blk>
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
      title="Tiles — 等間隔グリッド"
      description="要素数が半端でも崩れません。列数は画面幅ごとに指定できます。列数を決めず、幅で自動的に折り返させることもできます。"
      code={`<Tiles columns={{ mobile: 2, tablet: 3, desktop: 4 }} space="md" />\n\n// 列数を決めない書き方\n<Tiles columns="repeat(auto-fill, minmax(9rem, 1fr))" space="md" />`}
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
      description="ページ全体の骨格。最大幅・左右の余白・上下のリズムをこれらが持ちます。"
      code={`<PageBlock>\n  <Section space="2xl">\n    <Spread><Logo /><Nav /></Spread>\n  </Section>\n</PageBlock>`}
    >
      <Box background="muted" radius="lg">
        <PageBlock width="narrow" gutter="md">
          <Section space="lg">
            <Stack space="md">
              <Spread>
                <Blk>ロゴ</Blk>
                <Inline space="xs">
                  <Blk>Works</Blk>
                  <Blk>About</Blk>
                </Inline>
              </Spread>
              <Divider />
              <ContentBlock width="narrow">
                <p className="text-sm leading-relaxed text-muted-fg">
                  ContentBlock は読み物向けの幅に制限します。
                  1 行が長くなりすぎると読みにくいので、
                  本文にはこれを使ってください。
                </p>
              </ContentBlock>
            </Stack>
          </Section>
        </PageBlock>
      </Box>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function ToastDemo() {
  const toast = useToast();

  return (
    <Panel
      title="ActionProvider — 書き忘れの受け皿"
      description={
        <>
          <code className="text-fg">onError</code> を書かなかったアクションが失敗すると、
          画面隅に通知が出ます。エラー処理の書き忘れが握り潰されなくなります。
          個別に <code className="text-fg">onError</code> を書いた場合はそちらが優先され、通知は出ません。
        </>
      }
      code={`<ActionProvider>\n  <App />\n</ActionProvider>`}
    >
      <Inline space="sm">
        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error("在庫の取得に失敗しました");
          }}
          showError={false}
          variant="outline"
        >
          onError を書かずに失敗させる
        </ActionButton>

        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error("これは通知されない");
          }}
          onError={(e) =>
            toast.show({
              tone: "warning",
              title: "自前で処理しました",
              description: e.displayMessage,
            })
          }
          showError={false}
          variant="outline"
        >
          onError を自分で書く
        </ActionButton>

        <Button
          variant="ghost"
          onClick={() =>
            toast.show({
              tone: "success",
              title: "保存しました",
              description: "3 件の変更を反映しました",
              action: { label: "元に戻す", onClick: () => {} },
            })
          }
        >
          通知を直接出す
        </Button>
      </Inline>
    </Panel>
  );
}
