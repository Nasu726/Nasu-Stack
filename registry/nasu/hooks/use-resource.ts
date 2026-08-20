"use client";

import * as React from "react";
import {
  callSafely,
  type Action,
  type ActionContext,
  ActionError,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";

/** query key に使える有限・構造的な値。関数や class instance は含みません。 */
export type ResourceKeyValue =
  | string
  | number
  | boolean
  | null
  | readonly ResourceKeyValue[]
  | { readonly [key: string]: ResourceKeyValue };
export type ResourceKey = readonly ResourceKeyValue[];

/**
 * query key を、object の key 順に依存しない型付き文字列へ変えます。
 * unsupported 値を JSON.stringify の暗黙変換で null や空 object にせず、
 * 呼び出した場所で原因が分かる TypeError にします。
 */
export function serializeResourceKey(key: ResourceKey): string {
  if (!Array.isArray(key)) {
    throw new TypeError("useResource の key は配列にしてください");
  }
  return encodeKeyValue(key, "$", new WeakSet<object>());
}

function encodeKeyValue(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null) return "null";
  if (typeof value === "string") return `s:${JSON.stringify(value)}`;
  if (typeof value === "boolean") return value ? "b:1" : "b:0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} は有限の number にしてください`);
    }
    return Object.is(value, -0) ? "n:-0" : `n:${String(value)}`;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError(`${path} に循環参照があります`);
    }
    ancestors.add(value);
    try {
      const encoded: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError(`${path}[${index}] は空欄にせず、値を明示してください`);
        }
        encoded.push(encodeKeyValue(value[index], `${path}[${index}]`, ancestors));
      }
      return `a:[${encoded.join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const proto = Object.getPrototypeOf(object);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(`${path} は plain object にしてください`);
    }
    if (Object.getOwnPropertySymbols(object).length > 0) {
      throw new TypeError(`${path} に symbol key は使えません`);
    }
    if (ancestors.has(object)) {
      throw new TypeError(`${path} に循環参照があります`);
    }
    ancestors.add(object);
    try {
      return `o:{${Object.keys(object)
        .sort()
        .map(
          (name) =>
            `${JSON.stringify(name)}:${encodeKeyValue(
              object[name],
              `${path}.${name}`,
              ancestors,
            )}`,
        )
        .join(",")}}`;
    } finally {
      ancestors.delete(object);
    }
  }

  throw new TypeError(
    `${path} に ${typeof value} は使えません。JSON 互換の有限値にしてください`,
  );
}

export interface UseResourceOptions<TOutput> {
  /** false の間は取得しません（依存データ待ちなど）。既定 true。 */
  enabled?: boolean;
  /** 取得前に表示しておく値。 */
  placeholder?: TOutput;
  /** 失敗時の自動リトライ回数。既定 1。 */
  retry?: number;
  onSuccess?: (data: TOutput) => void | Promise<void>;
  onError?: (error: ActionError) => void | Promise<void>;
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
 * @param key query key。有限の JSON 互換値を構造比較し、同じ構造なら参照や
 * object の key 順が違っても再取得しません。
 */
export function useResource<TOutput>(
  key: ResourceKey,
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

  const serializedKey = serializeResourceKey(key);

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
      let succeeded = false;
      let result: TOutput | undefined;

      /* retry の境界は **loader だけ** です。
         callback をここに入れると、onSuccess が投げたときに
         「取得に失敗した」と解釈して読み直します。取得は GET なので
         useAction ほどの実害はありませんが、契約として不自然です
         （同じ方針を useAction と揃えます。理由はあちらのコメント）。 */
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const ctx: ActionContext = { signal: controller.signal };
          const data = await loaderRef.current(undefined as void, ctx);
          if (cancelled || controller.signal.aborted) return;
          succeeded = true;
          result = data;
          break;
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

      if (succeeded) {
        setState({ status: "success", data: result, error: undefined });
        await callSafely(
          () => optionsRef.current.onSuccess?.(result as TOutput),
          "onSuccess",
        );
        return;
      }

      setState((s) => ({ ...s, status: "error", error: lastError }));
      if (lastError) {
        // AsyncBoundary が画面内にエラーと再試行を出すので、
        // 取得失敗は既定では通知を出しません（二重表示を避けるため）。
        await callSafely(
          () => optionsRef.current.onError?.(lastError as ActionError),
          "onError",
        );
      }
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
