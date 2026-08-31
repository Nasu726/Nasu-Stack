"use client";

import * as React from "react";

export type CopyStatus = "idle" | "copying" | "success" | "error";
export type CopyMethod = "clipboard" | "fallback";
export type CopyErrorCode = "CLIPBOARD_UNAVAILABLE" | "COPY_FAILED";

export class CopyError extends Error {
  readonly code: CopyErrorCode;

  constructor(code: CopyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CopyError";
    this.code = code;
  }
}

export interface UseCopyOptions {
  /** success表示をidleへ戻すまで。既定2000ms。nullなら自動で戻しません。 */
  resetAfter?: number | null;
  onSuccess?: (method: CopyMethod) => void | Promise<void>;
  onError?: (error: CopyError) => void | Promise<void>;
}

export interface UseCopyResult {
  status: CopyStatus;
  method: CopyMethod | undefined;
  error: CopyError | undefined;
  isCopying: boolean;
  isSuccess: boolean;
  isError: boolean;
  /** コピーを試し、成功ならtrueを返します。実行中の再入はfalseです。 */
  copy: (text: string) => Promise<boolean>;
  /** copying中は何もせず、それ以外の表示状態をidleへ戻します。 */
  reset: () => void;
}

function restoreSelection(
  active: HTMLElement | null,
  ranges: Range[],
) {
  const selection = document.getSelection();
  selection?.removeAllRanges();
  for (const range of ranges) selection?.addRange(range);
  active?.focus({ preventScroll: true });
}

/** Clipboard APIが無いbrowser向け。temporary textareaは必ず片付けます。 */
function fallbackCopyText(text: string) {
  if (typeof document === "undefined" || !document.body) return false;

  const active =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.setAttribute("aria-hidden", "true");
  Object.assign(textarea.style, {
    position: "fixed",
    inset: "0 auto auto -9999px",
    opacity: "0",
  });

  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return typeof document.execCommand === "function" &&
      document.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
    restoreSelection(active, ranges);
  }
}

/**
 * Clipboard APIを優先し、利用できない・拒否された場合だけlegacy fallbackを試します。
 * 非Reactの処理でも使える、copy stateより1段下のsupported pathです。
 */
export async function copyText(text: string): Promise<CopyMethod> {
  const clipboard =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  let clipboardError: unknown;

  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return "clipboard";
    } catch (error) {
      clipboardError = error;
    }
  }

  if (fallbackCopyText(text)) return "fallback";

  const unavailable = !clipboard || typeof clipboard.writeText !== "function";
  throw new CopyError(
    unavailable ? "CLIPBOARD_UNAVAILABLE" : "COPY_FAILED",
    unavailable
      ? "Clipboard API is unavailable and the fallback could not copy"
      : "The browser refused to copy the text",
    { cause: clipboardError },
  );
}

function assertResetAfter(value: number | null) {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new RangeError(
      "useCopy resetAfter must be null or a non-negative finite number",
    );
  }
}

function callSafely(callback: (() => void | Promise<void>) | undefined) {
  if (!callback) return;
  try {
    void Promise.resolve(callback()).catch((error) => {
      console.error("[useCopy] callback failed", error);
    });
  } catch (error) {
    console.error("[useCopy] callback failed", error);
  }
}

/** copy中・成功・失敗・reset timerだけを持つ、小さなclipboard hook。 */
export function useCopy(options: UseCopyOptions = {}): UseCopyResult {
  const resetAfter = options.resetAfter === undefined ? 2000 : options.resetAfter;
  assertResetAfter(resetAfter);

  const [state, setState] = React.useState<{
    status: CopyStatus;
    method: CopyMethod | undefined;
    error: CopyError | undefined;
  }>({ status: "idle", method: undefined, error: undefined });
  const mountedRef = React.useRef(true);
  const busyRef = React.useRef(false);
  const generationRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const reset = React.useCallback(() => {
    // Clipboard writeはabortできません。copyingをidleに見せて次のwriteを
    // 重ねると、どちらの文字が最後に残るか分からなくなります。
    if (busyRef.current) return;
    generationRef.current += 1;
    clearTimer();
    if (mountedRef.current) {
      setState({ status: "idle", method: undefined, error: undefined });
    }
  }, [clearTimer]);

  const copy = React.useCallback(
    async (text: string) => {
      // Reactの再描画より先に閉じます。同じbrowser task内の連打も1回です。
      if (busyRef.current) return false;
      busyRef.current = true;
      clearTimer();
      const generation = ++generationRef.current;
      if (mountedRef.current) {
        setState({ status: "copying", method: undefined, error: undefined });
      }

      try {
        const method = await copyText(text);
        if (!mountedRef.current || generation !== generationRef.current) {
          return true;
        }
        busyRef.current = false;
        setState({ status: "success", method, error: undefined });
        if (resetAfter !== null) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (
              mountedRef.current &&
              generation === generationRef.current &&
              !busyRef.current
            ) {
              generationRef.current += 1;
              setState({
                status: "idle",
                method: undefined,
                error: undefined,
              });
            }
          }, resetAfter);
        }
        callSafely(() => optionsRef.current.onSuccess?.(method));
        return true;
      } catch (raw) {
        const error =
          raw instanceof CopyError
            ? raw
            : new CopyError("COPY_FAILED", "The text could not be copied", {
                cause: raw,
              });
        if (!mountedRef.current || generation !== generationRef.current) {
          return false;
        }
        busyRef.current = false;
        setState({ status: "error", method: undefined, error });
        callSafely(() => optionsRef.current.onError?.(error));
        return false;
      } finally {
        // unmount後もrefだけは解放し、保持しているclosureを増やしません。
        if (generation === generationRef.current) busyRef.current = false;
      }
    },
    [clearTimer, resetAfter],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      busyRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return {
    ...state,
    isCopying: state.status === "copying",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    copy,
    reset,
  };
}
