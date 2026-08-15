"use client";

import * as React from "react";
import { cn, inputClass } from "@/lib/utils";
import {
  CHECKBOX_ABSENT,
  useFieldState,
  FieldShell,
} from "@/components/ui/async-form";
import { Stack } from "@/components/ui/layout";

/**
 * 入力部品 — Select / Checkbox / CheckboxGroup / Radio / Date
 * ================================================================
 * `Field` に `type` を足すのではなく別部品にしています。
 * `options` が要る・値の型が違う・ラベルの付き方が違うためです。
 *
 * 共通して面倒をみるもの:
 *   - ラベルと入力欄の紐づけ、エラー・ヒントの読み上げ関連付け
 *   - `AsyncForm` のフィールド単位エラー表示と、打ち直しでの自動クリア
 *   - 入力欄の文字を 16px 以上に（iOS の自動拡大を止める）
 *   - **チェックボックス／ラジオはラベル全体を当たり判定に**
 *     四角自体は 16px 程度しかないので、ラベルを含めないと指で押せません
 */

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

/* ================================================================
 * SelectField
 * ============================================================== */

export interface SelectFieldProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  name: string;
  label: string;
  options: Option[];
  hint?: string;
  /** 未選択のときに出す選択肢。multiple のときは出しません。 */
  placeholder?: string;
}

export function SelectField({
  name,
  label,
  options,
  hint,
  placeholder,
  required,
  multiple,
  className,
  ...props
}: SelectFieldProps) {
  const f = useFieldState(name, { hint });

  return (
    <FieldShell
      id={f.id}
      label={label}
      required={required}
      hint={hint}
      error={f.error}
    >
      <select
        id={f.id}
        name={name}
        required={required}
        multiple={multiple}
        aria-invalid={f.error ? true : undefined}
        aria-describedby={f.describedBy}
        disabled={f.disabled}
        onChange={f.clear}
        className={inputClass({
          error: f.error,
          className: cn(multiple && "min-h-32", className),
        })}
        {...props}
      >
        {!multiple && placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* ================================================================
 * CheckboxField — 単独のチェックボックス
 * ============================================================== */

export interface CheckboxFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  name: string;
  label: React.ReactNode;
  hint?: string;
}

export function CheckboxField({
  name,
  label,
  hint,
  required,
  className,
  ...props
}: CheckboxFieldProps) {
  const f = useFieldState(name, { hint });

  return (
    <Stack space="2xs">
      {/* 未チェックでも値が届くようにする目印。
          これが無いと「キーごと無い」状態になり、受け取り側が false を判定できません。 */}
      <input type="hidden" name={name} value={CHECKBOX_ABSENT} />

      {/* ラベル全体を当たり判定にする。四角だけだと 16px 程度で指で押せません。 */}
      <label
        htmlFor={f.id}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-2 text-sm",
          f.disabled && "opacity-60",
          className,
        )}
      >
        <input
          id={f.id}
          name={name}
          type="checkbox"
          required={required}
          aria-invalid={f.error ? true : undefined}
          aria-describedby={f.describedBy}
          disabled={f.disabled}
          onChange={f.clear}
          className="size-5 shrink-0 accent-primary"
          {...props}
        />
        <span>
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-label="必須">
              *
            </span>
          )}
        </span>
      </label>

      {hint && !f.error && (
        <p id={`${f.id}-hint`} className="text-xs text-muted-fg">
          {hint}
        </p>
      )}
      {f.error && (
        <p id={`${f.id}-error`} role="alert" className="text-xs text-danger">
          {f.error}
        </p>
      )}
    </Stack>
  );
}

/* ================================================================
 * CheckboxGroup / RadioGroup
 * ============================================================== */

interface GroupProps {
  name: string;
  label: string;
  options: Option[];
  hint?: string;
  required?: boolean;
  /** 横に並べるか。既定 false（縦）。 */
  inline?: boolean;
  className?: string;
}

/**
 * 複数選べるチェックボックス群。
 * 同じ `name` を複数持つので、`AsyncForm` は値を**配列**で渡します。
 */
export function CheckboxGroup({
  name,
  label,
  options,
  hint,
  required,
  inline,
  className,
}: GroupProps) {
  return (
    <Choices
      kind="checkbox"
      name={name}
      label={label}
      options={options}
      hint={hint}
      required={required}
      inline={inline}
      className={className}
    />
  );
}

/** 1 つだけ選べるラジオ群。 */
export function RadioGroup(props: GroupProps) {
  return <Choices kind="radio" {...props} />;
}

function Choices({
  kind,
  name,
  label,
  options,
  hint,
  required,
  inline,
  className,
}: GroupProps & { kind: "checkbox" | "radio" }) {
  const f = useFieldState(name, { hint });

  return (
    /* fieldset + legend が無いと、スクリーンリーダーが
       「何についての選択肢か」を読めません。div + label では代用できません。 */
    <fieldset
      className={cn("min-w-0 border-0 p-0", className)}
      aria-describedby={f.describedBy}
      aria-invalid={f.error ? true : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-label="必須">
            *
          </span>
        )}
      </legend>

      {kind === "checkbox" && (
        <input type="hidden" name={name} value={CHECKBOX_ABSENT} />
      )}

      <div
        className={cn(
          "flex",
          inline ? "flex-wrap gap-x-lg gap-y-2xs" : "flex-col",
        )}
      >
        {options.map((o) => {
          const id = `${f.id}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 text-sm",
                o.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                id={id}
                name={name}
                type={kind}
                value={o.value}
                disabled={o.disabled || f.disabled}
                onChange={f.clear}
                className="size-5 shrink-0 accent-primary"
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>

      {hint && !f.error && (
        <p id={`${f.id}-hint`} className="mt-1 text-xs text-muted-fg">
          {hint}
        </p>
      )}
      {f.error && (
        <p
          id={`${f.id}-error`}
          role="alert"
          className="mt-1 text-xs text-danger"
        >
          {f.error}
        </p>
      )}
    </fieldset>
  );
}

/* ================================================================
 * DateField
 * ============================================================== */

export interface DateFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  name: string;
  label: string;
  hint?: string;
  /** date / time / datetime-local / month。既定 date。 */
  kind?: "date" | "time" | "datetime-local" | "month";
}

/**
 * 日付・時刻の入力。
 *
 * **自前のカレンダーは作りません。** ブラウザ標準を使います。
 * 見た目の差は出ますが、自前だと日本語入力・キーボード操作・
 * タイムゾーンの扱いで部品 1 個ぶんの規模になります。
 */
export function DateField({
  name,
  label,
  hint,
  kind = "date",
  required,
  className,
  ...props
}: DateFieldProps) {
  const f = useFieldState(name, { hint });

  return (
    <FieldShell
      id={f.id}
      label={label}
      required={required}
      hint={hint}
      error={f.error}
    >
      <input
        id={f.id}
        name={name}
        type={kind}
        required={required}
        aria-invalid={f.error ? true : undefined}
        aria-describedby={f.describedBy}
        disabled={f.disabled}
        onInput={f.clear}
        className={inputClass({ error: f.error, className })}
        {...props}
      />
    </FieldShell>
  );
}
