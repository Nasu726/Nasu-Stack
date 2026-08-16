/**
 * WebTemplate — 非同期処理の統一契約
 * ---------------------------------------------------------------
 * このファイルがテンプレート全体の「背骨」です。
 *
 * 目的:
 *   利用者が書くのは「何をするか」= 関数ひとつだけ。
 *   「読込中の表示」「失敗したときの表示」「二重送信の防止」
 *   「キャンセル」「リトライ」は全部コンポーネント側が持ちます。
 *
 * 使う側が覚えることは、実質この 1 行だけです:
 *   action: (input) => Promise<output>
 */

/** 実行中のアクションに渡される文脈。中断シグナルを持ちます。 */
export interface ActionContext {
  /**
   * アンマウント時・再実行時に abort されます。
   * fetch に渡しておくと、不要になったリクエストが自動で止まります。
   *   fetch(url, { signal: ctx.signal })
   */
  signal: AbortSignal;
}

/**
 * 「呼び出す関数」の型。これがテンプレート全体で唯一の契約です。
 * 同期関数を渡しても動きます（Promise でなくても構いません）。
 */
export type Action<TInput = void, TOutput = unknown> = (
  input: TInput,
  ctx: ActionContext,
) => Promise<TOutput> | TOutput;

/** 引数を取らないアクションの別名。ボタン用。 */
export type VoidAction<TOutput = unknown> = Action<void, TOutput>;

/** 非同期処理が取りうる 4 状態。これ以外は存在しません。 */
export type AsyncStatus = "idle" | "pending" | "success" | "error";

/** アクションの現在状態。 */
export interface AsyncState<TOutput> {
  status: AsyncStatus;
  data: TOutput | undefined;
  error: ActionError | undefined;
  /** 何回リトライしたか（初回実行は 0）。 */
  attempt: number;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * 正規化されたエラー。
 * throw されたものが文字列でもオブジェクトでも、必ずこの形になります。
 * そのためコンポーネント側は常に `error.message` を表示すれば済みます。
 */
export class ActionError extends Error {
  /** 画面に出してよい日本語メッセージ。 */
  readonly displayMessage: string;
  /** HTTP ステータスなど、あれば。 */
  readonly code?: string | number;
  /** フォームのフィールド単位のエラー（AsyncForm が自動で表示します）。 */
  readonly fields?: Record<string, string>;
  /** 元の値。デバッグ用。 */
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      displayMessage?: string;
      code?: string | number;
      fields?: Record<string, string>;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ActionError";
    this.displayMessage = options.displayMessage ?? message;
    this.code = options.code;
    this.fields = options.fields;
    this.cause = options.cause;
  }
}

/** 中断されたことを示す番兵。状態を error にせず idle に戻すために使います。 */
export const ABORTED = Symbol("webtemplate.aborted");

/**
 * 何が throw されても ActionError に揃えます。
 * 利用者は `throw new Error("メール送信に失敗しました")` と書くだけでよく、
 * `throw "失敗"` のような雑な投げ方をしても壊れません。
 */
export function toActionError(value: unknown): ActionError {
  if (value instanceof ActionError) return value;

  if (value instanceof Error) {
    // fetch の AbortError はユーザー起因ではないので文言を分ける
    if (value.name === "AbortError") {
      return new ActionError("aborted", {
        displayMessage: "処理を中断しました",
        code: "ABORTED",
        cause: value,
      });
    }
    // `Object.assign(new Error(...), { fields })` のような投げ方も拾う
    const extra = value as Error & {
      fields?: Record<string, string>;
      code?: string | number;
    };
    return new ActionError(value.message, {
      displayMessage: value.message || "エラーが発生しました",
      fields:
        extra.fields && typeof extra.fields === "object"
          ? extra.fields
          : undefined,
      code: extra.code,
      cause: value,
    });
  }

  if (typeof value === "string") {
    return new ActionError(value, { displayMessage: value });
  }

  // { message, fields } 形式のオブジェクト（API のエラーレスポンス想定）
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const message =
      typeof o.message === "string" ? o.message : "エラーが発生しました";
    return new ActionError(message, {
      displayMessage: message,
      code:
        typeof o.code === "string" || typeof o.code === "number"
          ? o.code
          : undefined,
      fields:
        o.fields && typeof o.fields === "object"
          ? (o.fields as Record<string, string>)
          : undefined,
      cause: value,
    });
  }

  return new ActionError("Unknown error", {
    displayMessage: "エラーが発生しました",
    cause: value,
  });
}

