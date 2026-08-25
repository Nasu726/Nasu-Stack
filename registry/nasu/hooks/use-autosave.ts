"use client";

import * as React from "react";
import {
  type Action,
  type ActionError,
  callSafely,
  toActionError,
} from "@/lib/action";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseAutosaveOptions<TInput, TOutput> {
  /** 最後の schedule から保存開始まで。既定 800ms。 */
  delay?: number;
  /** 最新値の保存が成功したときだけ呼びます。 */
  onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>;
  /** 最新値の保存が失敗したときだけ呼びます。 */
  onError?: (error: ActionError, input: TInput) => void | Promise<void>;
}

export interface UseAutosaveResult<TInput, TOutput> {
  status: AutosaveStatus;
  data: TOutput | undefined;
  error: ActionError | undefined;
  /** 未保存の最新値があるか。saving と同時に true にもなります。 */
  isDirty: boolean;
  isSaving: boolean;
  isSaved: boolean;
  isError: boolean;
  /** 値を保存待ちへ入れます。待ち行列には常に最新の 1 件だけ残ります。 */
  schedule: (input: TInput) => void;
  /** debounce を待たず、現在の最新値を保存可能にします。 */
  flush: () => void;
  /** 最新値の失敗を、debounce なしで再試行します。 */
  retry: () => void;
  /** 未保存値を捨て、進行中の要求へ abort を通知します。server の取消ではありません。 */
  cancel: () => void;
  /** cancel に加えて、成功値と error も消して idle へ戻します。 */
  reset: () => void;
}

interface Latest<TInput> {
  generation: number;
  input: TInput;
  ready: boolean;
  failed: boolean;
}

interface Active {
  generation: number;
  controller: AbortController;
  cancelled: boolean;
}

interface AutosaveState<TOutput> {
  status: AutosaveStatus;
  data: TOutput | undefined;
  error: ActionError | undefined;
  dirty: boolean;
}

function assertDelay(delay: number) {
  if (!Number.isFinite(delay) || delay < 0) {
    throw new RangeError("useAutosave delay must be a non-negative finite number");
  }
}

/**
 * debounce と「進行中 1 件 + 最新の待機値 1 件」だけを持つ autosave queue。
 *
 * 新しい値が来ても進行中の保存は abort しません。終わった後、途中の値を捨てて
 * 最新値だけを次に送ります。response が古ければ state / callback を更新しません。
 * 保存の正当性、version conflict、idempotency、offline 永続化は server / domain 側です。
 */
