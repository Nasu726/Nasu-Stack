/**
 * 受け口の見本 — Cloudflare Workers
 * ================================================================
 * 静的サイトから送られたフォームを受け取り、メールへ転送します。
 * **1 ファイルで完結します。**
 *
 * ----------------------------------------------------------------
 * 設定が足りないときは、受け取ったふりをしません
 * ----------------------------------------------------------------
 * 秘密を 1 つ忘れただけで問い合わせが黙って消えると、**気づく方法が
 * ありません。** 応募もサポートの依頼も誰にも読まれずに終わります。
 * だから足りなければ 503 を返します。
 *
 * ----------------------------------------------------------------
 * この見本が引き受けていないもの
 * ----------------------------------------------------------------
 * **レート制限と bot 対策は入っていません。** 入れずに「安全そう」に
 * 見えるのがいちばん危ないので、README にも書いてあります。
 * 本番に出す前に、そちらの手順を読んでください。
 */

export interface Env {
  /** 送信を許可する送信元。例: "https://example.com"。**必須。** */
  ALLOWED_ORIGIN?: string;
  /** メール送信サービスの API キー。**必須。** */
  MAIL_API_KEY?: string;
  /** 送信先のメールアドレス。**必須。** */
  MAIL_TO?: string;
  /**
   * 差出人。**必須。** Resend では**確認済みのドメイン**である必要があります。
   * 違うドメインを入れると 403 になり、届きません。
   */
  MAIL_FROM?: string;
  /** "development" のときだけ、下の逃げ道が使えます。 */
  ENVIRONMENT?: string;
  /**
   * `"true"` かつ `ENVIRONMENT=development` のときだけ、
   * 転送先が未設定でも成功として返します。動作を見たいだけの段階用です。
   */
  DEV_ACCEPT_WITHOUT_FORWARDING?: string;
}

/** 本文の上限。問い合わせに数十 KB も要りません。 */
const MAX_BYTES = 64 * 1024;

/** 必須の設定。1 つでも欠けたら受け付けません。 */
const REQUIRED = ["ALLOWED_ORIGIN", "MAIL_API_KEY", "MAIL_TO", "MAIL_FROM"] as const;

interface ContactInput {
  name?: string;
  email?: string;
  message?: string;
}

/* ================================================================
 * 返し方
 * ============================================================== */

/**
 * CORS のヘッダ。
 *
 * **これは守りではありません。** 制御できるのは「ブラウザの中で動く別サイトの
 * JavaScript が応答を読めるか」だけです。副作用（メール送信）はサーバで起きるので、
 * 止めたければ下の `originOk()` のようにサーバ側で見る必要があります。
 */
function cors(env: Env): Record<string, string> {
  return {
    // 未設定なら誰にも許可しません（* へ逃げない）
    "access-control-allow-origin": env.ALLOWED_ORIGIN ?? "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const json = (body: unknown, status: number, env: Env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(env), "content-type": "application/json; charset=utf-8" },
  });

/* ================================================================
 * 入口の見張り
 * ============================================================== */

/**
 * 送信元を**サーバ側で**確かめます。
 *
 * ----------------------------------------------------------------
 * なぜ応答の CORS ヘッダだけでは足りないのか
 * ----------------------------------------------------------------
 * `POST` に `content-type: text/plain` を付けると、ブラウザは
 * **プリフライトを送りません**（単純リクエスト）。本体はそのまま届きます。
 *
 * 攻撃者は応答を読めませんが、**目的がメールを送らせることなら応答は不要です。**
 * 副作用はサーバで起きています。
 *
 * だから body を読む前に、ここで落とします。
 *
 * **これも認証ではありません。** ブラウザでない相手は `Origin` を偽れます。
 * 役割は「別サイトから流れ込むのを止める」ことだけです。
 */
function originOk(request: Request, env: Env): boolean {
  return request.headers.get("origin") === env.ALLOWED_ORIGIN;
}

