# shadcn のディレクトリに載せる手順

**まだ載っていません。そして、急ぐ必要もありません。**

掲載が無くても、利用者は設定ゼロで部品を入れられます。

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/action-button
```

公式文書にもそう書いてあります。

> You do not need to submit a public GitHub registry to the registry directory
> to use it with `owner/repo/item` addresses. The registry directory is for
> namespaces such as `@acme`.

**掲載で増えるのは `@nasu/…` の短い書き方と `shadcn search @nasu` だけ**です。
出したくなったときのために、要件と entry の形をここに残します。

「公式のディレクトリにある」は信頼の合図なので、**載るまでは現在形で書きません。**
SECURITY.md にも「掲載を申請する準備をしています」と書いてあります。

## 何が要るか

[公式の手順](https://ui.shadcn.com/docs/registry/registry-index)に書いてある要件と、
こちら側の状態です。

| 要件 | 状態 |
|---|---|
| 公開されていて、オープンソースであること | ✓ MIT、GitHub Pages で公開 |
| 公開先の root に `registry.json` があること | ✓ `https://nasu726.github.io/Nasu-Stack/r/registry.json` |
| 個別の JSON が同じ階層に平置きされていること | ✓ `…/r/<name>.json` |
| 一覧の `files` に `content` を入れないこと | ✓ 機械で確かめています（`verify-published.mjs`） |
| **npm への publish** | **不要です。** 公開 URL があれば足ります |

`pnpm pages:build` を通すと、この形が `public/r/` に出ます。
公開後は `node scripts/verify-published.mjs <URL>` が毎回確かめます。

## 機械が見ているもの（実データで確認）

`apps/v4/scripts/validate-registries.mts` の schema はこれだけです。

```ts
name: z.string().regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/),
homepage: z.string().url(),
url: z.string().refine((url) => url.includes("{name}")),
description: z.string(),   // 長さも言語も見ていない
logo: z.string(),           // SVG かどうかすら見ていない
```

ほかに、ワークフローが予約名前空間（`@shadcn` `@ui` `@blocks` など）を
弾きます。`@nasu` は予約されておらず、既存の 280 件とも重複しません。

## 慣習（機械は見ないが、人は見る）

既存 280 件を数えた結果です。

| | |
|---|---|
| **非ラテン文字の description** | **0 件。** 日本語で出すと人のレビューで止まりえます |
| `name` が `@` 始まり | 280 / 280 |
| `logo` がインライン `<svg>` | 280 / 280（URL も base64 も 0 件） |
| `homepage` が `url` と同じホスト | 264 / 280 |
| 大文字始まりの description | 272 / 280。句点で終わる 253 / 280 |
| description の長さ | 中央値 114 字 / 最大 355 字 |
| viewBox | `0 0 24 24` が 52 件、`0 0 32 32` が 21 件 |
| 並び順 | ほぼ昇順だが崩れが 19 か所。**新しいものは末尾に足されています** |

## 手順

1. `shadcn-ui/ui` を fork
   （**向こうには何も起きません。** 読み取り専用のコピーができるだけです）
2. `apps/v4/registry/directory.json` の**末尾**に
   [`shadcn-directory-entry.json`](shadcn-directory-entry.json) の中身を足す
3. `pnpm validate:registries` を通す
4. PR を出して、レビューを待つ

## 載ったあとも、npm には無いことを言い続けます

ディレクトリに載ると「npm にもあるだろう」と思われます。**ありません。**

入口の CLI は version 付き GitHub Release asset の URL です。

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v1.0.0/create-nasu-stack-1.0.0.tgz my-site
```

`npx create-nasu-stack` は**空いている名前**なので、打つと他人のコードが動きます。
`scripts/check-forbidden.mjs` が、その文字列がコードに紛れ込んでいないか毎回見ています。
理由は [`security.md`](security.md) と [`../SECURITY.md`](../SECURITY.md) に。
