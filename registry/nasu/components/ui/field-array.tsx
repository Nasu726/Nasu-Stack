"use client";

import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { useFieldState } from "@/components/ui/async-form";
import { cn } from "@/lib/utils";

const FOCUSABLE = [
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  '[href]:not([aria-disabled="true"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface InternalItem<T> {
  key: string;
  defaultValue: T;
}

/** render prop に渡す、現在の行の識別と name。 */
export interface FieldArrayItem<T> {
  /** React state や database ID とは別の、UI 内だけで安定する key。 */
  key: string;
  /** 現在の index。行を削除すると詰め直されます。 */
  index: number;
  /** `members.0` のような、子 control に使う name の根。 */
  name: string;
  /** この行を作った時点の値。uncontrolled input の defaultValue に使います。 */
  defaultValue: T;
}

/**
 * FieldArray を使わず自分で行を描画するときも、同じ nested path を作れます。
 * component から 1 段下へ降りるための小さな escape hatch です。
 */
export function fieldArrayItemName(name: string, index: number): string {
  return `${name}.${index}`;
}

export interface FieldArrayProps<T>
  extends Omit<
    React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
    "name" | "children"
  > {
  /** FormData / validation field path の根。例: `members`。 */
  name: string;
  /** fieldset の legend。 */
  label: React.ReactNode;
  hint?: string;
  /** 初回と native form reset 後に戻る行。現在の min 未満なら不足行を補います。 */
  defaultItems?: readonly T[];
  /** 追加する 1 行の初期値を返します。 */
  createItem: () => T;
  /** 最低行数。既定 0。 */
  min?: number;
  /** 最大行数。既定は上限なし。 */
  max?: number;
  /** 追加 button の visible / accessible name。 */
  addLabel: string;
  /** 各削除 button の visible / accessible name。index を含めてください。 */
  removeLabel: (item: FieldArrayItem<T>) => string;
  /** 0 行のときに表示する案内。 */
  emptyMessage: React.ReactNode;
  /** 各行の中身。子 control の name は `item.name` から作ります。 */
  children: (item: FieldArrayItem<T>) => React.ReactNode;
  /** 行 wrapper の見た目を変える escape hatch。 */
  itemClassName?: string;
}

function assertBounds(min: number, max: number) {
  if (!Number.isSafeInteger(min) || min < 0) {
    throw new RangeError("FieldArray min must be a non-negative integer");
  }
  if (max !== Infinity && (!Number.isSafeInteger(max) || max < 0)) {
    throw new RangeError("FieldArray max must be a non-negative integer");
  }
  if (max < min) {
    throw new RangeError("FieldArray max must be greater than or equal to min");
  }
}

/**
 * 繰り返し入力の UI identity / name / min-max / focus だけを引き受けます。
 *
 * - 行を消しても、残った input の DOM と入力値は stable key で保ちます
 * - 追加後は新しい行の最初の control、削除後は隣の行へ focus します
 * - 構造変更時は、index が変わる前の nested field error を消します
 * - reorder、database ID、配列の正しさ、server validation は扱いません
 */
