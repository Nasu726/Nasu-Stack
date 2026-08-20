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
  state: (
    <Stack space="3xl">
      <ButtonSection />
      <FormSection />
      <ListSection />
      <AbortSection />
      <GuardRaceSection />
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

function ButtonSection() {
  return (
    <Panel
      title="ActionButton"
      description={
        <>
          <code className="text-fg">action</code> {t("に関数を渡すだけ。\r\n          押している間の無効化、連打の防止、成功の表示、失敗時のメッセージ、\r\n          自動リトライが最初から入っています。")}
        </>
      }
      code={t("<ActionButton action={() => api.save(form)}>\n  保存する\n</ActionButton>")}
    >
      <Inline space="lg" alignY="start">
        <Labeled label={t("成功する")}>
          <ActionButton action={api.save} labels={{ success: t("保存しました") }}>
            {t("保存する")}
          </ActionButton>
        </Labeled>

        <Labeled label={t("失敗する")}>
          <ActionButton action={api.alwaysFail}>{t("送信する")}</ActionButton>
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
            labels={{ success: t("できました") }}
          >
            {t("控えめに実行")}
          </ActionButton>
        </Labeled>

        <Labeled label={t("2 回失敗 → 自動で 3 回目")}>
          <ActionButton action={api.flaky} retry={3} retryDelay={400}>
            {t("同期する")}
          </ActionButton>
        </Labeled>

        <Labeled label={t("確認つき")}>
          <ActionButton
            action={api.save}
            variant="danger"
            confirm={t("本当に削除しますか？")}
            labels={{ success: t("削除しました") }}
          >
            {t("削除する")}
          </ActionButton>
        </Labeled>

        {/* 下の 2 つは**検査のために置いてあります。**
            どちらも「action が何回呼ばれたか」を画面に出します。
            見た目のデモではないので、数だけ読めれば十分です。 */}
        <Labeled label={t("callback が投げる")}>
          <CallCounted
            id="cb"
            retry={3}
            // action は成功する。**その後の onSuccess が投げる。**
            // 成功済みの副作用を retry で繰り返してはいけない。
            onSuccess={() => {
              throw new Error(t("callback がわざと失敗します"));
            }}
          />
        </Labeled>

        <Labeled label={t("guard が遅い")}>
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
        {t("見本です。押しても実際には何も送信されません。")}
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
        {t("実行する")}
      </ActionButton>
      <span className="text-xs text-muted-fg" data-testid={`calls-${id}`}>
        {t("呼ばれた回数:")} {count}
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
          {t("送信関数を 1 つ渡すだけ。")}
          <code className="text-fg">ActionError</code> {t("の")}{" "}
          <code className="text-fg">fields</code> {t("に入れたエラーは、\r\n          対応する入力欄の下へ自動で表示され、打ち直すと消えます。\r\n          メールを空欄にするか")} <code>a@example.com</code> {t("を入れると、\r\n          失敗したときの表示を確認できます。")}
        </>
      }
      code={t("<AsyncForm action={api.signup} submitLabel=\"アカウントを作成\">\n  <Field name=\"email\" label=\"メールアドレス\" type=\"email\" required />\n</AsyncForm>")}
    >
      <ContentBlock width="28rem" align="start">
        <AsyncForm
          action={api.signup}
          submitLabel={t("アカウントを作成")}
          successMessage={t("登録が完了しました")}
        >
          <Field name="name" label={t("お名前")} placeholder={t("山田 太郎")} required />
          <Field
            name="email"
            label={t("メールアドレス")}
            type="email"
            placeholder="you@example.jp"
            hint={t("確認メールを送ります")}
            required
          />
          <Field
            name="password"
            label={t("パスワード")}
            type="password"
            hint={t("8 文字以上")}
            required
          />
        </AsyncForm>
        <p className="mt-xs text-xs text-muted-fg">
          {t("見本です。押しても実際には何も送信されません。")}
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
      description={t("取得・スケルトン・空状態・失敗と再試行を 1 コンポーネントに閉じ込めています。下のボタンで各状態を確認できます。")}
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
            {k === "ok" ? t("データあり") : k === "empty" ? t("空") : t("失敗")}
          </Button>
        ))}
      </Inline>

      <DataList
        key={which}
        title={t("タスク")}
        loader={loader}
        deps={[which]}
        getKey={(task) => task.id}
        renderItem={(task) => (
          <Spread space="sm">
            <span className={task.done ? "text-muted-fg line-through" : ""}>
              {task.title}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg">
              {task.owner}
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
      title={t("中断とスケルトン")}
      description={t("6 秒かかる処理です。実行中に「中断」を押すとリクエストが止まり、状態が idle に戻ります。ctx.signal を fetch に渡すだけで実現できます。")}
    >
      <Inline space="sm">
        <Button
          onClick={() => void slow.run(undefined)}
          disabled={slow.isPending}
        >
          {slow.isPending ? t("処理中…") : t("重い処理を実行")}
        </Button>
        <Button variant="outline" onClick={slow.abort} disabled={!slow.isPending}>
          {t("中断")}
        </Button>
        <span className="text-xs text-muted-fg" data-testid="abort-status">
          status: {slow.status}
        </span>
      </Inline>

      <AsyncBoundary
        state={slow}
        loading={
          slow.isPending ? undefined : (
            <p className="text-sm text-muted-fg">{t("実行するとここに結果が出ます")}</p>
          )
        }
        skeletonRows={3}
        isEmpty={() => false}
      >
        {() => <p className="text-sm text-success">{t("処理が完了しました")}</p>}
      </AsyncBoundary>
    </Panel>
  );
}


