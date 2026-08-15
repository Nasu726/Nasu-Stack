"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ActionSpec, resolveAction } from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";
import { useAction, type UseActionOptions } from "@/hooks/use-action";
import { Button } from "@/components/ui/action-button";
import { AlertIcon, CheckIcon, Spinner } from "@/components/ui/spinner";

/* ------------------------------------------------------------------
 * フォーム内でフィールドエラーを共有するための文脈
 * ---------------------------------------------------------------- */

interface FormCtx {
  fieldErrors: Record<string, string>;
  isPending: boolean;
  /** 入力が変わったらそのフィールドのエラーを消す */
  clearField: (name: string) => void;
}

const FormContext = React.createContext<FormCtx | null>(null);

/* ------------------------------------------------------------------
 * AsyncForm
 * ---------------------------------------------------------------- */

export interface AsyncFormProps<TOutput>
  extends Omit<
      React.FormHTMLAttributes<HTMLFormElement>,
      "onSubmit" | "action" | "onError"
    >,
    UseActionOptions<Record<string, FormDataEntryValue>, TOutput> {
  /**
   * 送信時に呼ばれる関数。フォームの中身がプレーンなオブジェクトで渡ります。
   * バリデーションに失敗したら ActionError の fields にフィールド名を入れて throw すると、
   * 該当の入力欄の下へ自動で表示されます。
   */
  action: ActionSpec<Record<string, FormDataEntryValue>, TOutput>;
  /** 送信ボタンのラベル。既定「送信する」。 */
  submitLabel?: React.ReactNode;
  /** 成功時に表示するメッセージ。 */
  successMessage?: React.ReactNode;
  /** 成功したらフォームを初期化するか。既定 true。 */
  resetOnSuccess?: boolean;
  children?: React.ReactNode;
}

/**
 * 「関数を 1 つ渡すだけ」で完成するフォーム。
 *
 * 利用者が書かなくてよくなるもの:
 *   - onSubmit の preventDefault
 *   - FormData → オブジェクト変換
 *   - 送信中のボタン無効化・二重送信防止
 *   - フィールド単位のエラー表示と、入力し直したときのクリア
 *   - 成功メッセージの表示と自動消去
 *
 * ```tsx
 * <AsyncForm action={async (values) => api.signup(values)} submitLabel="登録">
 *   <Field name="email" label="メールアドレス" type="email" required />
 *   <Field name="password" label="パスワード" type="password" required />
 * </AsyncForm>
 * ```
 */
export function AsyncForm<TOutput = unknown>({
  action,
  submitLabel = "送信する",
  successMessage = "送信しました",
  resetOnSuccess = true,
  children,
  className,
  onSuccess,
  onError,
  onSettled,
  resetAfter = 4000,
  retry,
  retryDelay,
  guard,
  ...formProps
}: AsyncFormProps<TOutput>) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [cleared, setCleared] = React.useState<Set<string>>(new Set());
  const defaults = useActionDefaults();

  const resolved = React.useMemo(
    () => resolveAction<Record<string, FormDataEntryValue>, TOutput>(action),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof action === "function" ? action : JSON.stringify(action)],
  );

  const state = useAction<Record<string, FormDataEntryValue>, TOutput>(resolved, {
    onSuccess: (data, input) => {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(data, input);
    },
    // フィールド単位で画面内に出せるエラー（入力ミス等）は通知しない。
    // それ以外（通信断・サーバー障害など）は ActionProvider へ流して、
    // フォームが画面外にあっても気づけるようにする。
    onError:
      onError ??
      ((error) => {
        const hasFieldErrors =
          error.fields && Object.keys(error.fields).length > 0;
        if (!hasFieldErrors) defaults.onError?.(error);
      }),
    onSettled,
    resetAfter,
    retry,
    retryDelay,
    guard,
  });

  const rawFieldErrors = state.error?.fields ?? {};
  const fieldErrors = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawFieldErrors)) {
      if (!cleared.has(k)) out[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rawFieldErrors), cleared]);

  // 新しいエラーが来たらクリア済みフラグをリセット
  React.useEffect(() => {
    setCleared(new Set());
  }, [state.error]);

  const clearField = React.useCallback((name: string) => {
    setCleared((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  const ctx = React.useMemo<FormCtx>(
    () => ({ fieldErrors, isPending: state.isPending, clearField }),
    [fieldErrors, state.isPending, clearField],
  );

  // フィールドに紐づかない、フォーム全体のエラー
  const generalError =
    state.isError && Object.keys(fieldErrors).length === 0
      ? state.error?.displayMessage
      : undefined;

  return (
    <FormContext.Provider value={ctx}>
      <form
        ref={formRef}
        noValidate
        className={cn("flex w-full flex-col gap-4", className)}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void state.run(Object.fromEntries(fd.entries()));
        }}
        {...formProps}
      >
        {children}

        {generalError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            <AlertIcon className="mt-0.5 shrink-0" />
            <span>{generalError}</span>
          </p>
        )}

        {state.isSuccess && successMessage && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success"
          >
            <CheckIcon className="shrink-0" />
            <span>{successMessage}</span>
          </p>
        )}

        <Button
          type="submit"
          disabled={state.isPending}
          aria-busy={state.isPending}
          className="self-start"
        >
          {state.isPending ? (
            <>
              <Spinner />
              送信中…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </form>
    </FormContext.Provider>
  );
}

/* ------------------------------------------------------------------
 * Field — ラベル・入力欄・エラー・ヒントを 1 セットにしたもの
 * ---------------------------------------------------------------- */

export interface FieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  name: string;
  label: string;
  /** 入力欄の下に出す補足説明。 */
  hint?: string;
  /** textarea にしたいとき。 */
  multiline?: boolean;
  rows?: number;
}

export function Field({
  name,
  label,
  hint,
  multiline,
  rows = 4,
  className,
  required,
  ...inputProps
}: FieldProps) {
  const ctx = React.useContext(FormContext);
  const id = React.useId();
  const error = ctx?.fieldErrors[name];
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const shared = {
    id,
    name,
    required,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
    disabled: ctx?.isPending,
    onInput: () => ctx?.clearField(name),
    className: cn(
      "w-full rounded-md border bg-card px-3 py-2 text-card-fg",
      // 16px 未満だと、iOS Safari は入力欄に触れた瞬間に画面を自動拡大します。
      // 拡大は手動でしか戻せず、しかも iPad でも起きるため、
      // 「狭い画面のときだけ 16px」では防げません。常に 16px 以上にします。
      "text-base",
      "placeholder:text-muted-fg",
      "transition-colors disabled:opacity-60",
      error ? "border-danger" : "border-input",
      className,
    ),
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-label="必須">
            *
          </span>
        )}
      </label>

      {multiline ? (
        <textarea
          {...shared}
          rows={rows}
          {...(inputProps as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input {...shared} {...inputProps} />
      )}

      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-fg">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
