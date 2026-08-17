# v0.9c — サブパスの穴を本当に塞ぎ、0.9 を仕上げる

## Context

v0.9b でカタログとデモを公開しました。**その公開されたデモが壊れています。**

作者が実機で開いて気づきました。ページは正しい場所にあるのに、
リンクだけが root を指しています。

| URL | 結果 |
|---|---|
| `/WebTemplate/demo/about/` | **200**（実体はここ） |
| `/about/` | **404**（リンクが指している先） |
| `/WebTemplate/demo/works.json` | **200** |
| `/works.json` | **404**（`fetch` している先） |

原因は **Astro の `base` が手書きの `href="/…"` を書き換えない**ことです。
`base` が効くのは、バンドラが出す資材の URL と `import.meta.env.BASE_URL` だけ。
`nav.ts` の `{ href: "/about/" }` も `loader={{ url: "/works.json" }}` も、
そのまま root を指し続けます。

さらに 3 つ目があります。**sitemap が `https://example.com/` を出しています。**
`site.config.ts` の `SITE.url` が固定で、`PUBLIC_SITE` は
`astro.config.mjs` の `site` にしか渡っていませんでした。
canonical も OGP も RSS も同じ値です。

### いちばん重い問題は、検査が通ってしまったこと

v0.9b で「サブパスの穴を自分が先に踏む」と書いて、判定も足しました。
**その判定は `.js` と `.css` しか見ていませんでした。**

資材の URL はバンドラが base 付きで出すので、**最初から壊れていない部分だけを
確かめていた**ことになります。手書きのリンクは一度も見ていません。

> 推測で書いた検査は、通っているように見えて何も見ていません。

`handoff.md` に自分で書いた一行に、そのまま当てはまりました。

### これは配布物の問題でもあります

利用者がサブパスへ公開すると、同じことが起きます。しかも
**手元では絶対に再現しません**（開発サーバは root 配信なので）。
公開して初めて壊れる——いちばん気づきにくい形です。

いま `HowToUse.md` には「`base` を足せばいい」と書いてあります。
**それは不十分な案内でした。** 直します。

---

## Phase 1 — base の穴を塞ぐ（先に、単独でマージ）

**公開中のデモが壊れているので、ここだけ先に出します。**

### 1-1. `withBase()` を配布物に置く

`registry/nasu/lib/` に置きます。`import.meta.env.BASE_URL` を読み、
root 相対のパスにだけ base を付けます。

**触ってはいけないものを触らない**のがこの関数の仕事です。

| 入力 | 扱い |
|---|---|
| `/about/` | base を付ける |
| `https://…` / `//…` | そのまま |
| `#section` / `mailto:` / `tel:` | そのまま |
| 既に base で始まっている | **そのまま**（二重に付けない） |
| `./x` / `../x`（相対） | そのまま |

二重付与の防止が要です。**部品の中で自動で付ける**ので、
利用者が自分で付けた場合と重なります。

### 1-2. 部品の中で自動で付ける

利用者の判断: **部品側で自動**。理由は失敗の仕方にあります。

書き忘れても**手元では壊れません**。壊れるのは公開した後だけなので、
「覚えてもらう」形にすると必ず漏れます。今回まさに私が漏らしました。

対象は `href` を props で受け取るもの。

- `registry/nasu/components/ui/site-nav.tsx` … `items[].href` / `brandHref` / スキップリンク
- `registry/nasu/components/ui/site-footer.tsx` … `groups[].items[].href` / `brandHref`

`withBase()` も export します。ページに手書きするリンク（`about.astro` の
本文中のリンクなど）はそちらを使います。

### 1-3. デモ側の手書きを直す

- `apps/site/src/lib/nav.ts` … 部品が付けるので**触りません**（二重付与を防ぐ）
- `apps/site/src/pages/*.astro` の本文中の `href="/…"`（実測 7 箇所）→ `withBase()`
- `apps/site/src/layouts/Base.astro` の `rss.xml` への `<link>`
- `apps/site/src/pages/index.astro` の `loader={{ url: "/works.json" }}`

### 1-4. `SITE.url` を公開先に合わせる

`site.config.ts` が環境変数を読むようにします。
`build-pages.mjs` は既に `PUBLIC_SITE` を渡しているので、受け取る側を直すだけです。

これで sitemap / RSS / canonical / OGP が正しい絶対 URL になります。

### 1-5. works.json をハリボテにする

作者の個人的なプロジェクトが載っています。**見本なので中身は要りません。**
「プロジェクト A / B / C」のような、誰のものでもない内容に差し替えます。

### 1-6. **本当にリンクを辿る検査**（この Phase の本命）

`scripts/verify-published.mjs` の判定を作り直します。**拡張子で絞りません。**

1. 入口のページを取る
2. `href` / `src` を**全部**集める（`.js` `.css` に限らない）
3. 同じサイト内のものだけ、実際に取りに行く
4. `fetch` される URL も見る（`loader={{ url }}` は HTML に出ないので、
   **ページを実ブラウザで開いて、失敗した要求を拾います**）
5. 1 つでも 404 なら赤

**4 が要です。** `works.json` は HTML に現れないので、HTML を読むだけでは
永久に見つかりません。ブラウザで開いて、実際に飛んだ要求を見る必要があります。

サブパス配信を手元で再現できるので、**公開前に落とせます**
（`serve-registry.mjs` に `BASE_PATH` があります）。

### 1-7. 案内を直す

`HowToUse.md` の公開手順は「`base` を足せばいい」で終わっています。
**それだけでは手書きのリンクが壊れる**ことを書き、`withBase()` を案内します。

---

## Phase 2 — 3 つ目の雛型（ブログ付きサイト）

