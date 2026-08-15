# 受け口の見本

フォームの送信先です。**静的サイトのままで問い合わせを受け取る**ための最小構成。

| ファイル | 何か |
|---|---|
| `cloudflare-worker.ts` | Cloudflare Workers。1 ファイルで完結し、無料枠で足ります |

## 使い方

```bash
npm create cloudflare@latest my-contact-endpoint
# src/index.ts を cloudflare-worker.ts の中身に置き換える

npx wrangler secret put MAIL_API_KEY
npx wrangler secret put MAIL_TO
npx wrangler deploy
```

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
