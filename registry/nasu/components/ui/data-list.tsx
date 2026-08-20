"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ActionSpec, resolveAction } from "@/lib/action";
import { useResource, type ResourceKey } from "@/hooks/use-resource";
import { AsyncBoundary } from "@/components/ui/async-boundary";

/** 関数を使わずに 1 行の見た目を決めるための列定義（Astro island 用）。 */
export interface ListColumn {
  /** 表示するプロパティ名。 */
  key: string;
  /** 主役の列（左に大きく出る）。省略時は最初の列が主役。 */
  primary?: boolean;
  /** 右側にバッジとして出す。 */
  badge?: boolean;
}

export interface DataListProps<T> {
  /**
   * データを取ってくる関数、または `{ url, method: "GET" }` の宣言。
   * 関数を渡した場合、ctx.signal を fetch に渡せば画面遷移時に自動で中断されます。
   */
  loader: ActionSpec<void, T[]>;
  /** 再取得のきっかけになる値。ページ番号や検索語を入れます。 */
  deps?: ResourceKey;
  /**
   * 1 件分の描画。React から使うときはこちら。
   * 省略した場合は columns（または全プロパティ）から自動生成します。
   */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** renderItem を使わない場合の列定義。.astro から使うときはこちら。 */
  columns?: ListColumn[];
  /** key の取り出し。省略時は item.id → index の順で解決します。 */
  getKey?: (item: T, index: number) => React.Key;
  title?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  listClassName?: string;
}

/**
 * 「取得して、並べて、失敗したら再試行できる」までを 1 個で済ませるリスト。
 *
 * React から:
 * ```tsx
 * <DataList
 *   loader={(_, ctx) => jsonRequest<Task[]>("/api/tasks", { ctx })}
 *   renderItem={(t) => <span>{t.title}</span>}
 * />
 * ```
 *
 * .astro から（関数を一切使わない）:
 * ```astro
 * <DataList client:load
 *   loader={{ url: "/api/tasks", method: "GET" }}
 *   columns={[{ key: "title", primary: true }, { key: "owner", badge: true }]} />
 * ```
 */
export function DataList<T>({
  loader,
  deps = [],
  renderItem,
  columns,
  getKey,
  title,
  empty,
  className,
  listClassName,
}: DataListProps<T>) {
  const resolved = React.useMemo(
    () => resolveAction<void, T[]>(loader),
    // 宣言オブジェクトは毎回新しい参照になるので内容で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof loader === "function" ? loader : JSON.stringify(loader)],
  );
  const resource = useResource<T[]>(deps, resolved);

  const render =
    renderItem ?? ((item: T) => <AutoRow item={item} columns={columns} />);

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          {resource.isSuccess && (
            <span className="text-xs text-muted-fg">
              {resource.data?.length ?? 0} 件
            </span>
          )}
        </div>
      )}

      <AsyncBoundary
        state={resource}
        onRetry={resource.refetch}
        empty={empty}
        skeletonRows={4}
      >
        {(items) => (
          <ul
            className={cn(
              "divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
              listClassName,
            )}
          >
            {items.map((item, i) => (
              <li
                key={resolveKey(item, i, getKey)}
                className="px-4 py-3 text-sm text-card-fg"
              >
                {render(item, i)}
              </li>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </section>
  );
}

function resolveKey<T>(
  item: T,
  index: number,
  getKey?: (item: T, index: number) => React.Key,
): React.Key {
  if (getKey) return getKey(item, index);
  if (item && typeof item === "object") {
    const id = (item as Record<string, unknown>).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return index;
}

/** columns から 1 行を組み立てます。columns 未指定なら全プロパティを出します。 */
function AutoRow<T>({
  item,
  columns,
}: {
  item: T;
  columns?: ListColumn[];
}) {
  const obj = (item ?? {}) as Record<string, unknown>;
  const cols: ListColumn[] =
    columns ??
    Object.keys(obj)
      .filter((k) => k !== "id")
      .map((k, i) => ({ key: k, primary: i === 0, badge: i > 0 }));

  const primary = cols.find((c) => c.primary) ?? cols[0];
  const badges = cols.filter((c) => c !== primary);

  return (
    <div className="flex items-center justify-between gap-3">
      <span>{primary ? String(obj[primary.key] ?? "") : ""}</span>
      {badges.length > 0 && (
        <span className="flex shrink-0 gap-1.5">
          {badges.map((c) => (
            <span
              key={c.key}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg"
            >
              {String(obj[c.key] ?? "")}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
