"use client";

import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Inline } from "@/components/ui/layout";

/**
 * ConfirmDialog — 「本当に削除しますか？」
 * ================================================================
 * 土台は `Dialog` です。**同じものを 2 つ実装しません。**
 * フォーカスの閉じ込め・Esc・背面のスクロール停止は、全部そちらの担当です。
 *
 * ここが足しているのは「Promise で答えが返る」という 1 点だけです。
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

  const confirm = React.useCallback<ConfirmFn>((options) => {
    const normalized: ConfirmOptions =
      typeof options === "string" ? { title: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ options: normalized, resolve });
    });
  }, []);

  const settle = React.useCallback(
    (ok: boolean) => {
      // 待っている人を必ず起こします。ここで resolve を忘れると、
      // await している側が永遠に止まります。
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Dialog
        open={pending !== null}
        // Esc も背景クリックも「取り消し」として扱います
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
        title={pending?.options.title}
        description={pending?.options.description}
        size="md"
        footer={
          <Inline space="xs" align="end">
            <Button variant="outline" onClick={() => settle(false)}>
              {pending?.options.cancelLabel ?? "キャンセル"}
            </Button>
            <Button
              variant={pending?.options.tone === "danger" ? "danger" : "primary"}
              autoFocus
              onClick={() => settle(true)}
            >
              {pending?.options.confirmLabel ?? "OK"}
            </Button>
          </Inline>
        }
      />
    </ConfirmContext.Provider>
  );
}
