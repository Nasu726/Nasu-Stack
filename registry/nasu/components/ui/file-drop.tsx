"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ActionError, toActionError } from "@/lib/action";
import {
  formatBytes,
  type UploadAction,
  type UploadContext,
  matchesAccept,
} from "@/lib/upload";
import { Button } from "@/components/ui/action-button";
import { AlertIcon, CheckIcon, Spinner } from "@/components/ui/spinner";
import { Box, Inline, Stack } from "@/components/ui/layout";

/**
 * FileDrop — ドラッグ&ドロップ・進捗・失敗した分だけ再送
 * ================================================================
 * ```tsx
 * <FileDrop
 *   action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)}
 *   accept="image/*"
 *   maxSize={5 * 1024 * 1024}
 * />
 * ```
 *
 * 設計の要点:
 *   - **1 ファイルずつ送ります。** まとめて送ると 1 つ失敗しただけで
 *     全部やり直しになるためです。個別に状態を持つので「失敗した分だけ再送」が自然に書けます。
 *   - **本物の `<input type="file">` を必ず置いています。** ドラッグ&ドロップだけにすると
 *     キーボードのみの人が使えなくなります。見た目を差し替えているだけです。
 *   - 進捗は `ctx.onProgress(0..1)` を呼ぶだけ。XHR の詳細は uploadWithProgress が隠します。
 */

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface Item {
  id: number;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: ActionError;
  controller?: AbortController;
}

export interface FileDropProps {
  /** 1 ファイルを送る関数。ctx.onProgress(0..1) を呼ぶと進捗バーが動きます。 */
  action: UploadAction;
  /**
   * `image/*` `.pdf` など。`<input accept>` と同じ書式。
   *
   * **選ぶときも、ドラッグして落としたときも、同じ基準で弾きます。**
   * `<input accept>` は選択画面への助言でしかないので、
   * 落とす経路には効きません（v0.9c まで素通りしていました）。
   *
   * **これは守りではありません。** 名前と、ブラウザが言う種類を見ているだけで、
   * どちらも送る側が自由に決められます。**受け取るサーバ側で、
   * 大きさ・種類・中身の署名を必ず確かめてください。**
   */
  accept?: string;
  /** 1 ファイルの上限サイズ（バイト）。超えたものは送らずに弾きます。 */
  maxSize?: number;
  /** 複数選べるか。既定 true。 */
  multiple?: boolean;
  /** 同時に走らせる本数。既定 3。 */
  concurrency?: number;
  /** 全部成功したときに呼ばれます。 */
  onComplete?: (files: File[]) => void;
  /**
   * 1 件が失敗したときに呼ばれます。
   * 失敗は各行に文言と「再送」で出ているので、既定では通知を出しません。
   * ログ送信などが必要ならここで。
   */
  onError?: (error: ActionError, file: File) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}

