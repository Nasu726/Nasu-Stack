# shadcn のディレクトリに載せる手順

**まだ載っていません。** これは別リポジトリ（`shadcn-ui/ui`）への PR なので、
作者が出すまで状態は変わりません。

「公式のディレクトリにある」は信頼の合図なので、**載るまでは現在形で書きません。**
SECURITY.md にも「掲載を申請する準備をしています」と書いてあります。

## 何が要るか

[公式の手順](https://ui.shadcn.com/docs/registry/registry-index)に書いてある要件と、
こちら側の状態です。

| 要件 | 状態 |
|---|---|
| 公開されていて、オープンソースであること | ✓ MIT、GitHub Pages で公開 |
| 公開先の root に `registry.json` があること | ✓ `https://nasu726.github.io/WebTemplate/r/registry.json` |
| 個別の JSON が同じ階層に平置きされていること | ✓ `…/r/<name>.json` |
| 一覧の `files` に `content` を入れないこと | ✓ 機械で確かめています（`verify-published.mjs`） |
| **npm への publish** | **不要です。** 公開 URL があれば足ります |

`pnpm pages:build` を通すと、この形が `public/r/` に出ます。
公開後は `node scripts/verify-published.mjs <URL>` が毎回確かめます。

## 手順

1. `shadcn-ui/ui` を fork
2. `apps/v4/registry/directory.json` に
   [`shadcn-directory-entry.json`](shadcn-directory-entry.json) の中身を足す
3. `pnpm validate:registries` を通す
4. PR を出して、レビューを待つ

## 載ったあとも、npm には無いことを言い続けます

ディレクトリに載ると「npm にもあるだろう」と思われます。**ありません。**

入口の CLI は tarball の URL のままです。

```bash
npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
```

`npx create-webtemplate` は**空いている名前**なので、打つと他人のコードが動きます。
`scripts/check-forbidden.mjs` が、その文字列がコードに紛れ込んでいないか毎回見ています。
理由は [`security.md`](security.md) と [`../SECURITY.md`](../SECURITY.md) に。
