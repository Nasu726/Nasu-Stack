import * as React from "react";
import { ActionButton, Button } from "@/components/ui/action-button";
import { AsyncForm, Field } from "@/components/ui/async-form";
import { DataList } from "@/components/ui/data-list";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { ThemeSwitcher, useTheme } from "@/components/ui/theme-provider";
import { useAction } from "@/hooks/use-action";
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
import { useToast } from "@/components/ui/action-provider";
import { LayoutDemo } from "./LayoutDemo";
import { ResponsiveDemo } from "./ResponsiveDemo";
import { PartsDemo } from "./PartsDemo";
import { FormsDemo } from "./FormsDemo";
import { NavDemo } from "./NavDemo";
import { TextDemo } from "./TextDemo";
import * as api from "./fake-api";
import { TABS, normalizeTab } from "./tabs.mjs";

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
  state: (
    <Stack space="3xl">
      <ButtonSection />
      <FormSection />
      <ListSection />
      <AbortSection />
      <ToastSection />
    </Stack>
  ),
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
    <Panel title="この章はまだ準備中です" description={null}>
      <p className="text-sm text-muted-fg">
        まだ中身がありません。他のタブをご覧ください。
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
            <span className="font-display text-lg">WebTemplate</span>
            <span className="text-xs text-muted-fg">/ {theme}</span>
          </Inline>

          {/* 狭いとき: ブランドと同じ行の右端。広いとき: いちばん右。
              **shrink-0 を付けてはいけません。** 320px ではトンマナの
              4 ボタンが入り切らず、15px はみ出しました（実測）。
              ThemeSwitcher は自分で折り返せるので、縮めるほうを許します。 */}
          <div className="order-2 ms-auto min-w-0 lg:order-3 lg:ms-0">
            <ThemeSwitcher />
          </div>

          {/* 配布している Tabs をそのまま使っています。
              自分で使わない部品は必ず腐るので、手書きの button 列から
              差し替えました（矢印キー・roving tabindex が付きます）。 */}
          <Tabs
            items={TABS.map((t) => ({ value: t.key, label: t.label }))}
            value={tab}
            onValueChange={(k) => {
              onTab(k);
              // 検査スクリプトが直接そのタブを開けるように URL を合わせる
              const u = new URL(window.location.href);
              u.searchParams.set("tab", k);
              window.history.replaceState(null, "", u);
            }}
            label="カタログの章"
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

