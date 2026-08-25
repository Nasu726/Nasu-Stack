"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  usePopover,
  type CloseReason,
  type PopoverAlign,
  type PopoverPlacement,
} from "@/hooks/use-popover";

/**
 * Popover — trigger のそばへ補助的な内容を出す
 * ================================================================
 * 開閉・外側 pointer・Esc・focus 復帰・viewport edge だけを担当します。
 * 中身の role や業務状態は、Popover では決めません。
 *
 * ```tsx
 * <Popover trigger="詳細">
 *   <p>最終更新は 5 分前です。</p>
 * </Popover>
 *
 * // 自分の Button を使う escape hatch
 * <Popover trigger={(props) => <Button {...props}>詳細</Button>}>
 *   ...
 * </Popover>
 * ```
 *
 * コマンド一覧は DropdownMenu、選択肢は Select / AsyncSelect、modal な内容は
 * Dialog を使います。Popover に role="menu" や focus trap は足しません。
 */

export type PopoverChangeReason = "trigger" | "content" | CloseReason;

export interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref: React.Ref<HTMLButtonElement>;
  "aria-controls"?: string;
  "aria-expanded": boolean;
}

export interface PopoverRenderContext {
  open: boolean;
  close: () => void;
}

export interface PopoverProps {
  /**
   * 文字や icon なら既定の button に入ります。
   * 自前の button は関数で props と ref を必ず渡してください。
   */
  trigger:
    | React.ReactNode
    | ((props: PopoverTriggerProps) => React.ReactNode);
  children:
    | React.ReactNode
    | ((context: PopoverRenderContext) => React.ReactNode);
  /** controlled で開閉するとき。 */
  open?: boolean;
  /** uncontrolled の初期値。既定 false。 */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: PopoverChangeReason) => void;
  /** 希望する向き。入らなければ viewport 内へ残る側を選びます。 */
  placement?: PopoverPlacement;
  align?: PopoverAlign;
  disabled?: boolean;
  closeOnEscape?: boolean;
  closeOnOutside?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Popover({
  trigger,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placement = "auto",
  align = "start",
  disabled = false,
  closeOnEscape = true,
  closeOnOutside = true,
  className,
  contentClassName,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] =
    React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentId = React.useId();

  const changeOpen = React.useCallback(
    (next: boolean, reason: PopoverChangeReason) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next, reason);
    },
    [controlledOpen, onOpenChange],
  );

  const close = React.useCallback(
    (reason: CloseReason | "content") => {
      changeOpen(false, reason);
      if (reason === "escape" || reason === "content") {
        // 閉じる描画のあとに戻します。controlled の親も同じ event で
        // state を更新でき、消える content へ focus が残りません。
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    },
    [changeOpen],
  );

  const { anchorRef, floatingRef, floatingStyle, placement: actualPlacement } =
    usePopover<HTMLDivElement>({
      open,
      onClose: close,
      placement,
      align,
      closeOnEscape,
      closeOnOutside,
    });

  const triggerProps: PopoverTriggerProps = {
    ref: triggerRef,
    type: "button",
    disabled,
    "aria-controls": open ? contentId : undefined,
    "aria-expanded": open,
    onClick: () => {
      if (!disabled) changeOpen(!open, "trigger");
    },
  };

  return (
    <div ref={anchorRef} className={cn("relative inline-block", className)}>
      {typeof trigger === "function" ? (
        trigger(triggerProps)
      ) : (
        <button
          {...triggerProps}
          className={cn(
            "inline-flex min-h-10 items-center justify-center rounded-md",
            "border border-input bg-card px-3 text-sm font-medium text-card-fg",
            "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {trigger}
        </button>
      )}

      {open && (
        <div
          ref={floatingRef as React.Ref<HTMLDivElement>}
          id={contentId}
          data-placement={actualPlacement}
          style={floatingStyle}
          className={cn(
            "absolute z-50 min-w-48 max-w-[calc(100vw-1rem)] overflow-y-auto",
            "overscroll-contain rounded-lg border border-border bg-card p-sm",
            "text-sm text-card-fg shadow-e3",
            actualPlacement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            contentClassName,
          )}
        >
          {typeof children === "function"
            ? children({ open, close: () => close("content") })
            : children}
        </div>
      )}
    </div>
  );
}
