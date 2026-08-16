"use client";

import * as React from "react";
import { cn, inputClass } from "@/lib/utils";
import { type ActionSpec, resolveAction } from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";
import { useAction, type UseActionOptions } from "@/hooks/use-action";
import { Button } from "@/components/ui/action-button";
import { AlertIcon, CheckIcon, Spinner } from "@/components/ui/spinner";

/* ------------------------------------------------------------------
 * FormData → プレーンなオブジェクト
 * ---------------------------------------------------------------- */

/** 送信された値。同じ name が複数あれば配列になります。 */
export type FormValues = Record<
  string,
  FormDataEntryValue | FormDataEntryValue[]
>;

/**
 * FormData をオブジェクトへ畳みます。
 *
 * **`Object.fromEntries(fd.entries())` を使ってはいけません。**
 * 同じキーが複数あると最後だけ残るので、次が壊れます。
 *   - `<select multiple>` で 3 つ選んでも 1 つしか送られない
 *   - 同じ name のチェックボックスを複数置いても 1 つしか送られない
 *
 * ここでは同名のものを配列に畳みます。
 */
export function formDataToObject(fd: FormData): FormValues {
  const out: FormValues = {};
  for (const [key, value] of fd.entries()) {
    // CheckboxField が置いている「未チェックの目印」は値として扱わない
    if (value === CHECKBOX_ABSENT) {
      if (!(key in out)) out[key] = "";
      continue;
    }
    const existing = out[key];
    if (existing === undefined || existing === "") {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

/**
 * 未チェックのチェックボックスは FormData に現れません。
 * `false` ではなく「キーごと無い」状態になるので、受け取り側が
 * `values.agree === ""` すら期待できなくなります。
 * そこで各チェックボックスの直前に隠し入力を置き、この目印を必ず送ります。
 */
export const CHECKBOX_ABSENT = "__wt_unchecked__";

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
    UseActionOptions<FormValues, TOutput> {
  /**
   * 送信時に呼ばれる関数。フォームの中身がプレーンなオブジェクトで渡ります。
   * バリデーションに失敗したら ActionError の fields にフィールド名を入れて throw すると、
   * 該当の入力欄の下へ自動で表示されます。
   */
  action: ActionSpec<FormValues, TOutput>;
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
    () => resolveAction<FormValues, TOutput>(action),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof action === "function" ? action : JSON.stringify(action)],
  );

  const state = useAction<FormValues, TOutput>(resolved, {
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
          void state.run(formDataToObject(new FormData(e.currentTarget)));
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
 * フィールド共通の部品
 * ------------------------------------------------------------------
 * Field / SelectField / CheckboxField / RadioGroup / DateField が
 * 共通で必要とするもの（id の発行・エラーの取り出し・読み上げの関連付け）を
 * ここに 1 つだけ置きます。各部品が同じ処理を持つと必ずずれるためです。
 * ---------------------------------------------------------------- */

export interface FieldState {
  id: string;
  error?: string;
  disabled: boolean;
  describedBy?: string;
  /** 入力し直したらこのフィールドのエラーを消します。 */
  clear: () => void;
}

export function useFieldState(
  name: string,
  options: { hint?: string } = {},
): FieldState {
  const ctx = React.useContext(FormContext);
  const id = React.useId();
  const error = ctx?.fieldErrors[name];
  const describedBy =
    [options.hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return {
    id,
    error,
    disabled: ctx?.isPending ?? false,
    describedBy,
    clear: React.useCallback(() => ctx?.clearField(name), [ctx, name]),
  };
}

/** ラベル・ヒント・エラーの並びを揃えるための包み。 */
export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
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

      {children}

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

/* ------------------------------------------------------------------
 * Field — 文字入力（text / email / password / number / textarea）
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
  const f = useFieldState(name, { hint });

  const shared = {
    id: f.id,
    name,
    required,
    "aria-invalid": f.error ? (true as const) : undefined,
    "aria-describedby": f.describedBy,
    disabled: f.disabled,
    onInput: f.clear,
    className: inputClass({ error: f.error, className }),
  };

  return (
    <FieldShell
      id={f.id}
      label={label}
      required={required}
      hint={hint}
      error={f.error}
    >
      {multiline ? (
        <textarea
          {...shared}
          rows={rows}
          {...(inputProps as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input {...shared} {...inputProps} />
      )}
    </FieldShell>
  );
}
