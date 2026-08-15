"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ActionSpec, resolveAction } from "@/lib/action";
import { useResource } from "@/hooks/use-resource";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Scrollable } from "@/components/ui/scrollable";
import { Box, Inline, Spread, Stack } from "@/components/ui/layout";
import { Button } from "@/components/ui/action-button";

/**
 * DataTable — 並べ替え・ページング・狭い画面での作り替え
 * ================================================================
 * 320px で 8 列の表は、横スクロールできても実用に耐えません。
 * なので**タブレット幅未満では 1 行 = 1 カード**に組み替えます（既定）。
 *
 * そのため列定義の `label` は必須です。カードでは列名が唯一の手がかりになります。
 *
 * ```tsx
 * // 手元の配列。並べ替えもページングもメモリ上で行う
 * <DataTable rows={tasks} columns={columns} />
 *
 * // サーバー側で並べ替え・ページング
 * <DataTable loader={(q, ctx) => jsonRequest(`/api/tasks?page=${q.page}`, { ctx })}
 *            columns={columns} />
 * ```
 */

export interface TableColumn<T> {
  /** 値の取り出しキー。`get` を渡すならただの識別子で構いません。 */
  key: string;
  /** 列名。**カード表示ではこれが唯一の手がかりになるので必須です。** */
  label: string;
  /** 値の取り出し方。省略時は `row[key]`。 */
  get?: (row: T) => React.ReactNode;
  /** 並べ替えの対象にするか。 */
  sortable?: boolean;
  /** 右寄せ（数値など）。 */
  align?: "start" | "end";
  /** 狭い画面のカードで省くか（重要度の低い列）。 */
  hideOnCard?: boolean;
}

export interface TableQuery {
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
}

export interface TablePage<T> {
  rows: T[];
  total: number;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  /** 手元の配列。渡すと並べ替え・ページングをメモリ上で行います。 */
  rows?: T[];
  /** サーバー側で処理する場合。`{ rows, total }` を返してください。 */
  loader?: ActionSpec<TableQuery, TablePage<T>>;
  getKey?: (row: T, index: number) => React.Key;
  /** 1 ページの件数。既定 10。0 でページングなし。 */
  pageSize?: number;
  /** 狭い画面での振る舞い。既定 cards。 */
  mobile?: "cards" | "scroll";
  /** 行をクリックしたとき。 */
  onRowClick?: (row: T) => void;
  caption?: React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  loader,
  getKey,
  pageSize = 10,
  mobile = "cards",
  onRowClick,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<string | undefined>();
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");

  const query = React.useMemo<TableQuery>(
    () => ({ page, pageSize, sort, dir }),
    [page, pageSize, sort, dir],
  );