function Intro() {
  return (
    <Stack space="sm">
      <h1 className="text-3xl leading-tight sm:text-4xl">
        余白は迷わせない。
        <br />
        状態は書かせない。
      </h1>
      <ContentBlock width="prose" align="start" className="text-sm">
        <p className="leading-relaxed text-muted-fg">
          余白は 9 段階が既定なので配置で迷いません。ただし 9 段階は制限ではなく、
          段階に無い値もそのまま書けます。
          非同期処理は関数を 1 つ渡すだけで、読込中・成功・失敗・空・二重送信・中断が付いてきます。
          上のスイッチでトンマナ（見た目の系統）を切り替えると、
          色・角丸・影・書体・余白の広さまで一斉に変わります。
        </p>
      </ContentBlock>
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function ButtonSection() {
  return (
    <Panel
      title="ActionButton"
      description={
        <>
          <code className="text-fg">action</code> に関数を渡すだけ。
          押している間の無効化、連打の防止、成功の表示、失敗時のメッセージ、
          自動リトライが最初から入っています。
        </>
      }
      code={`<ActionButton action={() => api.save(form)}>\n  保存する\n</ActionButton>`}
    >
      <Inline space="lg" alignY="start">
        <Labeled label="成功する">
          <ActionButton action={api.save} labels={{ success: "保存しました" }}>
            保存する
          </ActionButton>
        </Labeled>

        <Labeled label="失敗する">
          <ActionButton action={api.alwaysFail}>送信する</ActionButton>
        </Labeled>

        {/* variant を変えたときの成功表示。**検査対象として必要です。**
            既定（primary）の hover は brightness なので背景色が変わらず、
            「成功色が hover で消える」不具合を通してしまいます。
            背景を差し替える hover を持つ outline を 1 つ置いて、
            検査がそこを見られるようにしています。 */}
        <Labeled label="outline">
          <ActionButton
            action={api.save}
            variant="outline"
            labels={{ success: "できました" }}
          >
            控えめに実行
          </ActionButton>
        </Labeled>

        <Labeled label="2 回失敗 → 自動で 3 回目">
          <ActionButton action={api.flaky} retry={3} retryDelay={400}>
            同期する
          </ActionButton>
        </Labeled>

        <Labeled label="確認つき">
          <ActionButton
            action={api.save}
            variant="danger"
            confirm="本当に削除しますか？"
            labels={{ success: "削除しました" }}
          >
            削除する
          </ActionButton>
        </Labeled>

        {/* 下の 2 つは**検査のために置いてあります。**
            どちらも「action が何回呼ばれたか」を画面に出します。
            見た目のデモではないので、数だけ読めれば十分です。 */}
        <Labeled label="callback が投げる">
          <CallCounted
            id="cb"
            retry={3}
            // action は成功する。**その後の onSuccess が投げる。**
            // 成功済みの副作用を retry で繰り返してはいけない。
            onSuccess={() => {
              throw new Error("callback がわざと失敗します");
            }}
          />
        </Labeled>

        <Labeled label="guard が遅い">
          <CallCounted
            id="guard"
            // 非同期の guard。await している間に鍵がかかっていないと、
            // 連打が全部その隙間を通り抜ける。
            guard={async () => {
              await new Promise((r) => setTimeout(r, 150));
              return true;
            }}
          />
        </Labeled>
      </Inline>
      <p className="text-xs text-muted-fg">
        見本です。押しても実際には何も送信されません。
      </p>
    </Panel>
  );
}

/**
 * action が**何回呼ばれたか**を画面に出すボタン。
 *
 * 「押せない」ことではなく「何回実行されたか」を見るための題材です。
 * 二重決済・二重送信は、UI がどう見えるかではなく回数の問題なので、
 * 回数そのものを読めるようにしてあります。
 */
function CallCounted({
  id,
  ...opts
}: {
  id: string;
  retry?: number;
  guard?: (input: void) => boolean | Promise<boolean>;
  onSuccess?: () => void;
}) {
  const [count, setCount] = React.useState(0);
  return (
    <Stack space="2xs">
      <ActionButton
        {...opts}
        retryDelay={50}
        action={async () => {
          setCount((n) => n + 1);
          await new Promise((r) => setTimeout(r, 30));
          return { ok: true };
        }}
      >
        実行する
      </ActionButton>
      <span className="text-xs text-muted-fg" data-testid={`calls-${id}`}>
        呼ばれた回数: {count}
      </span>
    </Stack>
  );
}

/** 見出しつきの縦組み。デモで「何を試しているか」を示すためだけの薄い包み。 */
function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Stack space="2xs" align="start">
      <span className="text-xs font-medium text-muted-fg">{label}</span>
      {children}
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function FormSection() {
  return (
    <Panel
      title="AsyncForm + Field"
      description={
        <>
          送信関数を 1 つ渡すだけ。
          <code className="text-fg">ActionError</code> の{" "}
          <code className="text-fg">fields</code> に入れたエラーは、
          対応する入力欄の下へ自動で表示され、打ち直すと消えます。
          メールを空欄にするか <code>a@example.com</code> を入れると、
          失敗したときの表示を確認できます。
        </>
      }
      code={`<AsyncForm action={api.signup} submitLabel="アカウントを作成">\n  <Field name="email" label="メールアドレス" type="email" required />\n</AsyncForm>`}
    >
      <ContentBlock width="28rem" align="start">
        <AsyncForm
          action={api.signup}
          submitLabel="アカウントを作成"
          successMessage="登録が完了しました"
        >
          <Field name="name" label="お名前" placeholder="山田 太郎" required />
          <Field
            name="email"
            label="メールアドレス"
            type="email"
            placeholder="you@example.jp"
            hint="確認メールを送ります"
            required
          />
          <Field
            name="password"
            label="パスワード"
            type="password"
            hint="8 文字以上"
            required
          />
        </AsyncForm>
        <p className="mt-xs text-xs text-muted-fg">
          見本です。押しても実際には何も送信されません。
        </p>
      </ContentBlock>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function ListSection() {
  const [which, setWhich] = React.useState<"ok" | "empty" | "error">("ok");
  const loader =
    which === "ok"
      ? api.listTasks
      : which === "empty"
        ? api.listEmpty
        : api.listBroken;

  return (
    <Panel
      title="DataList / AsyncBoundary"
      description="取得・スケルトン・空状態・失敗と再試行を 1 コンポーネントに閉じ込めています。下のボタンで各状態を確認できます。"
      code={`<DataList\n  loader={(_, ctx) => jsonRequest<Task[]>("/api/tasks", { ctx })}\n  renderItem={(t) => <span>{t.title}</span>}\n/>`}
    >
      <Inline space="xs">
        {(["ok", "empty", "error"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={which === k ? "primary" : "outline"}
            onClick={() => setWhich(k)}
          >
            {k === "ok" ? "データあり" : k === "empty" ? "空" : "失敗"}
          </Button>
        ))}
      </Inline>

      <DataList
        key={which}
        title="タスク"
        loader={loader}
        deps={[which]}
        getKey={(t) => t.id}
        renderItem={(t) => (
          <Spread space="sm">
            <span className={t.done ? "text-muted-fg line-through" : ""}>
              {t.title}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg">
              {t.owner}
            </span>
          </Spread>
        )}
      />
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function AbortSection() {
  const slow = useAction(api.slow, { resetAfter: 3000 });

  return (
    <Panel
      title="中断とスケルトン"
      description="6 秒かかる処理です。実行中に「中断」を押すとリクエストが止まり、状態が idle に戻ります。ctx.signal を fetch に渡すだけで実現できます。"
    >
      <Inline space="sm">
        <Button
          onClick={() => void slow.run(undefined)}
          disabled={slow.isPending}
        >
          {slow.isPending ? "処理中…" : "重い処理を実行"}
        </Button>
        <Button variant="outline" onClick={slow.abort} disabled={!slow.isPending}>
          中断
        </Button>
        <span className="text-xs text-muted-fg">status: {slow.status}</span>
      </Inline>

      <AsyncBoundary
        state={slow}
        loading={
          slow.isPending ? undefined : (
            <p className="text-sm text-muted-fg">実行するとここに結果が出ます</p>
          )
        }
        skeletonRows={3}
        isEmpty={() => false}
      >
        {() => <p className="text-sm text-success">処理が完了しました</p>}
      </AsyncBoundary>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

/* ActionProvider は余白や段組の話ではないので、「状態」の章に置いています。
   探す人が見るのはこちらのはずです。 */
function ToastSection() {
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
              幅を変えても崩れません
            </h1>
            <ContentBlock width="prose" align="start" className="text-sm">
              <p className="leading-relaxed text-muted-fg">
                段組は狭い画面で自動的に縦へ畳み、タイルは列数が変わり、
                タグは折り返します。長い URL も折れます。
                https://example.com/very/long/path/that/never/breaks/anywhere
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
            {["A", "B", "C"].map((t) => (
              <div
                key={t}
                className="rounded-md border border-border bg-card px-sm py-xs text-xs"
              >
                カード {t}
              </div>
            ))}
          </Tiles>

          <Inline space="xs">
            {["TypeScript", "React", "Astro", "Tailwind", "アクセシビリティ"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg"
                >
                  {t}
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
        <p className="text-xs text-muted-fg">WebTemplate — MIT License</p>
      </PageBlock>
    </footer>
  );
}
