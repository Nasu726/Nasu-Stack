# 受け口の見本

フォームの送信先です。**静的サイトのままで問い合わせを受け取る**ための最小構成。

| ファイル | 何か |
|---|---|
| `cloudflare-worker.ts` | Cloudflare Workers。1 ファイルで完結し、無料枠で足ります |

## 使い方

**上から順に、そのまま貼れます。3 つとも設定してください。**

```bash
npm create cloudflare@latest my-contact-endpoint
cd my-contact-endpoint
# src/index.ts を cloudflare-worker.ts の中身に置き換える

npx wrangler secret put MAIL_API_KEY      # メール送信サービスの鍵
npx wrangler secret put MAIL_TO           # 受け取るメールアドレス
npx wrangler secret put ALLOWED_ORIGIN    # 例: https://example.com

npx wrangler deploy
```

> **`ALLOWED_ORIGIN` を飛ばさないでください。** 3 つ目だけ後回しにされがちですが、
> 未設定だと `*`（どこからでも許可）のままになります。

サイト側の `.env` に、出てきた URL を書きます。

```
PUBLIC_CONTACT_ENDPOINT=https://my-contact-endpoint.<you>.workers.dev
```

## 必ず踏む 3 つ

**1. CORS のプリフライト。**
別ドメインへ `content-type: application/json` で POST すると、ブラウザは
本体の前に `OPTIONS` を送ります。ここに応えないと**本体は 1 度も飛びません**。
しかもブラウザ側からは「通信できませんでした」としか見えないので、
原因に辿り着けません。見本では最初に処理しています。

**2. `Access-Control-Allow-Origin: *` のまま公開しない。**
誰のサイトからでもこの受け口を叩けます。`ALLOWED_ORIGIN` を設定してください。

**3. サーバー側でも検証する。**
ブラウザ側の検証は利用者を助けるためのもので、守りではありません。
`curl` で直接叩かれたら素通りします。

## CORS は「認証」でも「bot 対策」でもありません

**ここを取り違えると、守れているつもりで公開してしまいます。**

`ALLOWED_ORIGIN` が制御するのは、**ブラウザの中で動く別サイトの JavaScript** だけです。
`curl`・スクリプト・bot は、そもそもブラウザではないので **CORS を一切見ません。**
`Origin` を名乗るかどうかも相手の自由です。

おとり（HoneypotField）も同じで、**画面を通らずに直接 POST されれば効きません。**
どちらも「間違って踏む人を減らす」ためのもので、攻撃を止める仕組みではありません。

公開したまま放置すると、次が起こりえます。

- 迷惑な投稿が届き続ける
- メール送信サービスの無料枠を使い切る（従量課金なら請求が出ます）
- 大量送信で送信元の評価が下がり、**まともなメールも届かなくなる**

本気で受け付けるなら、最低限これを足してください。

| やること | どこで |
|---|---|
| 本文の大きさに上限を設ける | この Worker の中（`request.headers.get("content-length")`） |
| 1 つの IP からの回数を制限する | Cloudflare の Rate limiting rules |
| 人かどうかを見る | Cloudflare Turnstile など |
| サーバ側で必ず検証する | この Worker の `validate()` |

**この見本には、上の 4 つは入っていません。** 入れずに「安全そう」に見えるのが
いちばん危ないので、入っていないことを書いておきます。

## 返し方の約束

`AsyncForm` と `createSubmit` は、次の形を理解します。

```jsonc
// 検証エラー（422）: それぞれの入力欄の下に出ます
{ "message": "入力内容を確認してください",
  "fields": { "email": "メールアドレスの形式を確認してください" } }

// errors という名前でも受け取れます
{ "errors": { "email": "…" } }

// 成功（200）: 本文は空でも構いません
{ "ok": true }
```
