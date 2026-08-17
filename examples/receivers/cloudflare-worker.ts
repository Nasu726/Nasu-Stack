/**
 * 受け口の見本 — Cloudflare Workers
 * ================================================================
 * 静的サイトから送られたフォームを受け取り、メールへ転送します。
 *
 *   wrangler deploy
 *   PUBLIC_CONTACT_ENDPOINT=https://<name>.<you>.workers.dev/contact
 *
 * **この 1 ファイルで完結します。** サーバーを持たずに済むので、
 * 静的サイトの構成を崩しません。
 *
 * ----------------------------------------------------------------
 * ここが抜けると動かない、という点を先に
 * ----------------------------------------------------------------
 * 1. **CORS のプリフライト（OPTIONS）**
 *    別ドメインへ `content-type: application/json` で POST すると、
 *    ブラウザは本体の前に OPTIONS を送ります。ここに応えないと、
 *    **本体のリクエストは 1 度も飛びません。**
 *    しかも JavaScript 側からは「通信できませんでした」としか見えません。
 *
 * 2. **Access-Control-Allow-Origin を * のままにしない**
 *    見本では * ですが、公開するときは自分のドメインに絞ってください。
 *    絞らないと、誰のサイトからでもこの受け口を叩けます。
 *
 * 3. **必ずサーバー側でも検証する**
 *    ブラウザ側の検証は、利用者を助けるためのものです。
 *    直接 POST されたら素通りするので、ここでも見ます。
 */

export interface Env {
  /** 送信を許可する送信元。例: "https://example.com" */
  ALLOWED_ORIGIN?: string;
  /** メール送信サービスの API キー（Workers の秘密として設定） */
  MAIL_API_KEY?: string;
  /** 送信先のメールアドレス */
  MAIL_TO?: string;
  /**
   * `"true"` のときだけ、転送先が未設定でも成功として返します。
   *
   * **動作を見たいだけの段階のためのものです。** 既定では無効なので、
   * 設定を忘れたまま本番へ持っていっても、問い合わせが黙って消えることは
   * ありません。**明示的に有効にした人だけが、その状態を選べます。**
   */
  DEV_ACCEPT_WITHOUT_FORWARDING?: string;
}

interface ContactInput {
  name?: string;
  email?: string;
  message?: string;
}

function cors(env: Env): Record<string, string> {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    // プリフライトの結果を 1 日覚えてもらう（毎回 2 往復させない）
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const json = (body: unknown, status: number, env: Env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(env), "content-type": "application/json; charset=utf-8" },
  });

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. プリフライト。これが無いと本体は飛んできません。
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (request.method !== "POST") {
      return json({ message: "POST してください" }, 405, env);
    }

    // 2. 本文を読む。JSON でないものが来ても落ちないように。
    let input: ContactInput;
    try {
      input = (await request.json()) as ContactInput;
    } catch {
      return json({ message: "本文を読み取れませんでした" }, 400, env);
    }

    // 3. 検証。fields に入れて返すと、AsyncForm が
    //    それぞれの入力欄の下に出してくれます。
    const fields = validate(input);
    if (Object.keys(fields).length > 0) {
      return json({ message: "入力内容を確認してください", fields }, 422, env);
    }

    // 4. 転送。ここは使うサービスに合わせて差し替えてください。
    //    鍵は必ず Workers の秘密として持たせます（コードに書かない）。
    /* ----------------------------------------------------------------
     * 設定が足りないときは、**受け取ったふりをしません。**
     * ----------------------------------------------------------------
     * 以前はここで `{ ok: true }` を 200 で返していました。
     * 送信した人の画面には「送信しました」と出ます。
     * **サイトの持ち主には何も届きません。**
     *
     * 問い合わせ・採用の応募・サポートの依頼が、誰にも気づかれずに消えます。
     * 秘密を 1 つ設定し忘れただけでそうなるので、**気づく方法がありません。**
     *
     * 届かないなら、届かないと言います。嘘の成功を返さないこと。
     * 直したい人が直せるように、ログには「何が足りないか」だけ出します。
     * ---------------------------------------------------------------- */
    if (!env.MAIL_API_KEY || !env.MAIL_TO) {
      /* **受け取った中身をログに出しません。**
         氏名・メールアドレス・本文がそのまま Cloudflare のログに残ります。
         設定漏れを直すのに、その中身は要りません。 */
      console.error(
        "[contact] 転送先が設定されていないため受け付けられません:",
        [!env.MAIL_API_KEY && "MAIL_API_KEY", !env.MAIL_TO && "MAIL_TO"]
          .filter(Boolean)
          .join(", "),
      );

      /* 動作を見たいだけの段階では、明示的に許可できます。
         **既定では有効になりません。** 本番へそのまま持っていっても、
         黙って握り潰す状態にはなりません。 */
      if (env.DEV_ACCEPT_WITHOUT_FORWARDING === "true") {
        return json({ ok: true, forwarded: false }, 200, env);
      }

      return json(
        {
          message:
            "現在お問い合わせを受け付けられません。時間をおいてお試しください。",
        },
        503,
        env,
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.MAIL_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "form@example.com",
        to: env.MAIL_TO,
        // 件名に利用者の入力をそのまま入れないこと（改行を混ぜられます）
        subject: "サイトからのお問い合わせ",
        text: [
          `お名前: ${input.name}`,
          `メール: ${input.email}`,
          "",
          input.message,
        ].join("\n"),
        reply_to: input.email,
      }),
    });

    if (!res.ok) {
      // 相手の失敗をそのまま利用者に見せません。
      // ここで詳しく返すと、外部サービスの都合が画面に出てしまいます。
      console.error("[contact] 転送に失敗", res.status, await res.text());
      return json(
        { message: "送信を受け付けられませんでした。時間をおいてお試しください。" },
        502,
        env,
      );
    }

    return json({ ok: true }, 200, env);
  },
};
