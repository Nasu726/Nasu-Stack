"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  useCopy,
  type CopyError,
  type CopyMethod,
  type CopyStatus,
} from "@/hooks/use-copy";

export interface CopyButtonLabels {
  copying: React.ReactNode;
  success: React.ReactNode;
  error: React.ReactNode;
}

export interface CopyButtonAnnouncements {
  copying: string;
  success: string;
  error: string;
}

export interface CopyButtonRenderContext {
  status: CopyStatus;
  method: CopyMethod | undefined;
  error: CopyError | undefined;
  reset: () => void;
}

export interface CopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "onClick"
  > {
  text: string;
  /** idle時の表示。関数なら全状態の表示を自分で決められます。 */
  children?:
    | React.ReactNode
    | ((context: CopyButtonRenderContext) => React.ReactNode);
  labels?: Partial<CopyButtonLabels>;
  announcements?: Partial<CopyButtonAnnouncements>;
  resetAfter?: number | null;
  onCopied?: (method: CopyMethod) => void | Promise<void>;
  onCopyError?: (error: CopyError) => void | Promise<void>;
}

const DEFAULT_LABELS: CopyButtonLabels = {
  copying: "Copying…",
  success: "Copied",
  error: "Try again",
};

const DEFAULT_ANNOUNCEMENTS: CopyButtonAnnouncements = {
  copying: "Copying",
  success: "Copied to clipboard",
  error: "Could not copy",
};

/**
 * CopyButton — clipboardの結果だけを表示する
 * ================================================================
 * コピーしてよい情報か、文言、成功表示を何秒残すかはapplicationが決めます。
 * Clipboard APIが無い場合はtemporary textareaによるfallbackを試します。
 */
export function CopyButton({
  text,
  children = "Copy",
  labels: labelsProp,
  announcements: announcementsProp,
  resetAfter,
  onCopied,
  onCopyError,
  disabled,
  className,
  type = "button",
  ...props
}: CopyButtonProps) {
  const copy = useCopy({
    resetAfter,
    onSuccess: onCopied,
    onError: onCopyError,
  });
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const announcements = {
    ...DEFAULT_ANNOUNCEMENTS,
    ...announcementsProp,
  };
  const context: CopyButtonRenderContext = {
    status: copy.status,
    method: copy.method,
    error: copy.error,
    reset: copy.reset,
  };
  const content =
    typeof children === "function"
      ? children(context)
      : copy.isCopying
        ? labels.copying
        : copy.isSuccess
          ? labels.success
          : copy.isError
            ? labels.error
            : children;
  const announcement = copy.isCopying
    ? announcements.copying
    : copy.isSuccess
      ? announcements.success
      : copy.isError
        ? announcements.error
        : "";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type={type}
        disabled={disabled || copy.isCopying}
        aria-busy={copy.isCopying}
        data-copy-status={copy.status}
        data-copy-method={copy.method}
        onClick={() => {
          void copy.copy(text);
        }}
        className={cn(
          "inline-flex min-h-10 items-center justify-center rounded-md px-3",
          "border border-input bg-card text-sm font-medium text-card-fg",
          "transition-colors hover:bg-muted",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          copy.isSuccess &&
            "border-success bg-success text-success-fg hover:bg-success",
          copy.isError && "border-danger text-danger",
          className,
        )}
        {...props}
      >
        {content}
      </button>

      <span
        className="sr-only"
        role={copy.isError ? "alert" : "status"}
        aria-live={copy.isError ? "assertive" : "polite"}
      >
        {announcement}
      </span>
    </span>
  );
}