`apps/site`（ブログ / LP / 会社概要 / 問い合わせ / RSS / sitemap / 404）を
雛型として選べるようにします。いまの最小の astro 版は
「何も無いところから始めたい人」向けに残します。

- `packages/create-webtemplate/scaffold/blog/` を足す
- 中身は `apps/site` から**生成**します（`build-create-template.mjs` が写す）。
  **手でコピーして commit しません。** 原本が 2 か所になると必ずずれます
- 個人的な内容（記事の中身・works）はハリボテに置き換え
- `KINDS` に 3 つ目を足す

**雛型を 1 つ足すと、実 install・build・実ブラウザの検査が丸ごと乗ります**
（いま 2 種で 56 判定）。Phase 1 の並列化があるので入りますが、
CI の所要時間は伸びます。

---

## Phase 3 — エディタの補完（スニペット）

作者の要望。「このテンプレの部品かどうかが分かる目印」と、
「属性を埋めた雛型の補完」。

- `.vscode/webtemplate.code-snippets` を生成物に入れる
- **`registry.json` と各部品の型から生成します。** 手で書きません
- 接頭辞を `wt-` に揃えると、補完の一覧で見分けがつきます
- 必須の props は埋め、任意はコメントアウトで並べます

型から props を取り出すのは、TypeScript の API を使わずに
`export interface XxxProps` を読む程度で足ります（完全な解析はしません。
**できないことをできるつもりで書かない**ため、限界をコメントに残します）。

---

## Phase 4 — 残りの P2/P3 と Renovate

外部レビューの残り。実害の大きい順に。

| | 内容 |
|---|---|
| P2-03 | `uploadWithProgress` に timeout ハンドラはあるが `xhr.timeout` が未設定。**通信が半端に止まると永久に待ちます** |
| P2-04 | `FileDrop` の `accept` が drop 経路で検証されない。利用者が「守り」と誤解しやすい |
| P2-05 | `EndpointSpec.body` の固定値を入力が上書きできる（`{...body, ...input}`）。命名か順序を直す |
| P2-06 | サーバのエラー文言をそのまま画面に出しうる。内部の事情が漏れる |
| P2-07 | プロジェクト名の検証に Windows の予約語（`CON` `NUL` `COM1`）が無い |
| P2-15 | 生成物に lockfile が無い。**同じ版から生成しても、日によって入るものが変わります** |
| P3-01 | 未知の CLI フラグを黙って無視する（`--templat vite` で気づかず Astro になる） |
| P3-02 | `SECURITY.md` が無い |
| Renovate | **SHA で固定したアクションは、追随する仕組みが無いと古いまま残ります** |

Renovate は `helpers:pinGitHubActionDigests` と `minimumReleaseAge` を設定します。
Dependabot alerts は有効化済みなので、**どちらが脆弱性を担当するか**を
`renovate.json` に明記します（両方動くと PR が二重に出ます）。

---

## Phase 5 — CI

`verify-create` を PR でも走らせます（利用者の判断）。

いまは main へのマージ後（公開の直前）にだけ走るので、
**気づくのがマージの後**です。public リポジトリは runner が無料なので、
代償は 1 回あたり 10 分程度の待ち時間だけです。

- `verify.yml` に `verify-create` ジョブを足す（`pull_request` で走る）
- `pages.yml` は `workflow_call` でそれを呼ぶ形にして、**定義を 1 か所**に
- required status check に `verify-create` を足すのは**あなたの設定**です

---

## 触るファイル

**配布物（利用者に届く）**

- `registry/nasu/lib/base.ts`（新規）— `withBase()`
- `registry/nasu/components/ui/site-nav.tsx` / `site-footer.tsx` — 自動付与
- `registry/nasu/lib/upload.ts` — timeout
- `registry/nasu/components/ui/file-drop.tsx` — accept の検証
- `registry/nasu/lib/action.ts` — body のマージ順
- `packages/create-webtemplate/index.mjs` — 名前の検証 / 未知のフラグ / HowToUse
- `packages/create-webtemplate/scaffold/blog/`（新規）

**デモ**

- `apps/site/src/site.config.ts` / `pages/*.astro` / `layouts/Base.astro`
- `apps/site/public/works.json` — ハリボテに

**検査**

- `scripts/verify-published.mjs` — **リンクを全部辿る**（本命）
- `scripts/build-create-template.mjs` — 3 つ目の雛型 / スニペット生成
- `.github/workflows/verify.yml` / `pages.yml`

**文書**

- `docs/plan-v09c.md` / `docs/result-v09c.md`（この計画と結果を残す）
- `docs/handoff.md` / `ROADMAP.md` / `SECURITY.md`（新規）

---

## 検証

各 Phase の終わりで `pnpm verify` と `pnpm verify:create` を通します。

| Phase | 何をもって完了とするか |
|---|---|
| 1 | **サブパス配信で、リンクを全部辿って 404 が 0 件。** 直す前に赤くなることを確認してから直す。公開後に実機で `/WebTemplate/demo/about/` へ遷移できる |
| 2 | 3 つ目の雛型が `npm install` → `build` → 実ブラウザまで通る |
| 3 | 生成物にスニペットがあり、`registry.json` から作られている（手書きが 0） |
| 4 | 各項目に判定がある。**わざと壊して赤くなることを確認** |
| 5 | PR で `verify-create` が走る |

### 引き継ぎ

各 Phase の終わりに `docs/handoff.md` を現状へ更新します。
計画は `docs/plan-v09c.md` としてリポジトリに置きます。

### あなたにお願いすること

1. Phase 1 のマージ（デモが壊れているので先に）
2. Phase 5 の後、required status check に `verify-create` を足すか判断
