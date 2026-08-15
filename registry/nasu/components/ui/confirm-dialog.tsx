"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/action-button";
import { Inline, Stack } from "@/components/ui/layout";

/**
 * ConfirmDialog — 「本当に削除しますか？」
 * ================================================================
 * native の `<dialog>` を使っています。自前で作ると必要になる次のものが、
 * 全部ブラウザ任せになるためです。
 *
 *   - フォーカスの閉じ込め（Tab でダイアログの外に出られない）
 *   - 背景の暗転（::backdrop）
 *   - Esc で閉じる
 *   - 他のどの要素より手前に出る（top layer。z-index 戦争が起きない）
 *   - 閉じたあと、元の要素へフォーカスが戻る
 *
 * ```tsx
 * const confirm = useConfirm();
 * const ok = await confirm({
 *   title: "この記事を削除しますか？",
 *   description: "元に戻せません。",
 *   confirmLabel: "削除する",
 *   tone: "danger",
 * });
 * if (!ok) return;
 * ```
 */

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 実行ボタンの文言。既定「OK」。 */
  confirmLabel?: string;
  /** 取り消しボタンの文言。既定「キャンセル」。 */
  cancelLabel?: string;
  /** danger にすると実行ボタンが赤くなります。 */
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * 確認ダイアログを出す関数を返します。
 *
 * **Provider が無くても動きます。** その場合は `window.confirm` に落ちます。
 * 「無くても動く。あると良くなる」を守るためです
 * （ActionProvider と同じ方針）。
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  return React.useMemo<ConfirmFn>(
    () =>
      ctx ??
      // Provider が無いときの受け皿。見た目は素っ気ないが、壊れはしない。
      ((options) =>
        Promise.resolve(
          window.confirm(
            typeof options === "string" ? options : String(options.title),
          ),
        )),
    [ctx],
  );
}

/* ---------------------------------------------------------------- */

interface Pending {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

/**
 * 確認ダイアログの置き場。ふつうは `ActionProvider` が内部で使うので、
 * 直接置く必要はありません。
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    const normalized: ConfirmOptions =
      typeof options === "string" ? { title: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ options: normalized, resolve });
    });
  }, []);

  // pending が立ったらモーダルとして開く
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (pending && !el.open) el.showModal();
    if (!pending && el.open) el.close();
  }, [pending]);

  const settle = React.useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <dialog
        ref={dialogRef}
        // Esc で閉じられたときも「取り消し」として扱う
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
        onClose={() => settle(false)}
        // 背景（::backdrop 部分）のクリックで閉じる。
        // dialog 自身が全面を占めるので、中身の外側かどうかで判定する。
        onClick={(e) => {
          if (e.target === dialogRef.current) settle(false);
        }}
        aria-labelledby="wt-confirm-title"
        className={cn(
          "wt-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border",
          "bg-card p-lg text-card-fg shadow-e3",
        )}
      >
        {pending && (
          <Stack space="md">
            <Stack space="2xs">
              <h2 id="wt-confirm-title" className="text-base font-semibold">
                {pending.options.title}
              </h2>
              {pending.options.description && (
                <p className="text-sm leading-relaxed text-muted-fg">
                  {pending.options.description}
                </p>
              )}
            </Stack>

            <Inline space="xs" align="end">
              <Button variant="outline" onClick={() => settle(false)}>
                {pending.options.cancelLabel ?? "キャンセル"}
              </Button>
              <Button
                variant={pending.options.tone === "danger" ? "danger" : "primary"}
                autoFocus
                onClick={() => settle(true)}
              >
                {pending.options.confirmLabel ?? "OK"}
              </Button>
            </Inline>
          </Stack>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