export function FieldArray<T>({
  name,
  label,
  hint,
  defaultItems = [],
  createItem,
  min = 0,
  max = Infinity,
  addLabel,
  removeLabel,
  emptyMessage,
  children,
  itemClassName,
  className,
  disabled: disabledProp,
  "aria-describedby": describedByProp,
  ...fieldsetProps
}: FieldArrayProps<T>) {
  assertBounds(min, max);
  if (!name.trim() || name.endsWith(".")) {
    throw new TypeError("FieldArray name must be a non-empty field path");
  }
  if (defaultItems.length > max) {
    throw new RangeError("FieldArray defaultItems cannot exceed max");
  }

  const idPrefix = React.useId();
  const nextKey = React.useRef(0);
  const initialItems = React.useRef<InternalItem<T>[] | null>(null);
  if (initialItems.current === null) {
    const values = [...defaultItems];
    while (values.length < min) values.push(createItem());
    initialItems.current = values.map((defaultValue) => ({
      key: `${idPrefix}-${nextKey.current++}`,
      defaultValue,
    }));
  }

  const [items, setItems] = React.useState<InternalItem<T>[]>(
    initialItems.current,
  );
  // React の再描画前に複数回押されても、直前の add/remove を見て判定します。
  // state だけを見ると、max 直前の double click が 2 行追加しようとします。
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const [announcement, setAnnouncement] = React.useState("");
  const field = useFieldState(name, { hint });
  const rootRef = React.useRef<HTMLFieldSetElement>(null);
  const addRef = React.useRef<HTMLButtonElement>(null);
  const rowRefs = React.useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = React.useRef<
    { kind: "item"; key: string } | { kind: "add" } | null
  >(null);

  const disabled = disabledProp || field.disabled;
  const canAdd = !disabled && items.length < max;
  const canRemove = !disabled && items.length > min;

  // min が増えた場合だけ不足行を補います。max を下げても入力済み data は捨てません。
  React.useEffect(() => {
    setItems((current) => {
      if (current.length >= min) return current;
      const next = [...current];
      while (next.length < min) {
        next.push({
          key: `${idPrefix}-${nextKey.current++}`,
          defaultValue: createItem(),
        });
      }
      itemsRef.current = next;
      return next;
    });
  }, [createItem, idPrefix, min]);

  // AsyncForm の programmatic reset と native reset button の両方へ追従します。
  React.useEffect(() => {
    const form = rootRef.current?.form;
    if (!form) return;
    const reset = () => {
      pendingFocus.current = null;
      const resetItems = [...(initialItems.current ?? [])];
      while (resetItems.length < min) {
        resetItems.push({
          key: `${idPrefix}-${nextKey.current++}`,
          defaultValue: createItem(),
        });
      }
      itemsRef.current = resetItems;
      setItems(resetItems);
      field.clearTree();
      setAnnouncement("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [createItem, field.clearTree, idPrefix, min]);

  // state 更新後の DOM を対象にするため effect で focus します。
  React.useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    pendingFocus.current = null;
    if (request.kind === "item") {
      const target = rowRefs.current
        .get(request.key)
        ?.querySelector<HTMLElement>(FOCUSABLE);
      if (target) {
        target.focus();
        return;
      }
    }
    addRef.current?.focus();
  }, [items]);

  const add = () => {
    const current = itemsRef.current;
    if (disabled || current.length >= max) return;
    const next: InternalItem<T> = {
      key: `${idPrefix}-${nextKey.current++}`,
      defaultValue: createItem(),
    };
    pendingFocus.current = { kind: "item", key: next.key };
    const nextItems = [...current, next];
    itemsRef.current = nextItems;
    setItems(nextItems);
    field.clearTree();
    setAnnouncement(addLabel);
  };

  const remove = (item: FieldArrayItem<T>) => {
    const current = itemsRef.current;
    if (disabled || current.length <= min) return;
    const currentIndex = current.findIndex((entry) => entry.key === item.key);
    if (currentIndex < 0) return;
    const nextItem = current[currentIndex + 1] ?? current[currentIndex - 1];
    pendingFocus.current = nextItem
      ? { kind: "item", key: nextItem.key }
      : { kind: "add" };
    const nextItems = current.filter((entry) => entry.key !== item.key);
    itemsRef.current = nextItems;
    setItems(nextItems);
    field.clearTree();
    setAnnouncement(removeLabel(item));
  };

  const describedBy =
    [describedByProp, field.describedBy].filter(Boolean).join(" ") ||
    undefined;

  return (
    <fieldset
      {...fieldsetProps}
      ref={rootRef}
      disabled={disabled}
      aria-invalid={field.error ? true : undefined}
      aria-describedby={describedBy}
      className={cn("min-w-0 border-0 p-0", className)}
      data-field-array={name}
    >
      <legend className="mb-xs text-sm font-medium">{label}</legend>

      <div className="flex min-w-0 flex-col gap-sm">
        {items.map((entry, index) => {
          const item: FieldArrayItem<T> = {
            key: entry.key,
            index,
            name: fieldArrayItemName(name, index),
            defaultValue: entry.defaultValue,
          };
          const removeText = removeLabel(item);
          return (
            <div
              key={entry.key}
              ref={(node) => {
                if (node) rowRefs.current.set(entry.key, node);
                else rowRefs.current.delete(entry.key);
              }}
              className={cn(
                "flex min-w-0 flex-col gap-sm rounded-md border border-border p-sm",
                itemClassName,
              )}
              data-field-array-item={item.name}
              data-field-array-key={entry.key}
            >
              <div className="min-w-0">{children(item)}</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canRemove}
                onClick={() => remove(item)}
                className="self-start"
                data-field-array-remove={item.name}
              >
                {removeText}
              </Button>
            </div>
          );
        })}

        {items.length === 0 && (
          <p
            className="rounded-md border border-dashed border-border p-sm text-sm text-muted-fg"
            data-field-array-empty={name}
          >
            {emptyMessage}
          </p>
        )}
      </div>

      {hint && !field.error && (
        <p id={`${field.id}-hint`} className="mt-xs text-xs text-muted-fg">
          {hint}
        </p>
      )}
      {field.error && (
        <p
          id={`${field.id}-error`}
          role="alert"
          className="mt-xs text-xs text-danger"
        >
          {field.error}
        </p>
      )}

      <Button
        ref={addRef}
        type="button"
        size="sm"
        variant="secondary"
        disabled={!canAdd}
        onClick={add}
        className="mt-sm"
        data-field-array-add={name}
      >
        {addLabel}
      </Button>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </fieldset>
  );
}
