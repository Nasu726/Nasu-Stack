import { ActionError, type ActionContext, toActionError } from "@/lib/action";

/**
 * アップロードの文脈。中核の `ActionContext`（signal だけ）に、進捗の報告口を足したものです。
 *
 * 中核の契約を変えていないので、既存の部品には一切影響しません。
 */
export interface UploadContext extends ActionContext {
  /** 0〜1 で進捗を報告します。呼ばなくても動きます（その場合は不定形の表示になります）。 */
  onProgress: (ratio: number) => void;
}

export type UploadAction<TOutput = unknown> = (
  file: File,
  ctx: UploadContext,
) => Promise<TOutput>;

/**
 * 進捗つきでファイルを送ります。
 *
 * ```tsx
 * <FileDrop action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)} />
 * ```
 *
 * ----------------------------------------------------------------
 * なぜ fetch ではなく XMLHttpRequest なのか
 * ----------------------------------------------------------------
 * **fetch はアップロードの進捗を取れません。** 2026 年時点でもそうです。
 * リクエストのストリームで測れるのは「ブラウザが自分のストリームから
 * データを引き取った時点」であって、実際に送信された時点ではありません。
 * ブラウザは性能のためにバッファリングするので、進捗の指標になりません。
 *
 * fetch に進捗イベントを足す提案は進行中ですが、まだ使えません。
 * そのため、進捗が要る場面では XHR を使う必要があります。
 * ここで隠しているので、利用者が XHR を書くことはありません。
 */
export function uploadWithProgress<TOutput = unknown>(
  url: string,
  file: File,
  ctx: UploadContext,
  options: {
    /** フォームのフィールド名。既定 "file"。 */
    fieldName?: string;
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    /** 一緒に送る値。 */
    fields?: Record<string, string>;
  } = {},
): Promise<TOutput> {
  const {
    fieldName = "file",
    method = "POST",
    headers = {},
    fields = {},
  } = options;

  return new Promise<TOutput>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append(fieldName, file, file.name);

    xhr.open(method, url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    // 中断の配線。これが無いと、画面を離れてもアップロードが続きます。
    const onAbort = () => xhr.abort();
    if (ctx.signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    ctx.signal.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => ctx.signal.removeEventListener("abort", onAbort);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) ctx.onProgress(e.loaded / e.total);
    });

    xhr.addEventListener("load", () => {
      cleanup();
      const ok = xhr.status >= 200 && xhr.status < 300;
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = xhr.responseText;
      }

      if (!ok) {
        const o = (body ?? {}) as Record<string, unknown>;
        reject(
          new ActionError(
            typeof o.message === "string" ? o.message : `HTTP ${xhr.status}`,
            {
              displayMessage:
                typeof o.message === "string"
                  ? o.message
                  : `アップロードに失敗しました (${xhr.status})`,
              code: xhr.status,
              cause: body,
            },
          ),
        );
        return;
      }
      ctx.onProgress(1);
      resolve(body as TOutput);
    });

    xhr.addEventListener("error", () => {
      cleanup();
      reject(
        new ActionError("network error", {
          displayMessage: "通信に失敗しました",
        }),
      );
    });

    xhr.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    });

    xhr.addEventListener("timeout", () => {
      cleanup();
      reject(
        new ActionError("timeout", { displayMessage: "時間切れになりました" }),
      );
    });

    try {
      xhr.send(form);
    } catch (e) {
      cleanup();
      reject(toActionError(e));
    }
  });
}

/** バイト数を読みやすい文字列にします。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