export function FileDrop({
  action,
  accept,
  maxSize,
  multiple = true,
  concurrency = 3,
  onComplete,
  onError,
  label = "ファイルをドラッグするか、クリックして選択",
  hint,
  className,
}: FileDropProps) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const nextId = React.useRef(1);

  const actionRef = React.useRef(action);
  actionRef.current = action;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  const runningRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 画面を離れたら、走っている送信を全部止める
      setItems((prev) => {
        prev.forEach((i) => i.controller?.abort());
        return prev;
      });
    };
  }, []);

  const patch = React.useCallback((id: number, next: Partial<Item>) => {
    if (!mountedRef.current) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...next } : i)),
    );
  }, []);

  /** 1 件を送る。 */
  const upload = React.useCallback(
    async (item: Item) => {
      const controller = new AbortController();
      patch(item.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
        controller,
      });

      const ctx: UploadContext = {
        signal: controller.signal,
        onProgress: (ratio) =>
          patch(item.id, { progress: Math.max(0, Math.min(1, ratio)) }),
      };

      try {
        await actionRef.current(item.file, ctx);
        patch(item.id, { status: "done", progress: 1, controller: undefined });
      } catch (raw) {
        if (controller.signal.aborted) {
          patch(item.id, { status: "queued", progress: 0, controller: undefined });
          return;
        }
        const error = toActionError(raw);
        patch(item.id, { status: "error", error, controller: undefined });
        // ここでは ActionProvider の通知へ流しません。
        // 失敗したファイルの行に文言と「再送」を出しているので、
        // 通知も出すと同じ内容が二重に出ます
        // （「画面内に出せているものは通知しない」— v0.2 で決めた規則）。
        onErrorRef.current?.(error, item.file);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch],
  );

  /** queued を concurrency 本まで走らせる。 */
  const pump = React.useCallback(() => {
    setItems((prev) => {
      const queued = prev.filter((i) => i.status === "queued");
      const slots = Math.max(0, concurrency - runningRef.current);
      const start = queued.slice(0, slots);
      if (start.length === 0) return prev;
      runningRef.current += start.length;
      for (const item of start) {
        void upload(item).finally(() => {
          runningRef.current = Math.max(0, runningRef.current - 1);
          // 次の 1 件へ
          setTimeout(pump, 0);
        });
      }
      return prev;
    });
  }, [concurrency, upload]);

  /** 選ばれた／落とされたファイルを積む。 */
  const enqueue = React.useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const accepted: Item[] = [];

      for (const file of list) {
        if (!matchesAccept(file, accept)) {
          accepted.push({
            id: nextId.current++,
            file,
            status: "error",
            progress: 0,
            error: new ActionError("type not allowed", {
              displayMessage: `この種類のファイルは送れません（${accept}）`,
            }),
          });
          continue;
        }
        if (maxSize && file.size > maxSize) {
          accepted.push({
            id: nextId.current++,
            file,
            status: "error",
            progress: 0,
            error: new ActionError("too large", {
              displayMessage: `${formatBytes(maxSize)} を超えています（${formatBytes(file.size)}）`,
            }),
          });
          continue;
        }
        accepted.push({
          id: nextId.current++,
          file,
          status: "queued",
          progress: 0,
        });
      }

      setItems((prev) => (multiple ? [...prev, ...accepted] : accepted));
      setTimeout(pump, 0);
    },
    [accept, maxSize, multiple, pump],
  );

  // 全部終わったら通知
  const doneCount = items.filter((i) => i.status === "done").length;
  React.useEffect(() => {
    if (items.length > 0 && doneCount === items.length) {
      onComplete?.(items.map((i) => i.file));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, items.length]);

  const failed = items.filter((i) => i.status === "error");

  return (
    <Stack space="sm" className={className}>
      {/* 落とす場所。クリックでも開く。 */}
      <Box
        padding="lg"
        radius="lg"
        className={cn(
          "border-2 border-dashed text-center transition-colors",
          dragging
            ? "border-primary bg-accent"
            : "border-input hover:border-primary/60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer?.files?.length) enqueue(e.dataTransfer.files);
        }}
      >
        <Stack space="xs" align="center">
          {/* 本物の input。見た目だけ隠し、label から開けるようにする。
              display:none にするとキーボードで到達できなくなるので sr-only を使う。 */}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="sr-only"
            id={inputId}
            onChange={(e) => {
              if (e.target.files?.length) enqueue(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline"
          >
            {label}
          </label>
          {(hint || maxSize) && (
            <p className="text-xs text-muted-fg">
              {hint ??
                `1 ファイル ${formatBytes(maxSize!)} まで${accept ? ` / ${accept}` : ""}`}
            </p>
          )}
        </Stack>
      </Box>

      {items.length > 0 && (
        <Stack space="2xs">
          {items.map((item) => (
            <FileRow
              key={item.id}
              item={item}
              onRetry={() => {
                patch(item.id, { status: "queued", error: undefined });
                setTimeout(pump, 0);
              }}
              onRemove={() => {
                item.controller?.abort();
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              }}
            />
          ))}
        </Stack>
      )}

      {failed.length > 1 && (
        <Inline space="xs">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setItems((prev) =>
                prev.map((i) =>
                  i.status === "error"
                    ? { ...i, status: "queued", error: undefined }
                    : i,
                ),
              );
              setTimeout(pump, 0);
            }}
          >
            失敗した {failed.length} 件を再送
          </Button>
        </Inline>
      )}
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

function FileRow({
  item,
  onRetry,
  onRemove,
}: {
  item: Item;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const pct = Math.round(item.progress * 100);

  return (
    <Box padding="xs" background="muted" radius="md">
      <Stack space="2xs">
        <Inline space="xs" wrap={false}>
          <span className="shrink-0">
            {item.status === "done" ? (
              <CheckIcon className="text-success" />
            ) : item.status === "error" ? (
              <AlertIcon className="text-danger" />
            ) : item.status === "uploading" ? (
              <Spinner />
            ) : (
              <span className="block size-4" />
            )}
          </span>

          <span className="min-w-0 flex-1 truncate text-sm">
            {item.file.name}
          </span>

          <span className="shrink-0 text-xs text-muted-fg">
            {item.status === "uploading"
              ? `${pct}%`
              : formatBytes(item.file.size)}
          </span>

          {item.status === "error" && (
            <button
              onClick={onRetry}
              className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-card"
            >
              再送
            </button>
          )}

          <button
            onClick={onRemove}
            aria-label={`${item.file.name} を取り消す`}
            className="shrink-0 rounded-sm p-1 text-muted-fg hover:bg-card hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </Inline>

        {item.status === "uploading" && (
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-card"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.file.name} の進捗`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {item.error && (
          <p role="alert" className="text-xs text-danger">
            {item.error.displayMessage}
          </p>
        )}
      </Stack>
    </Box>
  );
}
