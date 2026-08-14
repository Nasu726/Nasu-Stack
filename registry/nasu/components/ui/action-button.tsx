"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ActionSpec, resolveAction } from "@/lib/action";
import { useAction, type UseActionOptions } from "@/hooks/use-action";
import { AlertIcon, CheckIcon, Spinner } from "@/components/ui/spinner";

/* ------------------------------------------------------------------
 * 見た目のバリエーション
 * ---------------------------------------------------------------- */

const VARIANTS = {
  primary:
    "bg-primary text-primary-fg shadow-e1 hover:brightness-110 active:brightness-95",
  secondary:
    "bg-muted text-fg border border-border hover:bg-accent hover:text-accent-fg",
  ghost: "text-fg hover:bg-muted",
  danger:
    "bg-danger text-danger-fg shadow-e1 hover:brightness-110 active:brightness-95",
  outline:
    "border border-input bg-transparent text-fg hover:bg-muted",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/* ------------------------------------------------------------------
 * 状態を持たない素のボタン（見た目だけ欲しいときはこちら）
 * ---------------------------------------------------------------- */

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-[filter,background-color,color] duration-150",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

/* ------------------------------------------------------------------
 * ActionButton — 関数を渡すだけで 4 状態を全部持つボタン
 * ---------------------------------------------------------------- */

export interface ActionButtonLabels {
  idle?: React.ReactNode;
  pending?: React.ReactNode;
  success?: React.ReactNode;
  error?: React.ReactNode;
}

export interface ActionButtonProps<TInput, TOutput>
  extends Omit<ButtonProps, "onClick" | "children" | "onError">,
    UseActionOptions<TInput, TOutput> {
  /**
   * 押したときに呼ばれる関数。これだけ渡せば動きます。
   * 第 2 引数の ctx.signal を fetch に渡すと、中断も自動で効きます。
   *
   * Astro の island など、関数を渡せない場所では
   * `{ url: "/api/save" }` のような宣言でも書けます。
   */
  action: ActionSpec<TInput, TOutput>;
  /** action に渡す値。省略時は undefined。 */
  input?: TInput;
  /** 各状態の表示。文字列でも要素でも可。 */
  labels?: ActionButtonLabels;
  /** labels.idle の短縮形。`<ActionButton action={...}>保存</ActionButton>` と書けます。 */
  children?: React.ReactNode;
  /** 押す前に確認ダイアログを出す文言。指定すると確認してから実行します。 */
  confirm?: string;
  /** エラー時にボタン下へメッセージを表示するか。既定 true。 */
  showError?: boolean;
}

/**
 * 「呼び出す関数をセットするだけ」で完成するボタン。
 *
 * 利用者が書かなくてよくなるもの:
 *   - useState(false) の loading フラグ
 *   - 連打による二重送信のガード
 *   - try/catch とエラー文言の出し分け
 *   - 成功したことの視覚的フィードバック
 *   - aria-busy / aria-live などのアクセシビリティ属性
 *
 * ```tsx
 * <ActionButton action={() => api.saveProfile(form)}>保存する</ActionButton>
 * ```
 */
export function ActionButton<TInput = void, TOutput = unknown>({
  action,
  input,
  labels,
  children,
  confirm,
  showError = true,
  className,
  variant = "primary",
  size = "md",
  disabled,
  onSuccess,
  onError,
  onSettled,
  resetAfter,
  retry,
  retryDelay,
  guard,
  ...buttonProps
}: ActionButtonProps<TInput, TOutput>) {
  const resolved = React.useMemo(
    () => resolveAction<TInput, TOutput>(action),
    // 宣言オブジェクトは毎回新しい参照になるため、内容で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof action === "function" ? action : JSON.stringify(action)],
  );

  const state = useAction<TInput, TOutput>(resolved, {
    onSuccess,
    onError,
    onSettled,
    resetAfter,
    retry,
    retryDelay,
    guard: confirm
      ? async (i) => {
          const ok = window.confirm(confirm);
          if (!ok) return false;
          return guard ? await guard(i) : true;
        }
      : guard,
  });

  const idleLabel = labels?.idle ?? children ?? "実行";

  const content = state.isPending ? (
    <>
      <Spinner />
      {labels?.pending ?? "処理中…"}
    </>
  ) : state.isSuccess ? (
    <>
      <CheckIcon />
      {labels?.success ?? "完了しました"}
    </>
  ) : state.isError ? (
    <>
      <AlertIcon />
      {labels?.error ?? "やり直す"}
    </>
  ) : (
    idleLabel
  );

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <Button
        variant={state.isError ? "danger" : variant}
        size={size}
        disabled={disabled || state.isPending}
        aria-busy={state.isPending}
        onClick={() => void state.run(input as TInput)}
        className={cn(state.isSuccess && "bg-success text-success-fg", className)}
        {...buttonProps}
      >
        {content}
      </Button>

      {/* 状態変化をスクリーンリーダーへ通知 */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.isPending ? "処理中" : state.isSuccess ? "完了しました" : ""}
      </span>

      {showError && state.isError && state.error && (
        <p
          role="alert"
          className="max-w-xs text-xs leading-relaxed text-danger"
        >
          {state.error.displayMessage}
        </p>
      )}
    </div>
  );
}
