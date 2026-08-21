"use client";

import * as React from "react";

export interface UseInteractionGuardResult {
  /** 同じ操作を受け付けない状態なら true。ボタンの disabled などに使います。 */
  isLocked: boolean;
  /**
   * まだ誰も操作を始めていなければ鍵を取り、true を返します。
   * 鍵が取られている間は false を返します。
   *
   * React の再描画を待たず ref を先に更新するため、同じフレームの連打も
   * 2 回目から止まります。
   */
  tryLock: () => boolean;
  /** 鍵を外し、同じ操作をもう一度受け付けます。複数回呼んでも安全です。 */
  release: () => void;
}

/**
 * 同じ画面操作が重なって走ることだけを防ぐ、小さな同期フック。
 *
 * ```tsx
 * const next = useInteractionGuard();
 *
 * function goNext() {
 *   if (!next.tryLock()) return;
 *   router.push("/checkout");
 * }
 *
 * <Button onClick={goNext} disabled={next.isLocked}>次へ</Button>
 * ```
 *
 * 成功・失敗・通信中・retry・中断は管理しません。それらが必要な非同期処理には
 * `useAction` を使ってください。このフックの鍵をいつ外すかは利用側が決めます。
 */
export function useInteractionGuard(): UseInteractionGuardResult {
  const lockedRef = React.useRef(false);
  const [isLocked, setIsLocked] = React.useState(false);

  const tryLock = React.useCallback(() => {
    if (lockedRef.current) return false;

    // state より先に更新します。setState の反映前に次のイベントが来ても、
    // ここだけは同期的に見えるため二重実行を通しません。
    lockedRef.current = true;
    setIsLocked(true);
    return true;
  }, []);

  const release = React.useCallback(() => {
    if (!lockedRef.current) return;
    lockedRef.current = false;
    setIsLocked(false);
  }, []);

  return { isLocked, tryLock, release };
}