export function useAutosave<TInput, TOutput = void>(
  save: Action<TInput, TOutput>,
  options: UseAutosaveOptions<TInput, TOutput> = {},
): UseAutosaveResult<TInput, TOutput> {
  const delay = options.delay ?? 800;
  assertDelay(delay);

  const [state, setState] = React.useState<AutosaveState<TOutput>>({
    status: "idle",
    data: undefined,
    error: undefined,
    dirty: false,
  });

  const saveRef = React.useRef(save);
  saveRef.current = save;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  const mountedRef = React.useRef(true);
  const generationRef = React.useRef(0);
  const latestRef = React.useRef<Latest<TInput> | null>(null);
  const activeRef = React.useRef<Active | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSavedRef = React.useRef(false);
  const startReadyRef = React.useRef<() => void>(() => {});

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startReady = React.useCallback(() => {
    const latest = latestRef.current;
    if (!mountedRef.current || activeRef.current || !latest?.ready || latest.failed) {
      return;
    }

    const active: Active = {
      generation: latest.generation,
      controller: new AbortController(),
      cancelled: false,
    };
    activeRef.current = active;
    setState((current) => ({
      ...current,
      status: "saving",
      error: undefined,
      dirty: true,
    }));

    void (async () => {
      try {
        const data = await saveRef.current(latest.input, {
          signal: active.controller.signal,
        });
        if (!mountedRef.current || activeRef.current !== active) return;
        activeRef.current = null;

        const current = latestRef.current;
        if (active.cancelled || current?.generation !== active.generation) {
          if (!active.cancelled && current) {
            setState((previous) => ({
              ...previous,
              status: "dirty",
              error: undefined,
              dirty: true,
            }));
          }
          startReadyRef.current();
          return;
        }

        latestRef.current = null;
        hasSavedRef.current = true;
        setState({ status: "saved", data, error: undefined, dirty: false });
        await callSafely(
          () => optionsRef.current.onSuccess?.(data, latest.input),
          "onSuccess",
        );
      } catch (raw) {
        if (!mountedRef.current || activeRef.current !== active) return;
        activeRef.current = null;

        const current = latestRef.current;
        if (active.cancelled || current?.generation !== active.generation) {
          if (!active.cancelled && current) {
            setState((previous) => ({
              ...previous,
              status: "dirty",
              error: undefined,
              dirty: true,
            }));
          }
          startReadyRef.current();
          return;
        }

        const error = toActionError(raw);
        current.failed = true;
        setState((previous) => ({
          ...previous,
          status: "error",
          error,
          dirty: true,
        }));
        await callSafely(
          () => optionsRef.current.onError?.(error, latest.input),
          "onError",
        );
      }
    })();
  }, []);
  startReadyRef.current = startReady;

  const makeReadyAfterDelay = React.useCallback(
    (generation: number) => {
      clearTimer();
      if (delay === 0) {
        const latest = latestRef.current;
        if (latest?.generation === generation) latest.ready = true;
        startReadyRef.current();
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const latest = latestRef.current;
        if (!latest || latest.generation !== generation) return;
        latest.ready = true;
        startReadyRef.current();
      }, delay);
    },
    [clearTimer, delay],
  );

  const schedule = React.useCallback(
    (input: TInput) => {
      const generation = ++generationRef.current;
      latestRef.current = {
        generation,
        input,
        ready: false,
        failed: false,
      };
      setState((current) => ({
        ...current,
        status: activeRef.current ? "saving" : "dirty",
        error: undefined,
        dirty: true,
      }));
      makeReadyAfterDelay(generation);
    },
    [makeReadyAfterDelay],
  );

  const flush = React.useCallback(() => {
    clearTimer();
    const latest = latestRef.current;
    if (!latest) return;
    latest.ready = true;
    latest.failed = false;
    startReadyRef.current();
  }, [clearTimer]);

  const retry = React.useCallback(() => {
    const latest = latestRef.current;
    if (!latest || !latest.failed) return;
    latest.ready = true;
    latest.failed = false;
    setState((current) => ({
      ...current,
      status: activeRef.current ? "saving" : "dirty",
      error: undefined,
      dirty: true,
    }));
    startReadyRef.current();
  }, []);

  const stop = React.useCallback(
    (clearSaved: boolean) => {
      clearTimer();
      generationRef.current += 1;
      latestRef.current = null;
      if (activeRef.current) {
        activeRef.current.cancelled = true;
        activeRef.current.controller.abort();
      }
      if (clearSaved) hasSavedRef.current = false;
      setState((current) => ({
        status: clearSaved ? "idle" : hasSavedRef.current ? "saved" : "idle",
        data: clearSaved ? undefined : current.data,
        error: undefined,
        dirty: false,
      }));
    },
    [clearTimer],
  );

  const cancel = React.useCallback(() => stop(false), [stop]);
  const reset = React.useCallback(() => stop(true), [stop]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (activeRef.current) {
        activeRef.current.cancelled = true;
        activeRef.current.controller.abort();
      }
    };
  }, [clearTimer]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    isDirty: state.dirty,
    isSaving: state.status === "saving",
    isSaved: state.status === "saved",
    isError: state.status === "error",
    schedule,
    flush,
    retry,
    cancel,
    reset,
  };
}
