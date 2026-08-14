"use client";

import * as React from "react";
import {
  type Action,
  type ActionContext,
  ActionError,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";

export interface UseResourceOptions<TOutput> {
  /** false の間は取得しません（依存データ待ちなど）。既定 true。 */
  enabled?: boolean;
  /** 取得前に表示しておく値。 */
  placeholder?: TOutput;
  /** 失敗時の自動リトライ回数。既定 1。 */
  retry?: number;
  onSuccess?: (data: TOutput) => void;
  onError?: (error: ActionError) => void;
}

export interface UseResourceResult<TOutput> {
  status: AsyncStatus;
  data: TOutput | undefined;
  error: ActionError | undefined;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** 再取得します。 */
  refetch: () => void;
}

/**
 * 「読み取り」側の統一フック。useAction が書き込み用なのに対し、
 * これはマウント時／依存変更時に自動で走ります。
 *
 * ```tsx
 * const users = useResource(["users", page], (_, ctx) =>
 *   jsonRequest<User[]>(`/api/users?page=${page}`, { ctx }));
 * ```
 *
 * @param key 依存キー。この配列が変わると再取得します（useEffect の依存と同じ役割）。
 */
export function useResource<TOutput>(
  key: readonly unknown[],
  loader: Action<void, TOutput>,
  options: UseResourceOptions<TOutput> = {},
): UseResourceResult<TOutput> {
  const { enabled = true, placeholder, retry = 1 } = options;

  const [state, setState] = React.useState<{
    status: AsyncStatus;
    data: TOutput | undefined;
    error: ActionError | undefined;
  }>({
    status: enabled ? "pending" : "idle",
    data: placeholder,
    error: undefined,
  });

  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const [nonce, setNonce] = React.useState(0);
  const refetch = React.useCallback(() => setNonce((n) => n + 1), []);

  const serializedKey = JSON.stringify(key);

  React.useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, status: "idle" }));
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const maxAttempts = (optionsRef.current.retry ?? retry) + 1;

    (async () => {
      setState((s) => ({ ...s, status: "pending", error: undefined }));

      let lastError: ActionError | undefined;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const ctx: ActionContext = { signal: controller.signal };
          const data = await loaderRef.current(undefined as void, ctx);
          if (cancelled || controller.signal.aborted) return;
          setState({ status: "success", data, error: undefined });
          optionsRef.current.onSuccess?.(data);
          return;
        } catch (raw) {
          if (cancelled || controller.signal.aborted) return;
          lastError = toActionError(raw);
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            if (cancelled || controller.signal.aborted) return;
          }
        }
      }

      if (cancelled) return;
      setState((s) => ({ ...s, status: "error", error: lastError }));
      if (lastError) optionsRef.current.onError?.(lastError);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedKey, enabled, nonce]);

  return {
    ...state,
    isIdle: state.status === "idle",
    isPending: state.status === "pending",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    refetch,
  };
}
