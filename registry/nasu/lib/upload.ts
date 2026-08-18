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
    /**
     * 追加のヘッダ。**ブラウザから送られます。**
     *
     * ここに置いた値は、開発者ツール・通信の記録・拡張機能から見えます。
     * `Authorization: Bearer <サービスの鍵>` と書いても**秘密になりません。**
     *
     * サーバ側の鍵が要る相手には、**自分のサーバ（Worker など）を挟んで**
     * そこから呼んでください。鍵はそちらに置きます。
     * 判断表は docs/boundaries.md に。
     */
    headers?: Record<string, string>;
    /** 一緒に送る値。 */
    fields?: Record<string, string>;
    /**
     * 進捗が止まったとみなすまでの ms。既定 60000。0 で切ります。
     *
     * **これが無いと、通信が半端に切れたとき永久に待ちます。**
     * TCP は相手が黙っただけでは切れないので、`error` も `timeout` も
     * 飛んできません。画面は「送信中…」のまま何時間でも止まります。
     *
     * 全体の制限時間（`timeout`）ではなく**進みが止まった時間**で測ります。
     * 大きなファイルを遅い回線で送るのは正常なので、全体の時間で切ると
     * 成功するはずの送信を落とします。
     */
    stallTimeout?: number;
    /**
     * 送信全体の制限時間 (ms)。**既定は 0（無制限）です。**
     *
     * 既定を入れていないのは、上限が「ファイルの大きさ × 回線の速さ」で
     * 決まるためです。こちらが決めた数字は、誰かの正常な送信を落とします。
     * 止まったときの保険は `stallTimeout` が持ちます。
     */
    timeout?: number;
  } = {},
): Promise<TOutput> {
  const {
    fieldName = "file",
    method = "POST",
    headers = {},
    fields = {},
    stallTimeout = 60000,
    timeout = 0,
  } = options;

  return new Promise<TOutput>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append(fieldName, file, file.name);

    xhr.open(method, url, true);
    xhr.timeout = timeout;
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    // 中断の配線。これが無いと、画面を離れてもアップロードが続きます。
    const onAbort = () => xhr.abort();
    if (ctx.signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    ctx.signal.addEventListener("abort", onAbort, { once: true });

    /* 進みが止まったら中断します。**abort と区別する必要があります。**
       止めるために xhr.abort() を呼ぶので、そのままだと
       「利用者が中断した」と同じ扱いになり、画面に何も出ません。 */
    let stalled = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const beat = () => {
      if (!stallTimeout) return;
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, stallTimeout);
    };
    const cleanup = () => {
      clearTimeout(stallTimer);
      ctx.signal.removeEventListener("abort", onAbort);
    };

    xhr.upload.addEventListener("progress", (e) => {
      beat();
      if (e.lengthComputable) ctx.onProgress(e.loaded / e.total);
    });
    // 応答の受け取りでも生きているとみなします
    xhr.addEventListener("progress", beat);

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
        /* 画面に出すのはサーバが**そのつもりで**入れた userMessage だけです。
           理由は lib/action.ts の jsonRequest に書きました。 */
        const userMessage =
          typeof o.userMessage === "string" ? o.userMessage : undefined;
        reject(
          new ActionError(
            typeof o.message === "string" ? o.message : `HTTP ${xhr.status}`,
            {
              displayMessage:
                userMessage ?? `アップロードに失敗しました (${xhr.status})`,
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
      if (stalled) {
        reject(
          new ActionError("stalled", {
            displayMessage:
              "通信が止まりました。回線を確かめて、もう一度お試しください。",
            code: "STALLED",
          }),
        );
        return;
      }
      reject(new DOMException("Aborted", "AbortError"));
    });

    xhr.addEventListener("timeout", () => {
      cleanup();
      reject(
        new ActionError("timeout", { displayMessage: "時間切れになりました" }),
      );
    });

    try {
      beat();
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

/**
 * `accept` に合うファイルか調べます。
 *
 * `<input accept>` と同じ書式（`image/*`、`.pdf`、`text/csv` をカンマ区切り）。
 *
 * **これは守りではありません。** 見ているのは
 *
 *   - 拡張子（ファイル名の末尾。送る側が自由に付け替えられます）
 *   - `File.type`（ブラウザが拡張子から推測した値。中身は見ていません）
 *
 * の 2 つだけです。`virus.exe` を `photo.png` に改名すれば通ります。
 * **受け取るサーバ側で、大きさ・種類・中身の署名を必ず確かめてください。**
 *
 * ここで弾く目的は「間違って選んだ人にその場で伝える」ことです。
 */
export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true;

  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (!rule) return false;
    // ".pdf" のような拡張子
    if (rule.startsWith(".")) return name.endsWith(rule);
    // "image/*" のような部分一致
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    // "text/csv" のような完全一致
    return type === rule;
  });
}