/**
 * 本文を、上限を超えたら途中でやめて読みます。
 *
 * `request.json()` を先に呼ぶと、**上限を確かめる前に全部読んで解析します。**
 * Cloudflare の無料枠でも本文は 100MB まで来られるので、
 * 数十 MB を受け取ってから「長すぎます」と返すことになります。
 */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? NaN);
  // 申告があるなら、読む前に落とします（申告は当てにしませんが、速いので先に見ます）
  if (Number.isFinite(declared) && declared > limit) return null;

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** サーバー側の検証。ブラウザ側の検証は当てにしません。 */
function validate(input: ContactInput): Record<string, string> {
  const fields: Record<string, string> = {};
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const message = (input.message ?? "").trim();

  if (!name) fields.name = "お名前を入力してください";
  if (name.length > 100) fields.name = "お名前が長すぎます";
  // 完璧な正規表現は存在しません。明らかにおかしいものだけ弾きます。
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fields.email = "メールアドレスの形式を確認してください";
  }
  if (!message) fields.message = "本文を入力してください";
  if (message.length > 5000) fields.message = "本文が長すぎます（5000 文字まで）";
  return fields;
}

/* ================================================================
 * 本体
 * ============================================================== */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      // プリフライト。これが無いと本体は飛んできません。
      return new Response(null, { status: 204, headers: cors(env) });
    }
    if (request.method !== "POST") {
      return json({ message: "POST してください" }, 405, env);
    }

    /* 設定が足りない。**受け取ったふりをしません。**
       中身はログに出しません（氏名・メール・本文がそのまま残ります）。 */
    const missing = REQUIRED.filter((k) => !env[k]);
    if (missing.length > 0) {
      console.error("[contact] 設定が足りません:", missing.join(", "));

      const devEscape =
        env.ENVIRONMENT === "development" &&
        env.DEV_ACCEPT_WITHOUT_FORWARDING === "true";
      if (devEscape) return json({ ok: true, forwarded: false }, 200, env);

      return json(
        { message: "現在お問い合わせを受け付けられません。時間をおいてお試しください。" },
        503,
        env,
      );
    }

    if (!originOk(request, env)) return json({ message: "許可されていません" }, 403, env);

    const type = (request.headers.get("content-type") ?? "").toLowerCase();
    if (!type.startsWith("application/json")) {
      return json({ message: "application/json で送ってください" }, 415, env);
    }

    const raw = await readCapped(request, MAX_BYTES);
    if (raw === null) return json({ message: "本文が大きすぎます" }, 413, env);

    let input: ContactInput;
    try {
      input = JSON.parse(raw) as ContactInput;
    } catch {
      return json({ message: "本文を読み取れませんでした" }, 400, env);
    }

    /* 検証。fields に入れて返すと、AsyncForm が
       それぞれの入力欄の下に出してくれます。 */
    const fields = validate(input);
    if (Object.keys(fields).length > 0) {
      return json({ message: "入力内容を確認してください", fields }, 422, env);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.MAIL_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.MAIL_TO,
        // 件名に利用者の入力をそのまま入れないこと（改行を混ぜられます）
        subject: "サイトからのお問い合わせ",
        text: [`お名前: ${input.name}`, `メール: ${input.email}`, "", input.message].join("\n"),
        reply_to: input.email,
      }),
    });

    if (!res.ok) {
      /* 相手の失敗をそのまま画面に出しません。
         **ログにも本文を丸ごと残しません。** 外部サービスの応答には、
         こちらの設定や内部の事情が入ります。status と追跡用の id で足ります。 */
      console.error(
        "[contact] 転送に失敗",
        res.status,
        res.headers.get("x-request-id") ?? "",
      );
      return json(
        { message: "送信を受け付けられませんでした。時間をおいてお試しください。" },
        502,
        env,
      );
    }

    return json({ ok: true }, 200, env);
  },
};
