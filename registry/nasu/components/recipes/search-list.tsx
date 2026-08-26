"use client";

import * as React from "react";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { useResource } from "@/hooks/use-resource";
import type { Action } from "@/lib/action";
import { cn, inputClass } from "@/lib/utils";

export interface SearchListItem {
  id: React.Key;
  href: string;
  title: string;
  description?: string;
}

export interface SearchListMessages {
  label: React.ReactNode;
  placeholder: string;
  belowMinimum: (minimum: number) => React.ReactNode;
  searching: React.ReactNode;
  empty: React.ReactNode;
  retry: React.ReactNode;
  resultCount: (count: number) => React.ReactNode;
}

export interface SearchListRecipeProps {
  /** 検索語を受け取り、リンクとして表示できる結果を返します。 */
  search: Action<string, SearchListItem[]>;
  /** 入力が止まってから検索するまでの時間。既定 300ms。 */
  debounceMs?: number;
  /** 検索を始める最小文字数。既定 2。 */
  minQueryLength?: number;
  /** 取得失敗時の自動再試行回数。既定 0。 */
  retry?: number;
  initialQuery?: string;
  messages?: Partial<SearchListMessages>;
  className?: string;
  inputClassName?: string;
}

const DEFAULT_MESSAGES: SearchListMessages = {
  label: "Search",
  placeholder: "Search…",
  belowMinimum: (minimum) =>
    `Enter at least ${minimum} characters to search.`,
  searching: "Searching…",
  empty: "No results found.",
  retry: "Try again",
  resultCount: (count) => `${count} result${count === 1 ? "" : "s"}`,
};

/**
 * 検索欄と結果一覧の、失敗しやすい配線をまとめた copy-owned recipe です。
 *
 * - 高速入力を debounce する
 * - 新しい検索語の待機中に、古い結果を新しい結果として見せない
 * - 前の request を AbortSignal で中断する
 * - 読込中 / 失敗 / 空 / 成功を必ず表示する
 * - 結果を最初から本物の link にする
 *
 * 検索の意味、権限、rate limit、順位付け、結果 URL は app / server 側の責任です。
 */
export function SearchListRecipe({
  search,
  debounceMs = 300,
  minQueryLength = 2,
  retry = 0,
  initialQuery = "",
  messages,
  className,
  inputClassName,
}: SearchListRecipeProps) {
  assertNonNegativeFinite("debounceMs", debounceMs);
  assertNonNegativeInteger("retry", retry);
  if (!Number.isInteger(minQueryLength) || minQueryLength < 1) {
    throw new RangeError("minQueryLength は 1 以上の整数にしてください");
  }

  const copy = { ...DEFAULT_MESSAGES, ...messages };
  const [query, setQuery] = React.useState(initialQuery);
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, debounceMs);
  const baseId = React.useId();
  const inputId = baseId + "-input";
  const statusId = baseId + "-status";
  const resultsId = baseId + "-results";
  const belowMinimum = normalizedQuery.length < minQueryLength;
  const waitingForDebounce =
    !belowMinimum && normalizedQuery !== debouncedQuery;

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor={inputId}>
          {copy.label}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          placeholder={copy.placeholder}
          aria-describedby={
            belowMinimum || waitingForDebounce ? statusId : undefined
          }
          aria-controls={resultsId}
          onChange={(event) => setQuery(event.currentTarget.value)}
          className={inputClass({ className: inputClassName })}
        />
      </div>

      <div>
        {belowMinimum ? (
          <SearchStatus id={statusId}>
            {copy.belowMinimum(minQueryLength)}
          </SearchStatus>
        ) : waitingForDebounce ? (
          <SearchStatus id={statusId} busy>
            {copy.searching}
          </SearchStatus>
        ) : (
          <SearchResults
            id={resultsId}
            statusId={statusId}
            query={debouncedQuery}
            search={search}
            retry={retry}
            messages={copy}
          />
        )}
      </div>
    </section>
  );
}

function SearchResults({
  id,
  statusId,
  query,
  search,
  retry,
  messages,
}: {
  id: string;
  statusId: string;
  query: string;
  search: Action<string, SearchListItem[]>;
  retry: number;
  messages: SearchListMessages;
}) {
  const resource = useResource<SearchListItem[]>(
    ["search-list", query],
    (_, context) => search(query, context),
    { retry },
  );

  return (
    <div id={id} aria-busy={resource.isPending || undefined}>
      <AsyncBoundary
        state={resource}
        onRetry={resource.refetch}
        retryLabel={messages.retry}
        loading={
          <SearchStatus id={statusId} busy>
            {messages.searching}
          </SearchStatus>
        }
        empty={<SearchStatus id={statusId}>{messages.empty}</SearchStatus>}
      >
        {(items) => (
          <div className="flex min-w-0 flex-col gap-2">
            <p
              id={statusId}
              className="text-xs text-muted-fg"
              aria-live="polite"
              aria-atomic="true"
            >
              {messages.resultCount(items.length)}
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {items.map((item) => (
                <li key={item.id} className="min-w-0">
                  <a
                    href={item.href}
                    className={cn(
                      "block min-h-11 min-w-0 px-4 py-3 text-card-fg",
                      "hover:bg-muted focus-visible:bg-muted",
                    )}
                  >
                    <span className="block break-words text-sm font-medium">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="mt-1 block break-words text-sm text-muted-fg">
                        {item.description}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

function SearchStatus({
  id,
  busy = false,
  children,
}: {
  id: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      id={id}
      className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-fg"
      aria-busy={busy || undefined}
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </p>
  );
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (delay === 0) {
      setDebounced(value);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return delay === 0 ? value : debounced;
}

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} は 0 以上の有限値にしてください`);
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} は 0 以上の整数にしてください`);
  }
}
