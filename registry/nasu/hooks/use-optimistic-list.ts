"use client";

import * as React from "react";
import {
  type Action,
  type ActionContext,
  ActionError,
  type AsyncStatus,
  toActionError,
} from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";
import { useResource, type ResourceKey } from "@/hooks/use-resource";

/**
 * useOptimisticList — 楽観更新と、失敗時のロールバック
 * ================================================================
 * 追加・削除・更新を、サーバーの応答を待たずに画面へ反映し、失敗したら戻します。
 *
 * ----------------------------------------------------------------
 * なぜ「配列を控えて戻す」ではいけないのか
 * ----------------------------------------------------------------
 * よくある実装はこうです。
 *
 *   const snapshot = items;
 *   setItems(next);
 *   try { await save(); } catch { setItems(snapshot); }
 *
 * これは操作が 1 つずつ順番に終わる前提です。同時に走ると壊れます。
 *
 *   1. A を追加 → 画面に A が出る（応答待ち）
 *   2. B を削除 → 画面から B が消える（別のリクエスト）
 *   3. 1 が失敗 → snapshot に戻す
 *      → A が消えるのは正しい。**しかし B が復活する。**
 *         snapshot は 2 より前の状態だからです。
 *
 * そこでこのフックは別の構造を取ります。
 *
 *   表示される配列 = 基準の配列 に 保留中の操作を順に適用したもの
 *
 *     base    サーバーから取得した確定状態
 *     pending 保留中の操作のリスト
 *
 *     成功 → その操作を pending から外し、base に反映
 *     失敗 → **その操作だけ** pending から外す（他の操作は残る）
 *
 * これなら何本同時に走っても、失敗した 1 本だけが取り消されます。
 */

type Op<T> =
  | { id: number; kind: "add"; tempKey: React.Key; item: T }
  | { id: number; kind: "remove"; key: React.Key }
  | { id: number; kind: "update"; key: React.Key; patch: Partial<T> };

export interface UseOptimisticListOptions<T> {
  /** 一覧を取得する関数。 */
  load: Action<void, T[]>;
  /** 各項目のキー。**必須です。** これが無いと差分を追跡できません。 */
  getKey: (item: T) => React.Key;
  /** 再取得のきっかけになる値。 */
  deps?: ResourceKey;
  /**
   * 操作が失敗したときに呼ばれます。
   * 既定では `ActionProvider` の通知へ流します。
   * 画面から消えた／復活したことを伝えないと、利用者は保存されたと思い込むためです。
   */
  onError?: (error: ActionError, kind: Op<T>["kind"]) => void;
}

export interface UseOptimisticListResult<T> {
  /** 基準 + 保留中を反映した配列。これを描画してください。 */
  items: T[];
  status: AsyncStatus;
  error: ActionError | undefined;
  isPending: boolean;
  isError: boolean;
  /** その項目が保留中か（薄く表示するなどに使えます）。 */
  pendingOf: (key: React.Key) => Op<T>["kind"] | null;
  /** 保留中の操作が 1 つでもあるか。 */
  hasPending: boolean;

  add: (item: T, save: Action<T, T | void>) => Promise<void>;
  remove: (item: T, save: Action<T, unknown>) => Promise<void>;
  update: (
    item: T,
    patch: Partial<T>,
    save: Action<T, T | void>,
  ) => Promise<void>;

  refetch: () => void;
}

let opCounter = 0;

