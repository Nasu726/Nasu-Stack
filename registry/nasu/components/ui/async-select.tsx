"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Action } from "@/lib/action";
import { useResource } from "@/hooks/use-resource";
import { Spinner } from "@/components/ui/spinner";

/**
 * AsyncSelect — 検索つきセレクト
 * ================================================================
 * ```tsx
 * <AsyncSelect
 *   label="担当者"
 *   loader={(q, ctx) => jsonRequest<User[]>(`/api/users?q=${q}`, { ctx })}
 *   getKey={(u) => u.id}
 *   getLabel={(u) => u.name}
 *   onChange={setOwner}
 * />
 * ```
 *
 * 引き受けているもの:
 *   - 入力のたびに投げない（既定 250ms の debounce）
 *   - **前の要求の自動中断。** 検索語を useResource の依存キーにしているので、
 *     打ち直すと前のリクエストが abort されます。古い応答が新しい応答を
 *     上書きする競合は、この層で既に解けています
 *   - キーボード操作（↑↓ Enter Esc Home End）
 *   - WAI-ARIA の combobox パターン
 *   - 画面下部で開いたときに候補が画面外へ出ないよう、上下を自動で切り替え
 */

export interface AsyncSelectProps<T> {
  label: string;
  /** 検索語を受け取って候補を返す関数。ctx.signal を fetch に渡してください。 */
  loader: Action<string, T[]>;
  getKey: (item: T) => React.Key;
  getLabel: (item: T) => string;
  /** 候補 1 件の描画。省略時は getLabel。 */
  renderItem?: (item: T) => React.ReactNode;
  value?: T | null;
  onChange?: (item: T | null) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** 入力から検索までの待ち時間 (ms)。既定 250。 */
  debounce?: number;
  /** 空文字でも検索するか。既定 true（開いた瞬間に一覧が出ます）。 */
  searchOnEmpty?: boolean;
  name?: string;
  className?: string;
}

export function AsyncSelect<T>({
  label,
  loader,
  getKey,
  getLabel,
  renderItem,
  value,
  onChange,
  placeholder,
  hint,
  required,
  disabled,
  debounce = 250,
  searchOnEmpty = true,
  name,
  className,
}: AsyncSelectProps<T>) {
  const id = React.useId();
  const listId = `${id}-list`;

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [placement, setPlacement] = React.useState<"below" | "above">("below");

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  /* --- 入力 → debounce → 検索語 --------------------------------- */
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(text), debounce);
    return () => clearTimeout(t);
  }, [text, debounce]);

  /* --- 検索語が変われば取得。前の要求は useResource が中断する --- */
  const result = useResource<T[]>(
    [query, open],
    React.useCallback(
      (_: void, ctx) => loaderRef.current(query, ctx),
      [query],
    ),
    { enabled: open && (searchOnEmpty || query.length > 0), retry: 0 },
  );

  const items = result.data ?? [];

  // 候補が入れ替わったら選択位置を先頭へ戻す
  React.useEffect(() => {
    setActive(0);
  }, [query, open]);

  /* --- 開く位置。下に入らなければ上へ ---------------------------
     依存を増やさないための最小実装です。開いた瞬間に一度だけ測ります。
     スクロール追従が要る場面が出てきたら、この関数だけ差し替えてください。 */
  const decidePlacement = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const needed = 260; // 候補リストの最大高さの目安
    setPlacement(below < needed && above > below ? "above" : "below");
  }, []);

  React.useEffect(() => {
    if (!open) return;
    decidePlacement();
    window.addEventListener("resize", decidePlacement);
    return () => window.removeEventListener("resize", decidePlacement);
  }, [open, decidePlacement]);

  /* --- 外側をクリックしたら閉じる -------------------------------- */
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    // 選び直さずに閉じたときは、選択中の値の表示へ戻す
    setText(value ? getLabel(value) : "");
  }

  function choose(item: T) {
    onChange?.(item);
    setText(getLabel(item));
    setOpen(false);
    inputRef.current?.focus();
  }

  /* --- キーボード -------------------------------------------------
     フォーカスは入力欄に置いたまま、aria-activedescendant で
     「いまどれを選んでいるか」を伝えます。
     実フォーカスを候補へ移すと文字が打てなくなります。 */
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (items.length === 0) return;
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + items.length) % items.length;
      });
      return;
    }
    if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(0, items.length - 1));
      return;
    }
    if (e.key === "Enter") {
      if (open && items[active]) {
        e.preventDefault();
        choose(items[active]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.key === "Tab" && open) {
      close();
    }
  }

  // 選択中の候補が見えるようにスクロール
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open, items.length]);

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-label="必須">
            *
          </span>
        )}
      </label>

      <div ref={wrapRef} className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && items[active] ? `${id}-opt-${active}` : undefined
          }
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange?.(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full rounded-md border border-input bg-card px-3 py-2 pr-8 text-card-fg",
            // 16px 未満だと iOS が触れた瞬間に画面を自動拡大します
            "text-base",
            "placeholder:text-muted-fg disabled:opacity-60",
          )}
        />

        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          {result.isPending && open ? (
            <Spinner className="text-muted-fg" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="size-4 text-muted-fg"
              aria-hidden="true"
              fill="none"
            >
              <path
                d="m7 10 5 5 5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className={cn(
              "absolute z-40 max-h-[260px] w-full overflow-y-auto rounded-lg",
              "border border-border bg-card p-1 shadow-e3",
              placement === "below" ? "top-full mt-1" : "bottom-full mb-1",
            )}
          >
            {result.isPending && items.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-fg">検索中…</li>
            )}

            {result.isError && (
              <li role="alert" className="px-2 py-2 text-sm text-danger">
                {result.error?.displayMessage ?? "取得に失敗しました"}
              </li>
            )}

            {!result.isPending && !result.isError && items.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-fg">
                候補がありません
              </li>
            )}

            {items.map((item, i) => (
              <li
                key={getKey(item)}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                // pointerdown だと入力欄の blur より先に走るので選択が確実になる
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
                onPointerEnter={() => setActive(i)}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-2 text-sm",
                  i === active ? "bg-accent text-accent-fg" : "text-card-fg",
                )}
              >
                {renderItem ? renderItem(item) : getLabel(item)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-fg">
          {hint}
        </p>
      )}
    </div>
  );
}