/* ---------------------------------------------------------------- */

/**
 * guard を待っている間の中断。
 *
 * ----------------------------------------------------------------
 * ここは見た目のデモではありません
 * ----------------------------------------------------------------
 * **「押した後にやめたのに、実行された」を数で見るための題材です。**
 *
 * v0.9d までは `AbortController` を guard の後に作っていたので、
 * 確認ダイアログや通信を待っている間に中断しても止まりませんでした。
 * 画面を離れた後に削除や決済が始まる、という壊れ方をします。
 *
 * 見た目では分からないので、**action が何回呼ばれたか**を出します。
 */
function GuardRaceSection() {
  const [alive, setAlive] = React.useState(true);
  const [calls, setCalls] = React.useState(0);
  const [rejections, setRejections] = React.useState(0);

  /* 握られなかった Promise の数。**これが増えたら契約が壊れています。** */
  React.useEffect(() => {
    const on = () => setRejections((n) => n + 1);
    window.addEventListener("unhandledrejection", on);
    return () => window.removeEventListener("unhandledrejection", on);
  }, []);

  return (
    <Panel
      title={t("guard を待っている間の中断")}
      description={
        <>
          <code className="text-fg">guard</code>{" "}
          {t("が非同期のとき、待っている間に中断したり画面を離れたりできます。")}
          <strong className="text-fg">{t("そのあと action が始まってはいけません。")}</strong>
          {t("削除・決済・送信だと、利用者が「やめた」と思った後に起きます。\r\n          下の guard は")} <strong className="text-fg">{t("中断を自分では見ていません")}</strong>{t("——\r\n          それでも止まります。下の数字が増えなければ止まっています。")}
        </>
      }
      code={t("const state = useAction(api.remove, {\n  // ctx.signal を渡せば、guard の中の通信も一緒に止まります\n  guard: async (input, ctx) => confirmSomething(input, ctx),\n});\n\nstate.abort();   // guard を待っている間でも効きます")}
    >
      <Inline space="md" alignY="start">
        {alive ? (
          <SlowGuard onCall={() => setCalls((n) => n + 1)} />
        ) : (
          <span className="text-xs text-muted-fg">{t("画面から消しました")}</span>
        )}
        <Stack space="2xs" align="start">
          <Button size="sm" variant="outline" onClick={() => setAlive((v) => !v)}>
            {alive ? t("画面から消す") : t("戻す")}
          </Button>
          <span className="text-xs text-muted-fg" data-testid="guard-calls">
            {t("action が呼ばれた回数:")} {calls}
          </span>
          <span className="text-xs text-muted-fg" data-testid="unhandled-rejections">
            {t("握られなかった失敗:")} {rejections}
          </span>
        </Stack>
      </Inline>

      <p className="text-xs text-muted-fg">
        {t("見本です。押しても実際には何も送信されません。")}
      </p>
    </Panel>
  );
}

/** 1 秒待つ guard を持つボタン。待っている間に中断／退場できます。 */
function SlowGuard({ onCall }: { onCall: () => void }) {
  const state = useAction(
    async () => {
      onCall();
      await new Promise((r) => setTimeout(r, 200));
      return { ok: true };
    },
    {
      /* **わざと signal を見ない guard にしてあります。**
         初心者が書くのはこの形です。「中断されたかどうか」を
         guard の中で気にしなくても、部品の側が止めます。
         guard 自身が `ctx.signal.aborted` を見てしまうと、
         部品が直っているのか guard が親切なだけなのか分かりません。 */
      guard: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return true;
      },
      resetAfter: 0,
    },
  );

  return (
    <Stack space="2xs" align="start">
      <Inline space="xs">
        <Button
          onClick={() => void state.run(undefined)}
          disabled={state.isPending}
        >
          {state.isPending ? t("確認中…") : t("確認してから実行")}
        </Button>
        <Button variant="outline" onClick={state.abort} disabled={!state.isPending}>
          {t("確認中にやめる")}
        </Button>
      </Inline>
      <span className="text-xs text-muted-fg" data-testid="guard-status">
        status: {state.status}
      </span>
    </Stack>
  );
}
/* ---------------------------------------------------------------- */

/* ActionProvider は余白や段組の話ではないので、「状態」の章に置いています。
   探す人が見るのはこちらのはずです。 */
function ToastSection() {
  const toast = useToast();

  return (
    <Panel
      title={t("ActionProvider — 書き忘れの受け皿")}
      description={
        <>
          <code className="text-fg">onError</code> {t("を書かなかったアクションが失敗すると、\r\n          画面隅に通知が出ます。エラー処理の書き忘れが握り潰されなくなります。\r\n          個別に")} <code className="text-fg">onError</code> {t("を書いた場合はそちらが優先され、通知は出ません。")}
        </>
      }
      code={`<ActionProvider>\n  <App />\n</ActionProvider>`}
    >
      <Inline space="sm">
        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error(t("在庫の取得に失敗しました"));
          }}
          showError={false}
          variant="outline"
        >
          {t("onError を書かずに失敗させる")}
        </ActionButton>

        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error(t("これは通知されない"));
          }}
          onError={(e) => {
            toast.show({
              tone: "warning",
              title: t("自前で処理しました"),
              description: e.displayMessage,
            });
          }}
          showError={false}
          variant="outline"
        >
          {t("onError を自分で書く")}
        </ActionButton>

        <Button
          variant="ghost"
          onClick={() =>
            toast.show({
              tone: "success",
              title: t("保存しました"),
              description: t("3 件の変更を反映しました"),
              action: { label: t("元に戻す"), onClick: () => {} },
            })
          }
        >
          {t("通知を直接出す")}
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
