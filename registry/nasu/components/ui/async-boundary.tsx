"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ActionError, AsyncStatus } from "@/lib/action";
import { Button } from "@/components/ui/action-button";
import { AlertIcon } from "@/components/ui/spinner";

export interface AsyncBoundaryProps<T> {
  /** useResource / useAction の戻り値をそのまま渡せます。 */
  state: {
    status: AsyncStatus;
    data: T | undefined;
    error: ActionError | undefined;
  };
  /** 成功時の描画。data は undefined ではないことが保証されます。 */
  children: (data: T) => React.ReactNode;
  /** 読込中の表示。省略時はスケルトン。 */
  loading?: React.ReactNode;
  /** 空データ判定。既定は配列の length === 0。 */
  isEmpty?: (data: T) => boolean;
  /** 空のときの表示。 */
  empty?: React.ReactNode;
  /** 再試行ボタンの動作。渡すとエラー画面に「再試行」が出ます。 */
  onRetry?: () => void;
  className?: string;
  /** スケルトンの行数。既定 3。 */
  skeletonRows?: number;
}

/**
 * 「読込中 / エラー / 空 / データあり」の 4 分岐を 1 箇所に閉じ込めます。
 *
 * これがないと利用者は毎回こう書くことになります:
 *   if (loading) return <Spinner/>
 *   if (error) return <p>{error.message}</p>
 *   if (!data.length) return <p>データがありません</p>
 *   return <List .../>
 *
 * その 4 行を書かせないのがこのコンポーネントの目的です。
 */
export function AsyncBoundary<T>({
  state,
  children,
  loading,
  isEmpty,
  empty,
  onRetry,
  className,
  skeletonRows = 3,
}: AsyncBoundaryProps<T>) {
  if (state.status === "pending" || state.status === "idle") {
    return (
      <div className={className}>
        {loading ?? <Skeleton rows={skeletonRows} />}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-start gap-3 rounded-lg border border-danger/30",
          "bg-danger/5 p-4",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-danger">
          <AlertIcon />
          <p className="text-sm font-medium">
            {state.error?.displayMessage ?? "読み込みに失敗しました"}
          </p>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            再試行
          </Button>
        )}
      </div>
    );
  }

  const data = state.data as T;
  const emptyCheck =
    isEmpty ?? ((d: T) => Array.isArray(d) && d.length === 0);

  if (data === undefined || emptyCheck(data)) {
    return (
      <div className={className}>
        {empty ?? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-fg">
            まだデータがありません
          </p>
        )}
      </div>
    );
  }

  return <div className={className}>{children(data)}</div>;
}

/** 読み込み中のプレースホルダ。レイアウトのガタつきを防ぎます。 */
export function Skeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-sm bg-muted"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
