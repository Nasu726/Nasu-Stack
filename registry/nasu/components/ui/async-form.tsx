"use client";

import * as React from "react";
import { cn, inputClass } from "@/lib/utils";
import {
  ActionError,
  type Action,
  type ActionSpec,
  resolveAction,
} from "@/lib/action";
import { useActionDefaults } from "@/lib/action-defaults";
import {
  normalizeValidationFailure,
  runValidation,
  type Validator,
} from "@/lib/validation";
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
export function formDataToObject(
  fd: FormData,
  checkboxNames: Iterable<string> = [],
): FormValues {
  // `__proto__` / `constructor` も通常のfield nameとして保持します。
  // `{}` と `in` の組み合わせではprototype側を既存値と誤認します。
  const out: FormValues = Object.create(null);
  for (const [key, value] of fd.entries()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = value;
      continue;
    }
    const existing = out[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  // 未チェックを通常文字列のsentinelで表すと、その文字列を入力した利用者の
  // dataと衝突します。FormDataとは別のcontrol情報から、不在のkeyだけ補います。
  for (const name of checkboxNames) {
    if (
      name &&
      !Object.prototype.hasOwnProperty.call(out, name)
    ) {
      out[name] = "";
    }
  }
  return out;
}

/**
 * @deprecated 値sentinel方式は利用者dataと衝突するため廃止しました。
 * 既にimportしているcopy-owned sourceを壊さないため、export名だけを残します。
 */
export const CHECKBOX_ABSENT = "__wt_unchecked__";

function enabledCheckboxNames(form: HTMLFormElement): string[] {
  const names = new Set<string>();
  for (const control of Array.from(form.elements)) {
    if (
      control instanceof HTMLInputElement &&
      control.type === "checkbox" &&
      control.name &&
      !control.disabled
    ) {
      names.add(control.name);
    }
  }
  return [...names];
}

function hasMatchingFieldControl(
  form: HTMLFormElement | null,
  fields: Record<string, string> | undefined,
): boolean {
  if (!form || !fields) return false;
  const names = new Set(Object.keys(fields));
  return Array.from(form.elements).some((control) => {
    if (!(control instanceof HTMLElement)) return false;
    if (control.getAttribute("type") === "hidden") return false;
    const name = control.getAttribute("name");
    return !!name && names.has(name);
  });
}

/* ------------------------------------------------------------------
 * フォーム内でフィールドエラーを共有するための文脈
 * ---------------------------------------------------------------- */

interface FormCtx {
  fieldErrors: Record<string, string>;
  isPending: boolean;
  /** 入力が変わったらそのフィールドのエラーを消す */
  clearField: (name: string) => void;
  /** FieldArray の構造が変わったら、その path 以下の古いエラーを消す。 */
  clearFieldTree: (name: string) => void;
}

const FormContext = React.createContext<FormCtx | null>(null);

/* ------------------------------------------------------------------
 * AsyncForm
 * ---------------------------------------------------------------- */

interface AsyncFormBaseProps<TOutput>
  extends Omit<
      React.FormHTMLAttributes<HTMLFormElement>,
      "onSubmit" | "action" | "onError"
    >,
    UseActionOptions<FormValues, TOutput> {
  /** 送信ボタンのラベル。既定「送信する」。 */
  submitLabel?: React.ReactNode;
  /** 成功時に表示するメッセージ。 */
  successMessage?: React.ReactNode;
  /** 成功したらフォームを初期化するか。既定 true。 */
  resetOnSuccess?: boolean;
  children?: React.ReactNode;
}

/** validationで変換しない通常のAsyncForm。actionにはFormValuesが届きます。 */
export interface AsyncFormProps<TOutput = unknown>
  extends AsyncFormBaseProps<TOutput> {
  action: ActionSpec<FormValues, TOutput>;
  /** dataの型を変換する場合はValidatedAsyncFormProps側の必須propになります。 */
  validate?: never;
}

/** validation successの変換済みdataをactionへ渡すAsyncForm。 */
export interface ValidatedAsyncFormProps<TData, TOutput = unknown>
  extends AsyncFormBaseProps<TOutput> {
  /** lifecycle callbackの第2引数は、変換前のFormValuesのままです。 */
  /**
   * 送信時に呼ばれる関数。validatorが返した変換後の`data`が渡ります。
   * バリデーションに失敗したら ActionError の fields にフィールド名を入れて throw すると、
   * 該当の入力欄の下へ自動で表示されます。
   */
  action: ActionSpec<TData, TOutput>;
  /**
   * library 非依存の validation contract。成功時の `data` だけを action へ渡します。
   * ブラウザ側では早い feedback のために使い、正規の判定は server 側でも行ってください。
   */
  validate: Validator<TData, FormValues>;
}

/**
 * 「関数を 1 つ渡すだけ」で完成するフォーム。
 *
 * 利用者が書かなくてよくなるもの:
 *   - onSubmit の preventDefault
 *   - FormData → オブジェクト変換
 *   - 送信中のボタン無効化・二重送信防止
 *   - フィールド単位のエラー表示と、入力し直したときのクリア
 *   - 最初のフィールドエラーへのフォーカス（validation failureは自動retryしない）
 *   - 成功メッセージの表示と自動消去
 *
 * ```tsx
 * <AsyncForm action={async (values) => api.signup(values)} submitLabel="登録">
 *   <Field name="email" label="メールアドレス" type="email" required />
 *   <Field name="password" label="パスワード" type="password" required />
 * </AsyncForm>
 * ```
 */
export function AsyncForm<TOutput = unknown>(
  props: AsyncFormProps<TOutput>,
): React.ReactElement;
export function AsyncForm<TData, TOutput = unknown>(
  props: ValidatedAsyncFormProps<TData, TOutput>,
): React.ReactElement;
export function AsyncForm<TData = FormValues, TOutput = unknown>({
  action,
  validate,
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
  pendingDuringGuard,
  ...formProps
}: AsyncFormProps<TOutput> | ValidatedAsyncFormProps<TData, TOutput>) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [cleared, setCleared] = React.useState<Set<string>>(new Set());
  const [clearedTrees, setClearedTrees] = React.useState<Set<string>>(
    new Set(),
  );
  const defaults = useActionDefaults();

  const resolved = React.useMemo(
    () => resolveAction<TData, TOutput>(action as ActionSpec<TData, TOutput>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof action === "function" ? action : JSON.stringify(action)],
  );

  const validatedAction = React.useMemo<Action<FormValues, TOutput>>(
    () => async (values, ctx) => {
      const validator = validate as Validator<TData, FormValues> | undefined;
      if (!validator) {
        return resolved(values as TData, ctx);
      }
      const result = await runValidation(validator, values);
      if (!result.ok) {
        const failure = normalizeValidationFailure(result);
        throw new ActionError("validation failed", {
          code: "VALIDATION",
          displayMessage: failure.message ?? "validation failed",
          fields: failure.fields,
          cause: result,
        });
      }
      return resolved(result.data, ctx);
    },
    [resolved, validate],
  );

  const state = useAction<FormValues, TOutput>(validatedAction, {
    onSuccess: async (data, input) => {
      if (resetOnSuccess) formRef.current?.reset();
      // Promise を return/await して、useAction の callSafely まで届けます。
      // 捨てると async callback の rejection だけが window へ逃げます。
      await onSuccess?.(data, input);
    },
    // フィールド単位で画面内に出せるエラー（入力ミス等）は通知しない。
    // それ以外（通信断・サーバー障害など）は ActionProvider へ流して、
    // フォームが画面外にあっても気づけるようにする。
    onError:
      onError ??
      ((error) => {
        const hasFieldErrors = hasMatchingFieldControl(
          formRef.current,
          error.fields,
        );
        if (!hasFieldErrors) defaults.onError?.(error);
      }),
    onSettled,
    resetAfter,
    retry,
    retryDelay,
    guard,
    pendingDuringGuard,
  });

  const rawFieldErrors = state.error?.fields ?? {};
  const fieldErrors = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawFieldErrors)) {
      const treeWasCleared = Array.from(clearedTrees).some(
        (root) => k === root || k.startsWith(`${root}.`),
      );
      if (!cleared.has(k) && !treeWasCleared) out[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rawFieldErrors), cleared, clearedTrees]);

  // 新しいエラーが来たらクリア済みフラグをリセット
  React.useEffect(() => {
    setCleared(new Set());
    setClearedTrees(new Set());
  }, [state.error]);

  // 新しい field error が来たら、DOM 順で最初の該当 control へ移します。
  // visual order や object の index ではなく、実際の form control の順を使うので、
  // RadioGroup や後から追加される nested field でも読み上げ順と一致します。
  React.useEffect(() => {
    if (!state.error || !formRef.current) return;
    const names = new Set(Object.keys(state.error.fields ?? {}));
    if (names.size === 0) return;

    const target = Array.from(formRef.current.elements).find(
      (control): control is HTMLElement => {
        if (!(control instanceof HTMLElement)) return false;
        const name = control.getAttribute("name");
        if (!name || !names.has(name)) return false;
        if (control.getAttribute("type") === "hidden") return false;
        if ("disabled" in control && control.disabled === true) return false;
        return control.tabIndex >= 0;
      },
    );
    target?.focus();
  }, [state.error]);

  const clearField = React.useCallback((name: string) => {
    setCleared((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  const clearFieldTree = React.useCallback((name: string) => {
    setClearedTrees((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  const ctx = React.useMemo<FormCtx>(
    () => ({
      fieldErrors,
      isPending: state.isPending,
      clearField,
      clearFieldTree,
    }),
    [fieldErrors, state.isPending, clearField, clearFieldTree],
  );

  // フィールドに紐づかない、フォーム全体のエラー
  const generalError =
    state.isError &&
    !hasMatchingFieldControl(formRef.current, rawFieldErrors)
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
          const form = e.currentTarget;
          void state.run(
            formDataToObject(new FormData(form), enabledCheckboxNames(form)),
          );
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
  /** この name と `name.*` 以下のエラーをまとめて消します。 */
  clearTree: () => void;
}

export function useFieldState(
  name: string,
  options: { hint?: string } = {},
): FieldState {
  const ctx = React.useContext(FormContext);
  const clearField = ctx?.clearField;
  const clearFieldTree = ctx?.clearFieldTree;
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
    clear: React.useCallback(() => clearField?.(name), [clearField, name]),
    clearTree: React.useCallback(
      () => clearFieldTree?.(name),
      [clearFieldTree, name],
    ),
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
  const {
    disabled: disabledProp,
    onInput: onInputProp,
    "aria-describedby": describedByProp,
    "aria-invalid": invalidProp,
    ...controlProps
  } = inputProps;
  const describedBy =
    [describedByProp, f.describedBy].filter(Boolean).join(" ") || undefined;

  const shared = {
    id: f.id,
    name,
    required,
    "aria-invalid": f.error ? (true as const) : invalidProp,
    "aria-describedby": describedBy,
    disabled: f.disabled || disabledProp,
    onInput: (event: React.InputEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      f.clear();
      onInputProp?.(event as React.InputEvent<HTMLInputElement>);
    },
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
          {...(controlProps as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...shared}
          rows={rows}
        />
      ) : (
        <input {...controlProps} {...shared} />
      )}
    </FieldShell>
  );
}