  /* --- 手元の配列: メモリ上で並べ替え・ページング --------------- */
  const local = React.useMemo<TablePage<T> | null>(() => {
    if (!rows) return null;
    let list = rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort);
      list = [...rows].sort((a, b) => {
        const av = cellValue(a, col);
        const bv = cellValue(b, col);
        const r =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "ja");
        return dir === "asc" ? r : -r;
      });
    }
    const total = list.length;
    const sliced =
      pageSize > 0 ? list.slice(page * pageSize, (page + 1) * pageSize) : list;
    return { rows: sliced, total };
  }, [rows, columns, sort, dir, page, pageSize]);

  /* --- サーバー側 ----------------------------------------------- */
  const resolved = React.useMemo(
    () => (loader ? resolveAction<TableQuery, TablePage<T>>(loader) : null),
    // 宣言オブジェクトは毎回新しい参照になるので内容で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof loader === "function" ? loader : JSON.stringify(loader ?? null)],
  );

  const remote = useResource<TablePage<T>>(
    [page, pageSize, sort, dir],
    React.useCallback(
      (_: void, ctx) => {
        if (!resolved) return Promise.resolve({ rows: [], total: 0 });
        return Promise.resolve(resolved(query, ctx));
      },
      [resolved, query],
    ),
    { enabled: !!resolved },
  );

  const state = local
    ? ({ status: "success" as const, data: local, error: undefined })
    : remote;

  const total = state.data?.total ?? 0;
  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

  const toggleSort = (key: string) => {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir("asc");
    }
    setPage(0);
  };

  return (
    <Stack space="sm" className={className}>
      {caption && (
        <Spread space="sm">
          <span className="text-sm font-semibold">{caption}</span>
          {state.status === "success" && (
            <span className="text-xs text-muted-fg">{total} 件</span>
          )}
        </Spread>
      )}

      <AsyncBoundary
        state={state}
        onRetry={local ? undefined : remote.refetch}
        isEmpty={(d) => d.rows.length === 0}
        empty={empty}
        skeletonRows={5}
      >
        {(data) => (
          <>
            {/* 広い画面: 表。mobile="scroll" のときは狭い画面でも表のまま。 */}
            <div className={mobile === "cards" ? "hidden md:block" : "block"}>
              <Scrollable label={typeof caption === "string" ? caption : "表"}>
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {columns.map((c) => (
                        <Th
                          key={c.key}
                          column={c}
                          sorted={sort === c.key ? dir : undefined}
                          onSort={() => toggleSort(c.key)}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr
                        key={getKey ? getKey(row, i) : i}
                        className={cn(
                          "border-b border-border last:border-0",
                          onRowClick && "cursor-pointer hover:bg-muted",
                        )}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              "px-sm py-xs",
                              c.align === "end" && "text-right tabular-nums",
                            )}
                          >
                            {renderCell(row, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scrollable>
            </div>

            {/* 狭い画面: 1 行 = 1 カード。各値に列名を付ける。 */}
            {mobile === "cards" && (
              <Stack space="xs" className="md:hidden">
                <SortBar
                  columns={columns}
                  sort={sort}
                  dir={dir}
                  onSort={toggleSort}
                />
                {data.rows.map((row, i) => (
                  <Box
                    key={getKey ? getKey(row, i) : i}
                    padding="sm"
                    background="card"
                    border
                    radius="lg"
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? "cursor-pointer" : undefined}
                  >
                    <Stack space="2xs">
                      {columns
                        .filter((c) => !c.hideOnCard)
                        .map((c) => (
                          <Spread key={c.key} space="sm" alignY="start">
                            <span className="shrink-0 text-xs text-muted-fg">
                              {c.label}
                            </span>
                            <span className="min-w-0 text-right text-sm">
                              {renderCell(row, c)}
                            </span>
                          </Spread>
                        ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {pageCount > 1 && (
              <Pager page={page} pageCount={pageCount} onChange={setPage} />
            )}
          </>
        )}
      </AsyncBoundary>
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function cellValue<T>(row: T, col?: TableColumn<T>): unknown {
  if (!col) return "";
  if (col.get) return col.get(row);
  return (row as Record<string, unknown>)[col.key];
}

function renderCell<T>(row: T, col: TableColumn<T>): React.ReactNode {
  const v = cellValue(row, col);
  return v as React.ReactNode;
}

/**
 * 見出しセル。
 * 並べ替え可能な列は `aria-sort` を持ち、中身がボタンになります。
 * ボタンにしないとキーボードで並べ替えられません（よく忘れられる箇所です）。
 */
function Th<T>({
  column,
  sorted,
  onSort,
}: {
  column: TableColumn<T>;
  sorted?: "asc" | "desc";
  onSort: () => void;
}) {
  const base = cn(
    "px-sm py-xs text-left font-medium text-muted-fg whitespace-nowrap",
    column.align === "end" && "text-right",
  );

  if (!column.sortable) {
    return <th className={base}>{column.label}</th>;
  }

  return (
    <th
      className={base}
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : "none"
      }
    >
      <button
        onClick={onSort}
        className="inline-flex items-center gap-1 rounded-sm hover:text-fg"
      >
        {column.label}
        <SortIcon dir={sorted} />
      </button>
    </th>
  );
}

function SortIcon({ dir }: { dir?: "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true" fill="none">
      <path
        d="m7 10 5-5 5 5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={dir === "asc" ? 1 : 0.3}
      />
      <path
        d="m7 14 5 5 5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={dir === "desc" ? 1 : 0.3}
      />
    </svg>
  );
}

/** カード表示のときの並べ替え。表の見出しが無いので別に出します。 */
function SortBar<T>({
  columns,
  sort,
  dir,
  onSort,
}: {
  columns: TableColumn<T>[];
  sort?: string;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const sortable = columns.filter((c) => c.sortable);
  if (sortable.length === 0) return null;

  return (
    <Inline space="2xs" wrap={false} className="pb-2xs">
      <span className="shrink-0 self-center text-xs text-muted-fg">
        並べ替え
      </span>
      {sortable.map((c) => (
        <Button
          key={c.key}
          size="sm"
          variant={sort === c.key ? "primary" : "outline"}
          onClick={() => onSort(c.key)}
        >
          {c.label}
          {sort === c.key && (dir === "asc" ? " ↑" : " ↓")}
        </Button>
      ))}
    </Inline>
  );
}

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  return (
    <Spread space="sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        前へ
      </Button>
      <span className="self-center text-xs text-muted-fg" aria-live="polite">
        {page + 1} / {pageCount}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
      >
        次へ
      </Button>
    </Spread>
  );
}
