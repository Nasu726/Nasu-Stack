import * as React from "react";
import { ActionButton, Button } from "@/components/ui/action-button";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { useAction } from "@/hooks/use-action";
import { useInteractionGuard } from "@/hooks/use-interaction-guard";
import { ActionError } from "@/lib/action";
import { Inline, Stack } from "@/components/ui/layout";
import { Panel } from "../Panel";
import * as api from "../fake-api";
import { t } from "../lang";

export function ButtonSection() {
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
          <ActionButton
            action={api.alwaysFail}
            retry={1}
            retryDelay={() => {
              // policy callback も利用者が渡す境界です。ここから例外が出ても
              // run() の Promise を未処理のまま外へ逃がしてはいけません。
              throw new Error(t("callback がわざと失敗します"));
            }}
          >
            {t("送信する")}
          </ActionButton>
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

/**
 * 非同期の状態を要らない操作に、useAction 一式を要求しないための見本。
 * 鍵を外す時点はドメイン側の判断なので、自動タイマーを持たせません。
 */
export function InteractionGuardSection() {
  const guard = useInteractionGuard();
  const [calls, setCalls] = React.useState(0);

  const tryProceed = () => {
    if (!guard.tryLock()) return;
    setCalls((n) => n + 1);
  };

  return (
    <Panel
      title="useInteractionGuard"
      description={t("同じ画面操作の重なりだけを止めます。通信の状態、成功表示、retry、AbortSignal は持ちません。それらが必要なら useAction を選びます。いつ再び許可するかは、操作の意味を知る利用側が release() で決めます。")}
      code={t("const next = useInteractionGuard();\n\nfunction goNext() {\n  if (!next.tryLock()) return;\n  router.push(\"/checkout\");\n}\n\n<Button onClick={goNext} disabled={next.isLocked}>\n  次へ\n</Button>\n\n// 同じ画面でやり直せるようになった時だけ\nnext.release();")}
    >
      <Inline space="sm" alignY="center">
        <Button onClick={tryProceed} disabled={guard.isLocked}>
          {guard.isLocked ? t("操作を受け付けました") : t("次へ進む")}
        </Button>
        <Button
          variant="outline"
          onClick={guard.release}
          disabled={!guard.isLocked}
        >
          {t("もう一度許可する")}
        </Button>
        <output
          className="text-xs text-muted-fg"
          data-testid="interaction-guard-state"
          data-locked={guard.isLocked ? "true" : "false"}
          aria-live="polite"
        >
          {t("通った回数:")} {calls} / {guard.isLocked ? t("停止中") : t("受付中")}
        </output>
      </Inline>

      {/* 同じ描画の間に起きる連打を、見た目の disabled に頼らず検査します。
          hidden なのでカタログの操作や読み上げには混ざりません。 */}
      <button
        type="button"
        hidden
        data-testid="interaction-guard-probe"
        onClick={tryProceed}
      >
        probe
      </button>
    </Panel>
  );
}

/** clipboardの可否と、コピーしてよい情報かの判断を混ぜないための見本。 */
export function RetryDelayProbe() {
  return (
    <div hidden data-testid="retry-delay-probe">
      <RetryDelayCase id="nan" delay={Number.NaN} />
      <RetryDelayCase id="infinity" delay={Number.POSITIVE_INFINITY} />
      <RetryDelayCase id="negative" delay={-1} />
      <GuardForwardProbe />
      <ValidationRetryProbe />
    </div>
  );
}

function GuardForwardProbe() {
  const [calls, setCalls] = React.useState(0);
  return (
    <div data-testid="action-guard-forward-probe">
      <ActionButton
        data-testid="action-guard-forward-run"
        pendingDuringGuard={false}
        guard={async () => {
          await new Promise((resolve) => setTimeout(resolve, 220));
          return true;
        }}
        action={async () => {
          setCalls((count) => count + 1);
          await new Promise((resolve) => setTimeout(resolve, 180));
        }}
      >
        guard forward
      </ActionButton>
      <output data-testid="action-guard-forward-calls">{calls}</output>
    </div>
  );
}

function ValidationRetryProbe() {
  const [calls, setCalls] = React.useState(0);
  const state = useAction(
    async () => {
      setCalls((count) => count + 1);
      throw new ActionError("validation retry probe", {
        code: 400,
        fields: { email: "invalid" },
      });
    },
    { retry: 2, retryDelay: 10 },
  );
  return (
    <div data-testid="validation-retry-probe">
      <button
        type="button"
        data-testid="validation-retry-run"
        onClick={() => void state.run()}
      >
        run
      </button>
      <output data-testid="validation-retry-state">
        {state.status}:{calls}
      </output>
    </div>
  );
}

function RetryDelayCase({ id, delay }: { id: string; delay: number }) {
  const state = useAction(
    async () => {
      throw new Error("retry-delay probe");
    },
    { retry: 1, retryDelay: () => delay },
  );

  return (
    <>
      <button
        type="button"
        data-testid={`retry-delay-${id}-run`}
        onClick={() => void state.run()}
      >
        run
      </button>
      <output data-testid={`retry-delay-${id}-state`}>
        {state.status}:{state.error?.code ?? ""}
      </output>
    </>
  );
}

/** duration を明示した操作付き通知まで永続化しないことを測る治具。 */
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

export function AbortSection() {
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
export function GuardRaceSection() {
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
