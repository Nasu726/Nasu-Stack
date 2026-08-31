"use client";

import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { Skeleton } from "@/components/ui/async-boundary";
import { AlertIcon, Spinner } from "@/components/ui/spinner";
import {
  useCursorList,
  type CursorValue,
} from "@/hooks/use-cursor-list";
import type { ResourceKey } from "@/hooks/use-resource";
import type { CursorLoader } from "@/lib/cursor";
import type { ActionError } from "@/lib/action";
import { cn } from "@/lib/utils";

export interface LoadMoreListLabels {
  loading: React.ReactNode;
  loadMore: React.ReactNode;
  loadingMore: React.ReactNode;
  retry: React.ReactNode;
  empty: React.ReactNode;
  end: React.ReactNode;
  itemCount: (count: number) => React.ReactNode;
  error: (error: ActionError) => React.ReactNode;
}

export interface LoadMoreListProps<
  TItem,
  TCursor extends CursorValue = string,
> {
  loader: CursorLoader<TItem, TCursor>;
  /** filterや検索語。構造が変わるとitemを捨て、最初のpageから取得します。 */
  deps?: ResourceKey;
  renderItem: (item: TItem, index: number) => React.ReactNode;
  getKey: (item: TItem, index: number) => React.Key;
  title?: React.ReactNode;
  labels?: Partial<LoadMoreListLabels>;
  className?: string;
  listClassName?: string;
}

const DEFAULT_LABELS: LoadMoreListLabels = {
  loading: "Loading…",
  loadMore: "Load more",
  loadingMore: "Loading more…",
  retry: "Try again",
  empty: "No items yet.",
  end: "You've reached the end.",
  itemCount: (count) => `${count} item${count === 1 ? "" : "s"}`,
  error: (error) => error.displayMessage,
};

/**
 * 自動無限scrollにせず、利用者が明示的に次pageを読むlistです。
 * stateだけ必要なら同梱のuseCursorListへ1段降りられます。
 */
export function LoadMoreList<
  TItem,
  TCursor extends CursorValue = string,
>({
  loader,
  deps = [],
  renderItem,
  getKey,
  title,
  labels,
  className,
  listClassName,
}: LoadMoreListProps<TItem, TCursor>) {
  const copy: LoadMoreListLabels = { ...DEFAULT_LABELS, ...labels };
  const cursor = useCursorList(loader, deps);
  const loadButtonRef = React.useRef<HTMLButtonElement>(null);
  const retryButtonRef = React.useRef<HTMLButtonElement>(null);
  const endRef = React.useRef<HTMLParagraphElement>(null);
  const restoreFocusRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!restoreFocusRef.current || cursor.status === "pending") return;
    if (cursor.status === "error") retryButtonRef.current?.focus();
    else if (cursor.hasMore) loadButtonRef.current?.focus();
    else endRef.current?.focus();
    restoreFocusRef.current = false;
  }, [cursor.hasMore, cursor.status]);

  const loadMore = () => {
    restoreFocusRef.current =
      document.activeElement === loadButtonRef.current;
    void cursor.loadMore();
  };
  const retry = () => {
    restoreFocusRef.current =
      document.activeElement === retryButtonRef.current;
    void cursor.retry();
  };

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      {(title || cursor.items.length > 0) && (
        <div className="flex min-w-0 items-center justify-between gap-3">
          {title && <h3 className="min-w-0 text-sm font-semibold">{title}</h3>}
          {cursor.items.length > 0 && (
            <p
              className="ms-auto shrink-0 text-xs text-muted-fg"
              aria-live="polite"
              aria-atomic="true"
            >
              {copy.itemCount(cursor.items.length)}
            </p>
          )}
        </div>
      )}

      {cursor.isInitialPending ? (
        <div role="status">
          <span className="sr-only">{copy.loading}</span>
          <Skeleton rows={3} />
        </div>
      ) : cursor.isInitialError ? (
        <ErrorState
          message={cursor.error ? copy.error(cursor.error) : undefined}
          retryLabel={copy.retry}
          onRetry={retry}
          retryRef={retryButtonRef}
        />
      ) : cursor.isEmpty ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-fg">
          {copy.empty}
        </p>
      ) : (
        <>
          {cursor.items.length > 0 ? (
            <ul
              className={cn(
                "min-w-0 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
                listClassName,
              )}
            >
              {cursor.items.map((item, index) => (
                <li key={getKey(item, index)} className="min-w-0 px-4 py-3">
                  {renderItem(item, index)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-fg">
              {copy.empty}
            </p>
          )}

          {cursor.isError ? (
            <ErrorState
              message={cursor.error ? copy.error(cursor.error) : undefined}
              retryLabel={copy.retry}
              onRetry={retry}
              retryRef={retryButtonRef}
            />
          ) : cursor.isLoadingMore ? (
            <Button
              ref={loadButtonRef}
              variant="outline"
              disabled
              aria-busy="true"
              className="self-start"
            >
              <Spinner />
              {copy.loadingMore}
            </Button>
          ) : cursor.hasMore ? (
            <Button
              ref={loadButtonRef}
              variant="outline"
              onClick={loadMore}
              className="self-start"
            >
              {copy.loadMore}
            </Button>
          ) : (
            <p
              ref={endRef}
              tabIndex={-1}
              role="status"
              className="text-sm text-muted-fg outline-none"
            >
              {copy.end}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ErrorState({
  message,
  retryLabel,
  onRetry,
  retryRef,
}: {
  message: React.ReactNode;
  retryLabel: React.ReactNode;
  onRetry: () => void;
  retryRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4"
    >
      <div className="flex min-w-0 items-center gap-2 text-danger">
        <AlertIcon className="shrink-0" />
        <p className="min-w-0 break-words text-sm font-medium">
          {message ?? "Loading failed."}
        </p>
      </div>
      <Button ref={retryRef} size="sm" variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
