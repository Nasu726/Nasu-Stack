"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePopover } from "@/hooks/use-popover";

/**
 * DropdownMenu / NavDropdown — 押すと出るもの
 * ================================================================
 * **見た目が同じでも、中身が「命令」か「リンク」かで別部品にしています。**
 * ここは間違えやすく、しかも間違えると読み上げが壊れます。
 *
 * | | 中身 | 役割 | 読み上げ |
 * |---|---|---|---|
 * | `DropdownMenu` | 押すと**何かが起きる**（複製・削除・書き出し） | `menu` / `menuitem` | 「メニュー項目」 |
 * | `NavDropdown` | 押すと**どこかへ行く**（製品・会社概要） | ただの `<ul><li><a>` | 「リンク」 |
 *
 * `role="menu"` はアプリのコマンド用です。リンクの集まりに付けると、
 * スクリーンリーダーの利用者は**リンクだと分からなくなり**、
 * 「新しいタブで開く」といった操作の見当も付かなくなります。
 * サイトのナビゲーションには使ってはいけません。
 *
 * ```tsx
 * <DropdownMenu
 *   label="操作"
 *   items={[
 *     { label: "複製する", onSelect: duplicate },
 *     { separator: true },
 *     { label: "削除する", onSelect: remove, tone: "danger" },
 *   ]}
 * />
 *
 * <NavDropdown label="製品" items={[{ label: "料金", href: "/pricing" }]} />
 * ```
 */

export type MenuItem =
  | {
      label: React.ReactNode;
      onSelect: () => void;
      disabled?: boolean;
      tone?: "default" | "danger";
      separator?: never;
    }
  | { separator: true; label?: never; onSelect?: never };

export interface DropdownMenuProps {
  /** 開くボタンの文言。 */
  label: React.ReactNode;
  items: MenuItem[];
  /** 開くボタンを自分で用意したいとき。 */
  trigger?: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
  }) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
}

export function DropdownMenu({
  label,
  items,
  trigger,
  align = "start",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  const close = React.useCallback((returnFocus = true) => {
    setOpen(false);
    // 閉じたら開いたボタンへ戻します。ここを忘れると、
    // キーボードの人はページの先頭から辿り直すことになります。
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const { anchorRef, placement } = usePopover<HTMLDivElement>({
    open,
    // Esc で閉じたら、開いたボタンへフォーカスを戻します。
    // ここを忘れるとキーボードの人はページの先頭から辿り直しになります。
    // 外側を押して閉じたときは戻しません（押した先からフォーカスを奪うため）。
    onClose: (reason) => close(reason === "escape"),
  });

  /** 押せる項目だけを集めます（区切り線と無効な項目は飛ばす）。 */
  const focusables = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      ) ?? [],
    );

  const focusAt = (index: number) => {
    const list = focusables();
    if (list.length === 0) return;
    const i = (index + list.length) % list.length;
    list[i]?.focus();
  };

  // 開いたら先頭へフォーカスを送ります。
  // メニューは「フォーカスそのものを移す」のが正しい形です
  // （入力欄に留めたまま aria-activedescendant を使う combobox とは違います）。
  React.useEffect(() => {
    if (open) focusAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      // 開いてから最後へ。描画を待つ必要があります
      requestAnimationFrame(() => focusAt(-1));
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables();
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(-1);
        break;
      case "Tab":
        // メニューを開いたまま Tab で外へ出るのは迷子のもとなので閉じます
        close(false);
        break;
      default:
        break;
    }
  };

  const triggerProps = {
    ref: triggerRef,
    onClick: () => setOpen((o) => !o),
    "aria-expanded": open,
    "aria-haspopup": "menu" as const,
  };

  return (
    <div ref={anchorRef} className={cn("relative inline-block", className)}>
      {trigger ? (
        trigger(triggerProps)
      ) : (
        <button
          type="button"
          {...triggerProps}
          aria-controls={open ? id : undefined}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "inline-flex min-h-11 items-center gap-1 rounded-md border border-border",
            "bg-card px-3 text-sm font-medium text-card-fg hover:bg-muted",
          )}
        >
          {label}
          <Chevron open={open} />
        </button>
      )}

      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={typeof label === "string" ? label : undefined}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-50 min-w-[12rem] rounded-lg border border-border bg-card p-1 shadow-e3",
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div
                key={i}
                role="separator"
                className="my-1 h-px bg-border"
              />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  item.onSelect();
                  close();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger/10"
                    : "hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ==================================================================
 * NavDropdown — リンクを下ろす
 * ================================================================ */

export interface NavDropdownItem {
  label: React.ReactNode;
  href: string;
  /** 現在のページかどうか。 */
  current?: boolean;
}

export interface NavDropdownProps {
  label: React.ReactNode;
  items: NavDropdownItem[];
  align?: "start" | "end";
  className?: string;
}

export function NavDropdown({
  label,
  items,
  align = "start",
  className,
}: NavDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const { anchorRef, placement } = usePopover<HTMLDivElement>({
    open,
    onClose: (reason) => {
      setOpen(false);
      if (reason === "escape") triggerRef.current?.focus();
    },
  });

  return (
    <div ref={anchorRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-fg hover:text-fg"
      >
        {label}
        <Chevron open={open} />
      </button>

      {open && (
        // **role は付けません。** これはリンクの一覧なので、
        // ただのリストのまま読み上げられるのが正しい形です。
        <ul
          id={id}
          className={cn(
            "absolute z-50 min-w-[12rem] rounded-lg border border-border bg-card p-1 shadow-e3",
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted",
                  item.current && "font-medium text-primary",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      className={cn(
        "size-4 shrink-0 transition-transform duration-200",
        open && "rotate-180",
      )}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
