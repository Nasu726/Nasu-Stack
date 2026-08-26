"use client";

import * as React from "react";
import {
  ActionError,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";
import type { CursorLoader, CursorPage } from "@/lib/cursor";
import {
  serializeResourceKey,
  type ResourceKey,
  type ResourceKeyValue,
} from "@/hooks/use-resource";

/** nullは末尾の印として使うため、cursorそのものには使いません。 */
export type CursorValue = Exclude<ResourceKeyValue, null>;

interface FailedPage<TCursor> {
  cursor: TCursor | undefined;
  reset: boolean;
}

interface CursorListState<TItem, TCursor> {
  key: string;
  status: AsyncStatus;
  items: TItem[];
  nextCursor: TCursor | undefined;
  error: ActionError | undefined;
  failed: FailedPage<TCursor> | undefined;
  pendingKind: "initial" | "more" | undefined;
}

export interface UseCursorListResult<TItem, TCursor> {
  status: AsyncStatus;
  items: TItem[];
  nextCursor: TCursor | undefined;
  error: ActionError | undefined;
  isInitialPending: boolean;
  isInitialError: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  isEmpty: boolean;
  hasMore: boolean;
  isEnd: boolean;
  /** 次pageを1回だけ取得します。進行中または末尾ならfalseです。 */
  loadMore: () => Promise<boolean>;
  /** 失敗したcursorだけを再試行します。失敗中でなければfalseです。 */
  retry: () => Promise<boolean>;
  /** itemを捨て、最初のpageから読み直します。 */
  reload: () => Promise<boolean>;
}

/**
 * cursor paginationのclient側queueです。
 *
 * - 最初のpageを自動取得する
 * - loadMoreの同期的な連打を1 requestへまとめる
 * - deps変更 / unmountで進行中requestをabortし、古い結果を捨てる
 * - 失敗したpageだけをretryする
 * - 既出cursorへ戻るloopをfail closedにする
 *
 * itemの重複、並び順、cursorの発行、認可はserver / applicationの責任です。
 */
export function useCursorList<
  TItem,
  TCursor extends CursorValue = string,
>(
  loader: CursorLoader<TItem, TCursor>,
  deps: ResourceKey = [],
): UseCursorListResult<TItem, TCursor> {
  const serializedKey = serializeResourceKey(deps);
  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = React.useState<CursorListState<TItem, TCursor>>(
    () => initialState(serializedKey),
  );
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // render時点で更新します。effect前の短い間にloadMoreされても、古いkeyを使いません。
  const desiredKeyRef = React.useRef(serializedKey);
  desiredKeyRef.current = serializedKey;

  const controllerRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const pendingRef = React.useRef(false);
  const requestedCursorsRef = React.useRef(new Set<string>());

  const runPage = React.useCallback(
    async (
      cursor: TCursor | undefined,
      reset: boolean,
      key: string,
    ): Promise<boolean> => {
      if (pendingRef.current || desiredKeyRef.current !== key) return false;
      pendingRef.current = true;

      const generation = ++generationRef.current;
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;
      if (reset) requestedCursorsRef.current.clear();

      setState((previous) => ({
        key,
        status: "pending",
        items: reset ? [] : previous.key === key ? previous.items : [],
        nextCursor:
          reset || previous.key !== key ? undefined : previous.nextCursor,
        error: undefined,
        failed: undefined,
        pendingKind: reset ? "initial" : "more",
      }));

      try {
        const raw = await loaderRef.current(cursor, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          generationRef.current !== generation ||
          desiredKeyRef.current !== key
        ) {
          return false;
        }

        const page = normalizeCursorPage<TItem, TCursor>(raw);
        const requested = cursorSignature(cursor);
        requestedCursorsRef.current.add(requested);

        const nextCursor = page.nextCursor ?? undefined;
        if (nextCursor !== undefined) {
          const next = cursorSignature(nextCursor);
          if (requestedCursorsRef.current.has(next)) {
            throw new ActionError("cursor pagination returned a cursor loop", {
              code: "CURSOR_LOOP",
              displayMessage:
                "The server returned a cursor that has already been loaded.",
            });
          }
        }

        setState((previous) => ({
          key,
          status: "success",
          items: [
            ...(reset || previous.key !== key ? [] : previous.items),
            ...page.items,
          ],
          nextCursor,
          error: undefined,
          failed: undefined,
          pendingKind: undefined,
        }));
        return true;
      } catch (raw) {
        if (
          controller.signal.aborted ||
          generationRef.current !== generation ||
          desiredKeyRef.current !== key
        ) {
          return false;
        }
        const error = toActionError(raw);
        setState((previous) => ({
          key,
          status: "error",
          items: reset || previous.key !== key ? [] : previous.items,
          nextCursor:
            reset || previous.key !== key ? undefined : previous.nextCursor,
          error,
          failed: { cursor, reset },
          pendingKind: undefined,
        }));
        return false;
      } finally {
        if (generationRef.current === generation) {
          pendingRef.current = false;
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    // 前のkeyのloaderがAbortSignalを無視してもgenerationで結果を捨てます。
    generationRef.current += 1;
    controllerRef.current?.abort();
    pendingRef.current = false;
    requestedCursorsRef.current.clear();
    void runPage(undefined, true, serializedKey);

    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
      pendingRef.current = false;
    };
  }, [runPage, serializedKey]);

  const loadMore = React.useCallback((): Promise<boolean> => {
    const current = stateRef.current;
    const key = desiredKeyRef.current;
    if (
      current.key !== key ||
      current.status !== "success" ||
      current.nextCursor === undefined
    ) {
      return Promise.resolve(false);
    }
    return runPage(current.nextCursor, false, key);
  }, [runPage]);

  const retry = React.useCallback((): Promise<boolean> => {
    const current = stateRef.current;
    const key = desiredKeyRef.current;
    if (current.key !== key || current.status !== "error" || !current.failed) {
      return Promise.resolve(false);
    }
    return runPage(current.failed.cursor, current.failed.reset, key);
  }, [runPage]);

  const reload = React.useCallback((): Promise<boolean> => {
    return runPage(undefined, true, desiredKeyRef.current);
  }, [runPage]);

  // depsがrenderで変わってからeffectが走るまで、前のitemを1 frameも返しません。
  const visible =
    state.key === serializedKey ? state : initialState<TItem, TCursor>(serializedKey);
  const hasMore = visible.nextCursor !== undefined;

  return {
    status: visible.status,
    items: visible.items,
    nextCursor: visible.nextCursor,
    error: visible.error,
    isInitialPending:
      visible.status === "pending" && visible.pendingKind === "initial",
    isInitialError:
      visible.status === "error" && visible.failed?.reset === true,
    isLoadingMore:
      visible.status === "pending" && visible.pendingKind === "more",
    isError: visible.status === "error",
    isEmpty:
      visible.status === "success" &&
      visible.items.length === 0 &&
      !hasMore,
    hasMore,
    isEnd:
      visible.status === "success" &&
      visible.items.length > 0 &&
      !hasMore,
    loadMore,
    retry,
    reload,
  };
}

function initialState<TItem, TCursor>(
  key: string,
): CursorListState<TItem, TCursor> {
  return {
    key,
    status: "pending",
    items: [],
    nextCursor: undefined,
    error: undefined,
    failed: undefined,
    pendingKind: "initial",
  };
}

function cursorSignature<TCursor extends CursorValue>(
  cursor: TCursor | undefined,
): string {
  return cursor === undefined
    ? "initial"
    : serializeResourceKey(["cursor", cursor]);
}

function normalizeCursorPage<TItem, TCursor extends CursorValue>(
  value: CursorPage<TItem, TCursor>,
): CursorPage<TItem, TCursor> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidPage("cursor page must be an object", value);
  }
  if (!Array.isArray(value.items)) {
    throw invalidPage("cursor page items must be an array", value);
  }
  if (value.nextCursor !== undefined && value.nextCursor !== null) {
    try {
      cursorSignature(value.nextCursor);
    } catch (cause) {
      throw invalidPage("nextCursor must be a finite structural value", cause);
    }
  }
  return value;
}

function invalidPage(message: string, cause: unknown): ActionError {
  return new ActionError(message, {
    code: "INVALID_CURSOR_PAGE",
    displayMessage: "The server returned an invalid cursor page.",
    cause,
  });
}