export function useOptimisticList<T>({
  load,
  getKey,
  deps = [],
  onError,
}: UseOptimisticListOptions<T>): UseOptimisticListResult<T> {
  const resource = useResource<T[]>(deps, load);
  const [base, setBase] = React.useState<T[]>([]);
  const [pending, setPending] = React.useState<Op<T>[]>([]);
  const mountedRef = React.useRef(true);

  const defaults = useActionDefaults();
  const getKeyRef = React.useRef(getKey);
  getKeyRef.current = getKey;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // 取得できたら base だけ差し替える。**pending は残す。**
  // ここで pending を消すと、再取得のたびに進行中の操作が消えます。
  React.useEffect(() => {
    if (resource.isSuccess && resource.data) setBase(resource.data);
  }, [resource.isSuccess, resource.data]);

  /* --- 表示用: base に pending を順に適用する ------------------- */
  const items = React.useMemo(() => {
    let list = base;
    for (const op of pending) {
      if (op.kind === "add") {
        list = [...list, op.item];
      } else if (op.kind === "remove") {
        list = list.filter((x) => getKeyRef.current(x) !== op.key);
      } else {
        list = list.map((x) =>
          getKeyRef.current(x) === op.key ? { ...x, ...op.patch } : x,
        );
      }
    }
    return list;
  }, [base, pending]);

  const dropOp = React.useCallback((id: number) => {
    if (!mountedRef.current) return;
    setPending((p) => p.filter((o) => o.id !== id));
  }, []);

  const report = React.useCallback(
    (error: ActionError, kind: Op<T>["kind"]) => {
      if (onErrorRef.current) onErrorRef.current(error, kind);
      // 行が消えた／復活したことは画面内に出せないので、
      // ここは通知を出すのが正しい場面です（v0.2 の規則に照らして）。
      else defaults.onError?.(error);
    },
    [defaults],
  );

  /* --- 同じキーへの update を直列化する -------------------------
     後から出した更新が先に届くと、古い値で上書きされます。 */
  const chains = React.useRef(new Map<React.Key, Promise<unknown>>());
  const serialize = React.useCallback(
    (key: React.Key, run: () => Promise<void>) => {
      const prev = chains.current.get(key) ?? Promise.resolve();
      const next = prev.then(run, run);
      chains.current.set(key, next);
      void next.finally(() => {
        if (chains.current.get(key) === next) chains.current.delete(key);
      });
      return next;
    },
    [],
  );

  /* --- operation ごとの中断と stale 判定 -----------------------
     AbortSignal は「中断してほしい」という連絡であって、成功を不可能にする
     保証ではありません。transport や server が無視して成功を返すこともあります。

     そのため各 operation に controller と cancelled の記録を持たせます。
     pending add を削除したら両方を更新し、遅れて成功しても base へ commit しません。
     **server で create 済みのデータまで取り消したとは断定しません。** そこは
     domain 側の取消・idempotency の責任で、次の refetch には現れ得ます。 */
  const controllersRef = React.useRef(new Map<number, AbortController>());
  const cancelledRef = React.useRef(new Set<number>());

  React.useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      mountedRef.current = false;
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  const startOp = React.useCallback((id: number): ActionContext => {
    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    return { signal: controller.signal };
  }, []);

  const isStaleOp = React.useCallback(
    (id: number) => !mountedRef.current || cancelledRef.current.has(id),
    [],
  );

  const finishOp = React.useCallback((id: number) => {
    controllersRef.current.delete(id);
    cancelledRef.current.delete(id);
  }, []);

  const cancelOp = React.useCallback(
    (id: number) => {
      cancelledRef.current.add(id);
      controllersRef.current.get(id)?.abort();
      dropOp(id);
    },
    [dropOp],
  );

  /* --- 追加 ------------------------------------------------------ */
  const add = React.useCallback(
    async (item: T, save: Action<T, T | void>) => {
      const id = ++opCounter;
      const tempKey = getKeyRef.current(item);
      setPending((p) => [...p, { id, kind: "add", tempKey, item }]);
      const opCtx = startOp(id);

      try {
        const saved = await save(item, opCtx);
        if (isStaleOp(id)) return;
        // サーバーが本物を返したらそれを、返さなければ楽観的な値をそのまま採用
        setBase((b) => [...b, (saved as T) ?? item]);
        dropOp(id);
      } catch (raw) {
        if (isStaleOp(id)) return;
        dropOp(id); // この操作だけ取り消す。他の保留中はそのまま。
        report(toActionError(raw), "add");
      } finally {
        finishOp(id);
      }
    },
    [dropOp, finishOp, isStaleOp, report, startOp],
  );

  /* --- 削除 ------------------------------------------------------ */
  const remove = React.useCallback(
    async (item: T, save: Action<T, unknown>) => {
      const key = getKeyRef.current(item);

      // 追加がまだ確定していない項目は、サーバーに存在しません。
      // 仮のキーで削除要求を送っても失敗するので、保留中の追加を取り消すだけにします。
      const pendingAdd = pending.find(
        (o) => o.kind === "add" && o.tempKey === key,
      );
      if (pendingAdd) {
        cancelOp(pendingAdd.id);
        return;
      }

      const id = ++opCounter;
      setPending((p) => [...p, { id, kind: "remove", key }]);
      const opCtx = startOp(id);

      try {
        await save(item, opCtx);
        if (isStaleOp(id)) return;
        setBase((b) => b.filter((x) => getKeyRef.current(x) !== key));
        dropOp(id);
      } catch (raw) {
        if (isStaleOp(id)) return;
        dropOp(id);
        report(toActionError(raw), "remove");
      } finally {
        finishOp(id);
      }
    },
    [cancelOp, pending, dropOp, finishOp, isStaleOp, report, startOp],
  );

  /* --- 更新 ------------------------------------------------------ */
  const update = React.useCallback(
    async (item: T, patch: Partial<T>, save: Action<T, T | void>) => {
      const key = getKeyRef.current(item);
      return serialize(key, async () => {
        if (!mountedRef.current) return;
        const id = ++opCounter;
        setPending((p) => [...p, { id, kind: "update", key, patch }]);
        const opCtx = startOp(id);

        try {
          const saved = await save({ ...item, ...patch }, opCtx);
          if (isStaleOp(id)) return;
          setBase((b) =>
            b.map((x) =>
              getKeyRef.current(x) === key
                ? ((saved as T) ?? { ...x, ...patch })
                : x,
            ),
          );
          dropOp(id);
        } catch (raw) {
          if (isStaleOp(id)) return;
          dropOp(id);
          report(toActionError(raw), "update");
        } finally {
          finishOp(id);
        }
      });
    },
    [serialize, dropOp, finishOp, isStaleOp, report, startOp],
  );

  const pendingOf = React.useCallback(
    (key: React.Key) => {
      for (const op of pending) {
        if (op.kind === "add" && op.tempKey === key) return "add";
        if (op.kind !== "add" && op.key === key) return op.kind;
      }
      return null;
    },
    [pending],
  );

  return {
    items,
    status: resource.status,
    error: resource.error,
    isPending: resource.isPending,
    isError: resource.isError,
    pendingOf,
    hasPending: pending.length > 0,
    add,
    remove,
    update,
    refetch: resource.refetch,
  };
}
