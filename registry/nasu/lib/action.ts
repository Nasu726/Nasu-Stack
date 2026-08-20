/**
 * Nasu Stack — 非同期処理の統一契約
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
export const ABORTED = Symbol("nasu-stack.aborted");

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
   * 入力に混ぜる**既定値**。同じキーが入力にあれば、**入力が勝ちます。**
   *
   * v0.9c まで `body`（「必ず混ぜる固定値」）という名前でしたが、
   * 実際は上書きできる既定値でした。**名前のほうを実装に合わせました。**
   *
   * **認可に使う値をここに置かないでください。** `role` `tenantId`
   * `userId` のようなものは、クライアントが送った値である以上、
   * ここに書いても上書きできます。誰であるかはサーバ側で決めてください。
   */
  defaults?: Record<string, unknown>;
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

  const { url, method = "POST", headers, defaults } = spec;

  return async (input: TInput, ctx: ActionContext) => {
    if (method === "GET") {
      return jsonRequest<TOutput>(url, { method, headers, ctx });
    }
    const payload =
      input && typeof input === "object"
        ? { ...defaults, ...(input as Record<string, unknown>) }
        : (defaults ?? (input as unknown));
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
    /* **サーバの `message` を画面に出しません。**
       そこに来るのは DB のエラー、内部の URL、使っている製品の名前など、
       利用者に見せる前提で書かれていないものです。React が escape するので
       XSS にはなりませんが、**内部の事情がそのまま漏れます。**

       画面に出すのは、サーバが**そのつもりで**入れた `userMessage` だけです。
       無ければ、こちらでステータスから作ります。

       サーバ側の形:
         { "userMessage": "送信できませんでした", "code": "CONTACT_FAILED",
           "requestId": "…", "fields": { "email": "…" } }

       元の `message` は捨てていません。`ActionError.message` と `cause` に
       残るので、開発者コンソールと Sentry などからは読めます。 */
    const userMessage =
      typeof o.userMessage === "string" ? o.userMessage : undefined;
    throw new ActionError(
      typeof o.message === "string" ? o.message : `HTTP ${res.status}`,
      {
        displayMessage: userMessage ?? `通信に失敗しました (${res.status})`,
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
 * 空の成功応答は `undefined` として受け止めます。一方、関数名が
 * `jsonRequest` なのに中身のある HTML / text を成功にすると、保存先の設定が
 * 間違っていても「完了しました」と表示します。そこは `BAD_RESPONSE` で
 * fail closed にします。text が必要なら、呼び出し側が通常の `fetch` などを
 * 明示的に選びます。
 */
async function readBody<T>(res: Response): Promise<T | undefined> {
  if (res.status === 204 || res.status === 205) return undefined;

  const type = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (text.trim() === "") return undefined;

  const mediaType = type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const isJson =
    mediaType === "application/json" ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+json"));

  if (!isJson) {
    throw new ActionError("JSON ではない応答が返りました", {
      displayMessage:
        "サーバーから予期しない形式の応答が返りました。送信先の設定を確認してください。",
      code: "BAD_RESPONSE",
      cause: { contentType: type, text: text.slice(0, 200) },
    });
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

/**
 * 利用者が書いた callback を呼びます。**投げても処理の失敗にしません。**
 *
 * ----------------------------------------------------------------
 * なぜ境界を分けるのか
 * ----------------------------------------------------------------
 * action が成功した時点で、サーバ側の副作用（決済・メール送信・登録・削除）は
 * **もう起きています。** その後 `onSuccess` がバグで投げたとき、それを
 * 「action が失敗した」と扱って retry すると、**同じ副作用がもう一度走ります。**
 *
 * 実測（v0.9b）: `onSuccess` が投げる + `retry=3` で action が **4 回**
 * 実行されていました。retry が 0 でも「サーバでは成功しているのに画面は
 * エラー」という食い違いが残ります。
 *
 * ----------------------------------------------------------------
 * 握り潰しません
 * ----------------------------------------------------------------
 * 例外は console へ出します。状態をエラーにしないのは、
 * **「action は成功した」というのが事実だから**です。
 * 嘘の断定をしない代わりに、原因が追える場所には必ず残します。
 */
export async function callSafely(
  fn: () => void | Promise<void>,
  name: string,
): Promise<void> {
  try {
    /* **await します。** 同期の throw だけを拾う形だと、
       `onSuccess: async () => { … throw }` が素通りして
       unhandled rejection になります（外部レビューの P2-01）。
       利用者が async なコールバックを書くのは自然なことです。

       呼ぶ側は retry の**外**でこれを待ちます。中で待つと、
       コールバックの失敗が action の失敗として繰り返されます。 */
    await fn();
  } catch (e) {
    console.error(
      `[action] ${name} が例外を投げました。処理自体は完了しています。`,
      e,
    );
  }
}
