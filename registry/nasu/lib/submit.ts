import {
  type Action,
  type ActionContext,
  ActionError,
  jsonRequest,
} from "@/lib/action";

/**
 * submit.ts — フォームの送信先へ繋ぐ
 * ================================================================
 * 「で、どこに送るの？」への答えです。
 *
 * ```tsx
 * const submit = createSubmit({ url: "https://api.example.com/contact" });
 *
 * <AsyncForm action={submit} submitLabel="送信する">
 *   <Field name="name" label="お名前" required />
 *   <HoneypotField />
 * </AsyncForm>
 * ```
 *
 * ----------------------------------------------------------------
 * `{ url: "…" }`（ActionSpec）と何が違うのか
 * ----------------------------------------------------------------
 * `ActionSpec` は「JSON を POST する」だけです。公開されたフォームでは、
 * それだけだと次の 5 つに必ずぶつかります。
 *
 *   1. 応答が返らない相手 → 永久に「送信中…」のまま
 *   2. 通信できない → `Failed to fetch` という英語が画面に出る
 *   3. 別ドメインへ送る → CORS。しかも JavaScript からは通信断と区別できない
 *   4. 検証エラーの形が API ごとに違う（errors / fields / message）
 *   5. bot に見つかる。公開フォームは数日で見つかります
 *
 * ここはその 5 つだけを引き受けます。**送信そのものは fetch のままです。**
 */

export interface SubmitOptions<TInput> {
  /** 送信先。 */
  url: string;
  method?: "POST" | "PUT" | "PATCH";
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
  /**
   * 応答が返るまでの上限 (ms)。既定 15000。
   * 0 にすると待ち続けます（推奨しません）。
   */
  timeout?: number;
  /**
   * bot 用のおとりの欄の名前。`HoneypotField` の既定と揃えてください。
   * この欄に値が入っていたら**送信せず、成功したように見せます**。
   */
  honeypot?: string | false;
  /** 送る直前に中身を作り替えます。 */
  transform?: (input: TInput) => unknown;
}

/** 既定のおとりの欄の名前。`HoneypotField` と `createSubmit` で共有します。 */
export const HONEYPOT_NAME = "wt_company_url";

export function createSubmit<TInput = unknown, TOutput = unknown>({
  url,
  method = "POST",
  headers,
  timeout = 15000,
  honeypot = HONEYPOT_NAME,
  transform,
}: SubmitOptions<TInput>): Action<TInput, TOutput> {
  return async (input: TInput, ctx: ActionContext): Promise<TOutput> => {
    /* --- おとりの欄 --------------------------------------------
       値が入っているのは、人ではなく自動入力です。
       **エラーを返してはいけません。** 弾かれたと分かると学習されます。
       何も送らずに、成功したように見せます。 */
    let payload: unknown = input;
    if (honeypot && input && typeof input === "object") {
      const rec = input as Record<string, unknown>;
      const trap = rec[honeypot];
      if (typeof trap === "string" && trap.trim() !== "") {
        return undefined as TOutput;
      }
      // おとりの欄は送信先に届けません（余計なキーになります）
      if (honeypot in rec) {
        const { [honeypot]: _drop, ...rest } = rec;
        payload = rest;
      }
    }
    if (transform) payload = transform(payload as TInput);

    /* --- 中断の合成 --------------------------------------------
       `AbortSignal.any` は比較的新しい API なので、手で合成します
       （古い環境でも同じように動かすため）。
       ここで大事なのは**中断の理由を分けて持つこと**です。
       アンマウントによる中断は「何も出さない」、
       タイムアウトは「時間がかかりすぎました」と出したいので、
       同じ AbortError でも区別が必要になります。 */
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onOuterAbort = () => controller.abort();
    if (ctx.signal.aborted) controller.abort();
    else ctx.signal.addEventListener("abort", onOuterAbort, { once: true });

    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }

    try {
      const result = await jsonRequest<TOutput>(url, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload ?? {}),
        ctx: { signal: controller.signal },
      });
      return result;
    } catch (raw) {
      throw translate(raw, { timedOut, outerAborted: ctx.signal.aborted, url });
    } finally {
      if (timer) clearTimeout(timer);
      ctx.signal.removeEventListener("abort", onOuterAbort);
    }
  };
}

/**
 * 失敗を、利用者が次にやることの分かる日本語に直します。
 *
 * **嘘の断定をしないのが要点です。** たとえば CORS の失敗は、
 * JavaScript からは通信断と区別が付きません（ブラウザは理由を教えません）。
 * 「サーバーが落ちています」と言い切ると、送信先の設定ミスだったときに
 * 利用者を間違った方向へ送ります。両方を含む言い方にします。
 */
function translate(
  raw: unknown,
  info: { timedOut: boolean; outerAborted: boolean; url: string },
): ActionError {
  if (raw instanceof ActionError) {
    // 422 などの検証エラー。errors / fields のどちらの形でも拾います。
    const fields = normalizeFields(raw);
    if (fields) {
      return new ActionError(raw.message, {
        displayMessage: raw.displayMessage || "入力内容を確認してください",
        code: raw.code,
        fields,
        cause: raw.cause,
      });
    }
    return raw;
  }

  const err = raw as Error & { name?: string };

  if (err?.name === "AbortError") {
    if (info.timedOut) {
      return new ActionError("timeout", {
        displayMessage:
          "時間内に応答がありませんでした。通信状況を確かめて、もう一度お試しください。",
        code: "TIMEOUT",
        cause: raw,
      });
    }
    // 画面から消えたことによる中断。利用者には何も起きていません。
    return new ActionError("aborted", {
      displayMessage: "処理を中断しました",
      code: "ABORTED",
      cause: raw,
    });
  }

  // fetch がネットワーク層で失敗すると TypeError になります。
  // 通信断・DNS・CORS のどれかですが、**区別できません。**
  if (err instanceof TypeError) {
    return new ActionError(err.message, {
      displayMessage:
        "送信先に接続できませんでした。通信状況か、送信先の設定（CORS の許可）を確認してください。",
      code: "NETWORK",
      cause: { message: err.message, url: info.url },
    });
  }

  return new ActionError(err?.message ?? "unknown", {
    displayMessage: "送信に失敗しました。しばらくしてからもう一度お試しください。",
    cause: raw,
  });
}

/**
 * 検証エラーの形を揃えます。
 * API ごとに `fields` だったり `errors` だったりするので、ここで吸収します。
 */
function normalizeFields(error: ActionError): Record<string, string> | undefined {
  if (error.fields && Object.keys(error.fields).length > 0) return error.fields;

  const body = error.cause as Record<string, unknown> | undefined;
  const errors = body?.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
      // 値が配列（["必須です"]）で返る API もあります
      out[k] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
    }
    if (Object.keys(out).length > 0) return out;
  }
  return undefined;
}
