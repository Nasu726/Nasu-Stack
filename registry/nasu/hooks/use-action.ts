"use client";

import * as React from "react";
import {
  callSafely,
  type Action,
  type ActionContext,
  ActionError,
  type AsyncState,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";

export interface UseActionOptions<TInput, TOutput> {
  /** 成功時に呼ばれます。async でも構いません（失敗はログに出して握ります）。 */
  onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>;
  /** 失敗時に呼ばれます。ここを未指定にすると ActionProvider の既定処理が走ります。 */
  onError?: (error: ActionError, input: TInput) => void | Promise<void>;
  /** 成否によらず最後に呼ばれます。 */
  onSettled?: () => void | Promise<void>;
  /** 成功状態を何 ms 後に idle へ戻すか。0 で戻しません。既定 2000。 */
  resetAfter?: number;
  /**
   * 失敗時に自動リトライする回数。既定 0。
   *
   * **同じ操作を 2 回やっても結果が変わらないものにだけ付けてください。**
   * 決済・注文の作成・メールの送信は違います。1 回目がサーバに届いた後で
   * 応答だけ失われた場合、リトライは**もう一度実行させます。**
   *
   * どうしても必要なら、サーバ側で同じ要求を 1 回として扱う仕組み
   * （Idempotency-Key など）と対で設計してください。
   * こちら側だけでは判断できません。
   * `VALIDATION` / HTTP 422 は入力を直す必要があるため、自動リトライしません。
   */
  retry?: number;
  /** リトライ間隔 (ms)。関数を渡すと指数バックオフなども書けます。既定 500ms。 */
  retryDelay?: number | ((attempt: number) => number);
  /**
   * 実行前の確認。false を返すと実行しません。
   *
   * `ctx.signal` は `action` に渡すものと同じです。**guard の中で通信するなら
   * 必ず渡してください。** 待っている間に中断されても、それが伝わります。
   *
   * ここで例外を投げると、`action` が失敗したときと同じ経路
   * （`state.error` と `onError`）に乗ります。
   */
  guard?: (input: TInput, ctx: ActionContext) => boolean | Promise<boolean>;
  /**
   * `guard` を待っている間も pending にするか。既定 true。
   *
   * 遅い guard（通信など）では、押したのに何も変わらないと壊れて見えます。
   * だから既定は true です。
   *
   * **確認ダイアログを出す guard では false にしてください。**
   * 表示が変わると、`<dialog>` を閉じたあと**フォーカスが元のボタンへ
   * 戻らなくなります**（body へ落ちます）。実測で確かめました。
   * 待たせているのはダイアログ自身なので、ボタンまで変える必要もありません。
   */
  pendingDuringGuard?: boolean;
}

export interface UseActionResult<TInput, TOutput>
  extends AsyncState<TOutput> {
  /** 実行します。二重呼び出しは自動で無視されます。 */
  run: (input: TInput) => Promise<TOutput | undefined>;
  /** 実行中の処理を中断します。 */
  abort: () => void;
  /** idle に戻します。 */
  reset: () => void;
}

type InternalState<TOutput> = {
  status: AsyncStatus;
  data: TOutput | undefined;
  error: ActionError | undefined;
  attempt: number;
};

const INITIAL: InternalState<never> = {
  status: "idle",
  data: undefined,
  error: undefined,
  attempt: 0,
};

/**
 * 非同期処理の状態を丸ごと引き受けるフック。
 *
 * 利用者は `useState(false)` で loading を作る必要がなく、
 * 二重送信・アンマウント後の setState・キャンセルも自動で処理されます。
 *
 * ```tsx
 * const save = useAction(async (form: Form) => api.save(form), {
 *   onSuccess: () => router.push("/done"),
 * });
 * <button onClick={() => save.run(form)} disabled={save.isPending}>保存</button>
 * ```
 */
export function useAction<TInput = void, TOutput = unknown>(
  action: Action<TInput, TOutput>,
  options: UseActionOptions<TInput, TOutput> = {},
): UseActionResult<TInput, TOutput> {
  const [state, setState] =
    React.useState<InternalState<TOutput>>(INITIAL as InternalState<TOutput>);

  // ActionProvider があればその既定値を、無ければ空を受け取る
  const defaults = useActionDefaults();

  // 再レンダリングのたびに action が新しい関数になっても再実行されないよう ref に逃がす
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  const defaultsRef = React.useRef(defaults);
  defaultsRef.current = defaults;

  const abortRef = React.useRef<AbortController | null>(null);
  const inFlightRef = React.useRef(false);
  /* 操作の世代。**guard を待っている間に abort されたことを、
     戻ってきた側が知るために要ります。** signal だけでは、
     abort のあとに始まった新しい run と見分けが付きません。 */
  const generationRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      generationRef.current++;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const safeSet = React.useCallback(
    (next: Partial<InternalState<TOutput>>) => {
      if (!mountedRef.current) return;
      setState((prev) => ({ ...prev, ...next }));
    },
    [],
  );

  const reset = React.useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    safeSet(INITIAL as InternalState<TOutput>);
  }, [safeSet]);

  const abort = React.useCallback(() => {
    abortRef.current?.abort();
    /* **世代も進めます。** guard を待っている操作は signal を見ていないので、
       これが無いと「戻ってきたら中断済みだった」ことに気づけません。 */
    generationRef.current++;
    inFlightRef.current = false;
    safeSet({ status: "idle" });
  }, [safeSet]);

  const run = React.useCallback(
    async (input: TInput): Promise<TOutput | undefined> => {
      /* --- 二重送信の防止（初心者が最も踏むバグ） ---------------------
         **鍵は guard より前にかけます。**
         以前は `await guard(...)` の後にかけていました。guard が非同期だと、
         待っている間に後続の呼び出しが全部その隙間を通り抜けます。
         実測: 150ms 待つ guard を 5 回連打 → action が **5 回** 実行。

         「連打しても 1 回」はこの部品の契約なので、
         guard を含めて 1 つの操作として鍵をかけます。 */
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;

      const opts = optionsRef.current;
      const dflt = defaultsRef.current;

      /* --- 中断できる状態を、guard より前に作ります -------------------
         v0.9d までは `AbortController` を guard の**後**に作っていました。

           run() → guard を await → abort() → guard が true で解決
                 → ここで初めて controller ができる → action 開始

         `abort()` を呼んだ時点では、この操作の controller がまだ無いので
         **中断できません。** 画面を離れたとき（unmount）も同じで、
         **中断したはずの削除・決済・送信が後から始まります。**

         世代番号も持ちます。`abort()` は世代を進めるので、
         guard から戻ってきた古い操作は自分が用済みだと分かります。
         外部レビューの P1-02。 */
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const generation = ++generationRef.current;
      const ctx: ActionContext = { signal: controller.signal };

      /** この操作がもう用済みか（中断された / 新しい run が来た / 画面が消えた）。 */
      const stale = () =>
        controller.signal.aborted ||
        generation !== generationRef.current ||
        !mountedRef.current;

      /** action 本体が最終的に成功したか。callback の成否とは別に持ちます。 */
      let succeeded = false;
      let result: TOutput | undefined;
      let lastError: ActionError | undefined;
      let aborted = false;

      try {
        if (opts.guard) {
          /* **guard の間も pending にします。** ここを idle のままにすると、
             遅い guard を待っている間ボタンが押せるように見えて、
             押しても何も起きません（壊れて見えます）。

             ただし確認ダイアログのときは変えません（上の説明）。 */
          if (opts.pendingDuringGuard !== false) {
            safeSet({ status: "pending", error: undefined, attempt: 0 });
          }

          let ok: boolean;
          try {
            ok = await opts.guard(input, ctx);
          } catch (raw) {
            /* **guard の例外も、action の失敗と同じ経路に乗せます。**
               ここで throw し返すと `run()` 自体が reject し、
               `ActionButton` は `void state.run(...)` で呼ぶので
               unhandled rejection になります（外部レビューの P2-02）。 */
            lastError = toActionError(raw);
            ok = false;
          }

          if (stale()) {
            aborted = true;
            safeSet({ status: "idle" });
            return undefined;
          }
          if (!ok && !lastError) {
            // 利用者が「やめる」を選んだだけ。エラーではありません。
            safeSet({ status: "idle" });
            return undefined;
          }
        }

        if (!lastError) {
          const requestedRetries = opts.retry ?? dflt.retry ?? 0;
          // retry は「もう一度副作用を起こす」指定です。NaN / Infinity / 負数を
          // 暗黙の回数として扱わず、安全側の 0 回へ寄せます。
          const retries =
            Number.isFinite(requestedRetries) && requestedRetries > 0
              ? Math.floor(requestedRetries)
              : 0;
          const maxAttempts = retries + 1;

          /* ここが retry の境界です。**action 本体だけを繰り返します。**
             callback はこの中に入れません（下のコメント参照）。 */
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            safeSet({ status: "pending", error: undefined, attempt });

            try {
              const data = await actionRef.current(input, ctx);

              if (stale()) {
                aborted = true;
                return undefined;
              }
              succeeded = true;
              result = data;
              break;
            } catch (raw) {
              if (stale()) {
                aborted = true;
                safeSet({ status: "idle" });
                return undefined;
              }

              lastError = toActionError(raw);

              // 入力を直さない限り同じ結果になるvalidation failureを、delayを挟んで
              // 自動再実行しても利用者を待たせるだけです。serverの422も同じです。
              // network failure等のretry契約は保ちつつ、既知のvalidationはterminalにします。
              if (
                lastError.code === "VALIDATION" ||
                lastError.code === 422
              ) {
                break;
              }

              const isLast = attempt === maxAttempts - 1;
              if (isLast) break;

              let delay: number;
              try {
                delay =
                  typeof opts.retryDelay === "function"
                    ? opts.retryDelay(attempt)
                    : (opts.retryDelay ?? 500);
                if (!Number.isFinite(delay) || delay < 0) {
                  throw new ActionError("retryDelay は 0 以上の有限値にしてください", {
                    displayMessage: "再実行の待ち時間が正しくありません。設定を確認してください。",
                    code: "INVALID_RETRY_DELAY",
                    cause: { delay, attempt },
                  });
                }
              } catch (rawPolicy) {
                // policy callback も利用者が渡す実行境界です。catch の中から
                // reject を逃がすと ActionButton の `void run()` が拾えません。
                lastError = toActionError(rawPolicy);
                break;
              }
              await sleep(delay, controller.signal);
              if (stale()) {
                aborted = true;
                safeSet({ status: "idle" });
                return undefined;
              }
            }
          }
        }
      } finally {
        inFlightRef.current = false;
      }

      if (aborted) return undefined;

      /* --- ここから先は retry しません -------------------------------
         **callback の例外を「action の失敗」と解釈してはいけません。**

         action が成功した時点で、サーバ側の副作用（決済・メール送信・
         登録・削除）はもう起きています。その後 onSuccess がバグで投げたとき、
         それを失敗として retry すると **同じ副作用がもう一度走ります。**
         実測: onSuccess が投げる + retry=3 → action が **4 回** 実行。

         retry が 0 でも、「サーバでは成功しているのに画面はエラー」という
         食い違いが残ります。だから境界を分けます。 */
      if (succeeded) {
        safeSet({ status: "success", data: result, error: undefined });
        // 個別指定が優先。無ければ ActionProvider の既定へ委ねる
        await callSafely(() => {
          if (opts.onSuccess) return opts.onSuccess(result as TOutput, input);
          return dflt.onSuccess?.(result as TOutput);
        }, "onSuccess");

        const after = opts.resetAfter ?? dflt.resetAfter ?? 2000;
        if (after > 0) {
          resetTimerRef.current = setTimeout(() => {
            safeSet({ status: "idle" });
          }, after);
        }
      } else {
        safeSet({ status: "error", error: lastError });
        if (lastError) {
          // 個別に onError を書いていればそちら。書いていなければ
          // ActionProvider の既定（通常は画面隅の通知）へ流す。
          // これで「エラー処理の書き忘れ」が握り潰されなくなります。
          await callSafely(() => {
            if (opts.onError) return opts.onError(lastError as ActionError, input);
            return dflt.onError?.(lastError as ActionError);
          }, "onError");
        }
      }

      await callSafely(() => opts.onSettled?.(), "onSettled");
      return succeeded ? result : undefined;
    },
    [safeSet],
  );

  return {
    ...state,
    isIdle: state.status === "idle",
    isPending: state.status === "pending",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    run,
    abort,
    reset,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
