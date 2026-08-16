"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Stack } from "@/components/ui/layout";

/**
 * Dialog — モーダルとシート
 * ================================================================
 * native の `<dialog>` を使います。自前で作ると次を全部書く羽目になり、
 * どれか 1 つ抜けると「開けるが閉じられない」「裏のボタンが押せてしまう」
 * のような壊れ方をします。
 *
 *   - フォーカスの閉じ込め（Tab で外に出られない）
 *   - 背面の inert 化（裏の要素が押せない・読み上げられない）
 *   - Esc で閉じる
 *   - 他のどの要素より手前（top layer。z-index 戦争が起きない）
 *   - 閉じたあと、開いた要素へフォーカスが戻る
 *
 * ```tsx
 * const [open, setOpen] = React.useState(false);
 * <Dialog open={open} onOpenChange={setOpen} title="設定">
 *   <p>中身</p>
 * </Dialog>
 * ```
 *
 * ----------------------------------------------------------------
 * ブラウザがやってくれないこと
 * ----------------------------------------------------------------
 * **背面のスクロールは止まりません。** 背面は押せなくなりますが、
 * 指で払うと裏の本文が動きます（スマホで顕著）。ここだけは自分で止めます。
 */

type Placement = "center" | "sheet-right" | "sheet-left" | "sheet-bottom";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 見出し。読み上げの名前にもなります。省略するなら `aria-label` を渡してください。 */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 出方。既定は中央のモーダル。 */
  placement?: Placement;
  /** 中央モーダルの横幅。既定 md。 */
  size?: "sm" | "md" | "lg";
  /** 背景クリックと Esc で閉じられるか。既定 true。 */
  dismissible?: boolean;
  /** 閉じているあいだも中身を DOM に残すか。既定 false。 */
  keepMounted?: boolean;
  children?: React.ReactNode;
  /** 下部に並べる操作。 */
  footer?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

const SIZE: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "w-[min(22rem,calc(100vw-2rem))]",
  md: "w-[min(28rem,calc(100vw-2rem))]",
  lg: "w-[min(40rem,calc(100vw-2rem))]",
};

const PLACEMENT: Record<Placement, string> = {
  center: "m-auto rounded-xl",
  // シートは端に寄せて、画面の高さいっぱいにします。
  // `m-auto` を打ち消さないと中央に戻ってしまうので、個別に指定します。
  "sheet-right": "ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(20rem,85vw)] rounded-none",
  "sheet-left": "mr-auto ml-0 my-0 h-dvh max-h-dvh w-[min(20rem,85vw)] rounded-none",
  "sheet-bottom":
    "mt-auto mb-0 mx-auto w-full max-w-none rounded-b-none rounded-t-xl",
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  placement = "center",
  size = "md",
  dismissible = true,
  keepMounted = false,
  children,
  footer,
  className,
  "aria-label": ariaLabel,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  /* --- 開閉 ------------------------------------------------------
     **`open` 属性を JSX に書いてはいけません。**
     属性で開くと非モーダルになり、top layer にも入らず、
     ::backdrop も出ず、フォーカスも閉じ込められません。
     `showModal()` を呼ぶ必要があります。 */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useScrollLock(open);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Esc。dismissible が false なら閉じさせない。
        if (!dismissible) {
          e.preventDefault();
          return;
        }
        e.preventDefault(); // 既定の close を止めて、状態は親に持たせる
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // 背景（::backdrop）のクリック。dialog 自身が全面を占めるので、
        // 中身の外側を押したかどうかで判定します。
        if (!dismissible) return;
        if (e.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        "wt-dialog border border-border bg-card p-lg text-card-fg shadow-e3",
        PLACEMENT[placement],
        placement === "center" && SIZE[size],
        // シートは中身が長くなるので、その中でスクロールさせます
        placement !== "center" && "overflow-y-auto",
        className,
      )}
    >
      {(open || keepMounted) && (
        <Stack space="md">
          {(title || description) && (
            <Stack space="2xs">
              {title && (
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm leading-relaxed text-muted-fg">
                  {description}
                </p>
              )}
            </Stack>
          )}
          {children}
          {footer}
        </Stack>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------
 * 背面のスクロールを止める
 * ------------------------------------------------------------------
 * `showModal()` は背面を押せなくしますが、**スクロールは止めません。**
 * ダイアログを開いたまま指で払うと裏の本文が動き、閉じたときに
 * 元と違う位置に戻ってしまいます。
 *
 * 入れ子で開くこともあるので、開いている数を数えて、
 * **最後の 1 つが閉じたときだけ**元に戻します。
 * 個々のダイアログが勝手に戻すと、外側がまだ開いているのに解除されます。
 * ---------------------------------------------------------------- */

let lockCount = 0;
let savedOverflow = "";

function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.documentElement.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
