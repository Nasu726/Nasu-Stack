"use client";

import * as React from "react";
import type { ActionError } from "@/lib/action";
import { ActionDefaultsContext } from "@/lib/action-defaults";
import { ToastProvider, useToast } from "@/components/ui/toast";

/**
 * ActionProvider — 「書かなかったときの受け皿」
 * ================================================================
 * これが無くても全部そのまま動きます。あると次が変わります。
 *
 *   【無いとき】
 *     失敗しても、そのボタン／フォームの中にだけ小さく赤字が出る。
 *     画面外で起きた失敗（スクロールで見えていない部分など）は
 *     利用者に気づかれない。
 *
 *   【あるとき】
 *     onError を書かなかったアクションが失敗すると、
 *     画面隅に通知が出て、必ず気づける。
 *
 * つまり「エラー処理を書き忘れても、握り潰されない」ための安全網です。
 * 初心者が一番やりがちな `catch {}` の握り潰しを、構造的に防ぎます。
 *
 * 使い方はアプリの一番外側に 1 回置くだけです。
 *
 * ```tsx
 * <ActionProvider>
 *   <App />
 * </ActionProvider>
 * ```
 *
 * 個別に onError を書いた箇所は、そちらが優先されます（通知は出ません）。
 */
export interface ActionProviderProps {
  children: React.ReactNode;
  /** 失敗時に画面隅の通知を出すか。既定 true。 */
  toastOnError?: boolean;
  /** 成功時にも通知を出すか。既定 false（うるさいので）。 */
  toastOnSuccess?: boolean;
  /** 通知の表示位置。 */
  position?: React.ComponentProps<typeof ToastProvider>["position"];
  /** 全アクション共通のリトライ回数。 */
  retry?: number;
  /** 成功表示を idle へ戻すまでの ms。 */
  resetAfter?: number;
  /**
   * 通知の代わりに独自処理をしたいとき（Sentry へ送る等）。
   * これを渡すと toastOnError は無視されます。
   */
  onError?: (error: ActionError) => void;
}

export function ActionProvider({
  children,
  toastOnError = true,
  toastOnSuccess = false,
  position = "bottom-right",
  retry,
  resetAfter,
  onError,
}: ActionProviderProps) {
  return (
    <ToastProvider position={position}>
      <DefaultsBridge
        toastOnError={toastOnError}
        toastOnSuccess={toastOnSuccess}
        retry={retry}
        resetAfter={resetAfter}
        onError={onError}
      >
        {children}
      </DefaultsBridge>
    </ToastProvider>
  );
}

/**
 * ToastProvider の内側でないと useToast が呼べないため、
 * 既定値の組み立てを 1 枚内側に分けています。
 */
function DefaultsBridge({
  children,
  toastOnError,
  toastOnSuccess,
  retry,
  resetAfter,
  onError,
}: {
  children: React.ReactNode;
  toastOnError: boolean;
  toastOnSuccess: boolean;
  retry?: number;
  resetAfter?: number;
  onError?: (error: ActionError) => void;
}) {
  const toast = useToast();

  const defaults = React.useMemo(
    () => ({
      retry,
      resetAfter,
      onError: onError
        ? onError
        : toastOnError
          ? (error: ActionError) => {
              // 中断はユーザー起因なので通知しない
              if (error.code === "ABORTED") return;
              toast.show({
                tone: "danger",
                title: error.displayMessage,
                description:
                  error.code !== undefined ? `コード: ${error.code}` : undefined,
              });
            }
          : undefined,
      onSuccess: toastOnSuccess
        ? () => toast.show({ tone: "success", title: "完了しました" })
        : undefined,
    }),
    [toast, toastOnError, toastOnSuccess, retry, resetAfter, onError],
  );

  return (
    <ActionDefaultsContext.Provider value={defaults}>
      {children}
    </ActionDefaultsContext.Provider>
  );
}

export { useToast } from "@/components/ui/toast";
