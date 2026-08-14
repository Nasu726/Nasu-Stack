"use client";

import * as React from "react";
import {
  type Action,
  type ActionContext,
  ActionError,
  type AsyncState,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";

export interface UseActionOptions<TInput, TOutput> {
  /** 成功時に呼ばれます。 */
  onSuccess?: (data: TOutput, input: TInput) => void;
  /** 失敗時に呼ばれます。ここを未指定にすると ActionProvider の既定処理が走ります。 */
  onError?: (error: ActionError, input: TInput) => void;
  /** 成否によらず最後に呼ばれます。 */
  onSettled?: () => void;
  /** 成功状態を何 ms 後に idle へ戻すか。0 で戻しません。既定 2000。 */
  resetAfter?: number;
  /** 失敗時に自動リトライする回数。既定 0。 */
  retry?: number;
  /** リトライ間隔 (ms)。関数を渡すと指数バックオフなども書けます。既定 500ms。 */
  retryDelay?: number | ((attempt: number) => number);
  /** 実行前の確認。false を返すと実行しません。 */
  guard?: (input: TInput) => boolean | Promise<boolean>;
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
  const mountedRef = React.useRef(true);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
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
    inFlightRef.current = false;
    safeSet({ status: "idle" });
  }, [safeSet]);

  const run = React.useCallback(
    async (input: TInput): Promise<TOutput | undefined> => {
      // --- 二重送信の防止（初心者が最も踏むバグ） ---
      if (inFlightRef.current) return undefined;

      const opts = optionsRef.current;
      const dflt = defaultsRef.current;

      if (opts.guard) {
        const ok = await opts.guard(input);
        if (!ok) return undefined;
      }

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightRef.current = true;

      const maxAttempts = (opts.retry ?? dflt.retry ?? 0) + 1;
      let lastError: ActionError | undefined;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        safeSet({ status: "pending", error: undefined, attempt });

        try {
          const ctx: ActionContext = { signal: controller.signal };
          const data = await actionRef.current(input, ctx);

          if (controller.signal.aborted) {
            inFlightRef.current = false;
            return undefined;
          }

          inFlightRef.current = false;
          safeSet({ status: "success", data, error: undefined });
          // 個別指定が優先。無ければ ActionProvider の既定へ委ねる
          if (opts.onSuccess) opts.onSuccess(data, input);
          else dflt.onSuccess?.(data);
          opts.onSettled?.();

          const after = opts.resetAfter ?? dflt.resetAfter ?? 2000;
          if (after > 0) {
            resetTimerRef.current = setTimeout(() => {
              safeSet({ status: "idle" });
            }, after);
          }
          return data;
        } catch (raw) {
          if (controller.signal.aborted) {
            inFlightRef.current = false;
            safeSet({ status: "idle" });
            return undefined;
          }

          lastError = toActionError(raw);

          const isLast = attempt === maxAttempts - 1;
          if (!isLast) {
            const delay =
              typeof opts.retryDelay === "function"
                ? opts.retryDelay(attempt)
                : (opts.retryDelay ?? 500);
            await sleep(delay, controller.signal);
            if (controller.signal.aborted) {
              inFlightRef.current = false;
              safeSet({ status: "idle" });
              return undefined;
            }
            continue;
          }
        }
      }

      inFlightRef.current = false;
      safeSet({ status: "error", error: lastError });
      if (lastError) {
        // 個別に onError を書いていればそちら。書いていなければ
        // ActionProvider の既定（通常は画面隅の通知）へ流す。
        // これで「エラー処理の書き忘れ」が握り潰されなくなります。
        if (opts.onError) opts.onError(lastError, input);
        else dflt.onError?.(lastError);
      }
      opts.onSettled?.();
      return undefined;
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
