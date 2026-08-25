import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Paginator — URLを正にしたページ移動
 * ================================================================
 * `getHref`が必須なので、JavaScriptが失敗してもリンクとして移動できます。
 * client routerを使う場合だけ`onPageChange`で通常clickを横取りしてください。
 *
 * ```tsx
 * <Paginator
 *   currentPage={page}
 *   totalPages={120}
 *   getHref={(next) => `/articles?page=${next}`}
 * />
 * ```
 *
 * total件数の取得、page queryの意味、URLとstateの同期はapplicationの責任です。
 * Paginatorは表示するpage/ellipsis、現在位置、前後linkだけを引き受けます。
 */

export type PaginationItem =
  | number
  | "ellipsis-start"
  | "ellipsis-end";

export interface PaginatorLabels {
  navigation: string;
  previous: string;
  next: string;
  page: (page: number) => string;
}

export type PaginatorChangeHandler = (
  page: number,
  event: React.MouseEvent<HTMLAnchorElement>,
) => void;

export interface PaginatorProps
  extends Omit<React.ComponentPropsWithoutRef<"nav">, "children"> {
  currentPage: number;
  totalPages: number;
  /** pageごとの実URL。routerを使う場合も必ず有効なhrefを返します。 */
  getHref: (page: number) => string;
  /**
   * client-side navigation用のescape hatch。componentはpreventDefaultしません。
   * 通常clickだけを横取りし、modifier clickはnative linkのまま残してください。
   */
  onPageChange?: PaginatorChangeHandler;
  /** 現在pageの左右へ残す数。既定1、0〜10へ丸めます。 */
  siblingCount?: number;
  /** 先頭・末尾に常に残す数。既定1、0〜10へ丸めます。 */
  boundaryCount?: number;
  labels?: Partial<PaginatorLabels>;
}

const DEFAULT_LABELS: PaginatorLabels = {
  navigation: "Pagination",
  previous: "Previous page",
  next: "Next page",
  page: (page) => `Page ${page}`,
};

function naturalNumber(
  value: number,
  fallback: number,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function range(from: number, to: number) {
  if (to < from) return [];
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/**
 * 大きな総page数を全部renderせず、pageとellipsisの並びだけを返します。
 * 見た目を使わず自前のlinkを組むときの、1段下のsupported pathです。
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
  boundaryCount = 1,
): PaginationItem[] {
  const total = naturalNumber(totalPages, 1, 1);
  const current = Math.min(naturalNumber(currentPage, 1, 1), total);
  // 誤って巨大なcountを渡しても、DOMをpage数ぶん作らないための上限です。
  // より特殊な見せ方は、この関数をforkして所有するほうが明確です。
  const siblings = naturalNumber(siblingCount, 1, 0, 10);
  const boundaries = naturalNumber(boundaryCount, 1, 0, 10);

  // 表示する数字 + ellipsisが全page数以上なら、途中を省略しません。
  const maximumItems = boundaries * 2 + siblings * 2 + 3;
  if (total <= maximumItems) return range(1, total);

  const startPages = range(1, Math.min(boundaries, total));
  const endPages = range(
    Math.max(total - boundaries + 1, boundaries + 1),
    total,
  );
  const siblingsStart = Math.max(
    Math.min(
      current - siblings,
      total - boundaries - siblings * 2 - 1,
    ),
    boundaries + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(current + siblings, boundaries + siblings * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : total - 1,
  );

  const items: PaginationItem[] = [...startPages];
  if (siblingsStart > boundaries + 2) {
    items.push("ellipsis-start");
  } else if (boundaries + 1 < total - boundaries) {
    items.push(boundaries + 1);
  }

  items.push(...range(siblingsStart, siblingsEnd));

  if (siblingsEnd < total - boundaries - 1) {
    items.push("ellipsis-end");
  } else if (total - boundaries > boundaries) {
    items.push(total - boundaries);
  }
  items.push(...endPages);

  return items;
}

const itemClass = cn(
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2",
  "text-sm font-medium tabular-nums",
);

export function Paginator({
  currentPage,
  totalPages,
  getHref,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  labels: labelsProp,
  className,
  "aria-label": ariaLabel,
  ...props
}: PaginatorProps) {
  const total = naturalNumber(totalPages, 1, 1);
  const current = Math.min(naturalNumber(currentPage, 1, 1), total);
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const items = getPaginationItems(
    current,
    total,
    siblingCount,
    boundaryCount,
  );

  const link = (
    page: number,
    content: React.ReactNode,
    options: { rel?: "prev" | "next"; label: string },
  ) => (
    <a
      href={getHref(page)}
      rel={options.rel}
      aria-label={options.label}
      onClick={(event) => onPageChange?.(page, event)}
      className={cn(
        itemClass,
        "text-fg underline-offset-4 hover:bg-muted hover:underline",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {content}
    </a>
  );

  return (
    <nav
      aria-label={ariaLabel ?? labels.navigation}
      data-current-page={current}
      data-total-pages={total}
      className={cn("max-w-full", className)}
      {...props}
    >
      {/* 狭い器では順序を保ったまま折り返します。bodyを横へ出したり、
          数字を読めない幅へ潰したりしません。 */}
      <ul className="flex max-w-full flex-wrap items-center justify-center gap-1">
        <li>
          {current > 1 ? (
            link(
              current - 1,
              <>
                <span aria-hidden="true">←</span>
                <span className="sr-only sm:not-sr-only sm:ms-1">
                  {labels.previous}
                </span>
              </>,
              { rel: "prev", label: labels.previous },
            )
          ) : (
            <span
              role="link"
              aria-disabled="true"
              aria-label={labels.previous}
              className={cn(itemClass, "cursor-not-allowed text-muted-fg opacity-50")}
            >
              <span aria-hidden="true">←</span>
              <span className="sr-only sm:not-sr-only sm:ms-1">
                {labels.previous}
              </span>
            </span>
          )}
        </li>

        {items.map((item) => (
          <li key={item}>
            {typeof item === "number" ? (
              item === current ? (
                <span
                  aria-current="page"
                  className={cn(itemClass, "bg-primary text-primary-fg")}
                >
                  <span className="sr-only">{labels.page(item)}</span>
                  <span aria-hidden="true">{item}</span>
                </span>
              ) : (
                link(item, item, { label: labels.page(item) })
              )
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex min-h-10 min-w-6 items-center justify-center text-muted-fg"
              >
                …
              </span>
            )}
          </li>
        ))}

        <li>
          {current < total ? (
            link(
              current + 1,
              <>
                <span className="sr-only sm:not-sr-only sm:me-1">
                  {labels.next}
                </span>
                <span aria-hidden="true">→</span>
              </>,
              { rel: "next", label: labels.next },
            )
          ) : (
            <span
              role="link"
              aria-disabled="true"
              aria-label={labels.next}
              className={cn(itemClass, "cursor-not-allowed text-muted-fg opacity-50")}
            >
              <span className="sr-only sm:not-sr-only sm:me-1">
                {labels.next}
              </span>
              <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
