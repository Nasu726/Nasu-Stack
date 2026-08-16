"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon } from "@/components/ui/spinner";
import { Stack, Inline } from "@/components/ui/layout";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  tone?: ToastTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 自動で閉じるまでの ms。0 で閉じません。既定 5000（danger は 8000）。 */
  duration?: number;
  /** 右側に置くボタン（「再試行」など）。 */
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/**
 * 画面の隅に通知を出す仕組み。
 * 直接使うことは少なく、ふつうは ActionProvider 経由で自動的に使われます。
 */
export function ToastProvider({
  children,
  /** 表示位置。既定 bottom-right。 */
  position = "bottom-right",
  /** 同時に出す最大数。既定 4。 */
  max = 4,
}: {
  children: React.ReactNode;
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  max?: number;
}) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const show = React.useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const tone = options.tone ?? "info";
      const duration =
        options.duration ?? (tone === "danger" ? 8000 : 5000);

      setItems((prev) => {
        const next = [...prev, { ...options, tone, id }];
        // 古いものから溢れさせる
        return next.length > max ? next.slice(next.length - max) : next;
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss, max],
  );

  const clear = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setItems([]);
  }, []);

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const api = React.useMemo(
    () => ({ show, dismiss, clear }),
    [show, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} position={position} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * 通知を出す関数を取得します。
 *
 * ```tsx
 * const toast = useToast();
 * toast.show({ tone: "success", title: "保存しました" });
 * ```
 */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast は <ToastProvider>（または <ActionProvider>）の内側で呼んでください",
    );
  }
  return ctx;
}

/* ---------------------------------------------------------------- */

const POSITION = {
  "top-right": "top-0 right-0 items-end",
  "top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-0 right-0 items-end",
  "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
} as const;

const TONE = {
  info: "border-border bg-card text-card-fg",
  success: "border-success/40 bg-card text-card-fg",
  warning: "border-warning/50 bg-card text-card-fg",
  danger: "border-danger/40 bg-card text-card-fg",
} as const;

const ICON_TONE = {
  info: "text-muted-fg",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

function ToastViewport({
  items,
  position,
  onDismiss,
}: {
  items: ToastItem[];
  position: keyof typeof POSITION;
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex w-full max-w-sm flex-col p-md",
        POSITION[position],
      )}
    >
      <Stack space="xs" className="w-full">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </Stack>
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const tone = item.tone ?? "info";
  const assertive = tone === "danger";

  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto w-full rounded-lg border p-sm shadow-e3",
        "animate-in fade-in slide-in-from-bottom-2",
        TONE[tone],
      )}
    >
      <Inline space="xs" alignY="start" wrap={false} className="w-full">
        <span className={cn("mt-0.5 shrink-0", ICON_TONE[tone])}>
          {tone === "success" ? <CheckIcon /> : <AlertIcon />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          {item.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-fg">
              {item.description}
            </p>
          )}
        </div>

        {item.action && (
          <button
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
          >
            {item.action.label}
          </button>
        )}

        <button
          onClick={() => onDismiss(item.id)}
          aria-label="通知を閉じる"
          className="shrink-0 rounded-sm p-1 text-muted-fg hover:bg-muted hover:text-fg"
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
    </div>
  );
}