/* ==================================================================
 * ActionSpec — 「関数」でも「JSON で書ける宣言」でも渡せるようにする
 * ------------------------------------------------------------------
 * なぜ必要か:
 *   Astro の island（client:load）へは、props が JSON 化されて渡ります。
 *   つまり .astro ファイルから関数を直接渡すことはできません。
 *   そこで、シリアライズできる形の「宣言」でも同じことを書けるようにします。
 *
 *   React から:  <ActionButton action={() => api.save(x)} />
 *   Astro から:  <ActionButton client:load action={{ url: "/api/save" }} />
 * ================================================================== */

/** シリアライズ可能なアクション定義。 */
export interface EndpointSpec {
  url: string;
  /** 既定は POST（DataList など読み取り用途では GET を指定）。 */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** 追加ヘッダ。 */
  headers?: Record<string, string>;
  /** 入力に必ず混ぜる固定値。 */
  body?: Record<string, unknown>;
}

/** 関数でも宣言でも受け取れる型。 */
export type ActionSpec<TInput = void, TOutput = unknown> =
  | Action<TInput, TOutput>
  | EndpointSpec;

/** ActionSpec を必ず関数へ正規化します。 */
export function resolveAction<TInput, TOutput>(
  spec: ActionSpec<TInput, TOutput>,
): Action<TInput, TOutput> {
  if (typeof spec === "function") return spec;

  const { url, method = "POST", headers, body } = spec;

  return async (input: TInput, ctx: ActionContext) => {
    if (method === "GET") {
      return jsonRequest<TOutput>(url, { method, headers, ctx });
    }
    const payload =
      input && typeof input === "object"
        ? { ...body, ...(input as Record<string, unknown>) }
        : (body ?? (input as unknown));
    return jsonRequest<TOutput>(url, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
      ctx,
    });
  };
}

/** fetch のラッパ。JSON を返し、失敗時は ActionError に変換します。 */
export async function jsonRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit & { ctx?: ActionContext } = {},
): Promise<T> {
  const { ctx, ...rest } = init;
  const res = await fetch(input, { ...rest, signal: ctx?.signal });

  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await readBody(res);
    } catch {
      /* 読めない応答は無視して、下でステータスから文言を作ります */
    }
    const o = (body ?? {}) as Record<string, unknown>;
    throw new ActionError(
      typeof o.message === "string" ? o.message : `HTTP ${res.status}`,
      {
        displayMessage:
          typeof o.message === "string"
            ? o.message
            : `通信に失敗しました (${res.status})`,
        code: res.status,
        fields:
          o.fields && typeof o.fields === "object"
            ? (o.fields as Record<string, string>)
            : undefined,
        cause: body,
      },
    );
  }

  return (await readBody<T>(res)) as T;
}

/**
 * 応答の本文を読みます。
 *
 * **`res.json()` をそのまま呼んではいけません。**
 * 次のどれでも落ちて、`SyntaxError: Unexpected token '<'` のような
 * 技術的な文言がそのまま画面に出ます。
 *
 *   - 200 だが本文が空（よくある「保存しました」の返し方）
 *   - 200 だが HTML（プロキシや静的ホスティングの設定ミス）
 *   - 204 No Content
 *
 * どれも「失敗」ではないので、落とさずに受け止めます。
 */
async function readBody<T>(res: Response): Promise<T | undefined> {
  if (res.status === 204 || res.status === 205) return undefined;

  const type = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (text.trim() === "") return undefined;

  if (!type.includes("json")) {
    // JSON でないと分かっているものを JSON.parse しません。
    // 中身は使えないので、そのまま文字列として返します。
    return text as unknown as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new ActionError("応答を読み取れませんでした", {
      displayMessage:
        "サーバーから予期しない形式の応答が返りました。送信先の設定を確認してください。",
      code: "BAD_RESPONSE",
      cause: { text: text.slice(0, 200), error: String(e) },
    });
  }
}
