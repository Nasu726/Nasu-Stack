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

## Phase 1.5 — カタログとデモの中身（実機で見つかった 9 件）

公開したカタログとデモを作者がスマホで見て挙げたもの。
**スマホ特有と明記された 1 件以外は、PC でも同じように出ます。**

いちばん重いのは **2 と 7** です。作者個人のプロジェクト名・氏名・所在地が
公開ページに載っていました。見本の中身は、誰のものでもない値であるべきです。

Phase 1 で `works.json` は差し替えました。**しかしカタログ側に同じものが
残っていました。** 報告された 1 か所だけを直して、同じ性質の場所を
探さなかったのが誤りです。今回は**全ファイルを機械的に洗います。**

| # | 指摘 | 直し方 |
|---|---|---|
| 1 | 「ナビ/開閉」の `SiteHeader` がカタログ自身のヘッダの上に出る | `SiteHeader` は `z-30`、カタログのヘッダは `z-10` だった。カタログ側を `z-40` へ上げる。あわせて **`z-30` である事実と変え方**を部品の解説に書く |
| 2 | 「端末幅」「部品」の表に作者の実プロジェクト名 | 「案件 A」… に差し替え |
| 3 | 端末プレビューがスマホでは分かりにくい | 「画面の広い端末向け」と明記する |
| 4 | `example.com` を実際のリンク先にしている | 実際に飛ぶのは `NavDemo` の 1 か所だけ。表示だけの箇所（本文・プレースホルダ）は表記なので残す |
| 5 | `ConfirmDialog` の例が手書きの React | `ActionButton` に `confirm` があるので、そちらを先に見せる |
| 6 | `formDataToObject` の使い方が分かりにくい | してはいけない書き方の講義をやめ、**使い方と出てくる値**を見せる |
| 7 | 「なす」「Studio Nasu」「東京都調布市」 | 一般名／架空名へ。**個別具体的な名前を全部洗う** |
| 8 | 「送信する」が押しにくい | 「デモ用です。実際には送信されません」を添える |
| 9 | 日本語と説明の妥当性 | 全件を `docs/review-copy-v09c.md` に列挙し、**採否は作者が決める** |

### 7 の対象（洗い出した結果）

| 場所 | いま | 直す |
|---|---|---|
| `playground/PartsDemo.tsx` / `ResponsiveDemo.tsx` / `fake-api.ts` | `owner: "なす"` | `me`（既にある `collaborator` と対にする） |
| `playground/PartsDemo.tsx` | `{ name: "なす", team: "本人" }` | `{ name: "me", team: "自分" }` |
| `playground/App.tsx` | `placeholder="なす"` | `山田 太郎` |
| `playground/App.tsx` / `NavDemo.tsx` | `Studio Nasu` | `Example Studio` |
| `site/site.config.ts` | `name` / `author` | `Example Studio` |
| `site/pages/*.astro` | `© 2026 Studio Nasu` | `© 2026 Example Studio` |
| `site/pages/about.astro` | **`東京都調布市`**（作者の居住地域） | 架空の住所へ |
| `site/pages/about.astro` | 沿革が作者の実際の経緯 | 架空の沿革へ |

**この 7 は Phase 2 の前提でもあります。** `apps/site` は 3 つ目の雛型の原本に
なるので、個人の情報が残ったままだと**利用者全員のサイトに配られます。**

### 9 の扱い

作者が採否を決めるので、**こちらでは直しません。**
`docs/review-copy-v09c.md` に「場所 / いまの文 / 何が問題か / 直す案」を並べ、
採用の指示を待ちます。1〜8 と重なるものだけ、そちらで一緒に直します。

---

### 1.5 の 2 巡目（実機の追加指摘）

| # | 指摘 | 直したもの |
|---|---|---|
| 1 | 端末プレビューに 404 が出ている | `iframe src="/?embed=1"` に `base` が付いていなかった。**Phase 1 と同じ穴の残り**。左右のはみ出しは 404 ページを読み込んでいたためで、直すと消えた |
| 2 | タブがタッチパッドで動かない | `Scrollable` にホイールの縦→横を足す。**既定は切**（コード例や表で縦読みが止まるため）。タブの列だけ `wheelX` |
| 3 | 上部のタブが半画面で無駄にスクロールする | `max-w-[min(38rem,60vw)]` をやめ、残り幅に合わせる |
| 4 | 見出しが区切り線に近すぎる | → **下の「余白のクラスが 0px だった」へ** |
| 5 | DropdownMenu が最下部で必ず上に開く | 章の順序を変え、下に余白のある位置へ移した |

#### 見つかった 2 つの構造的な問題

**(a) 余白のクラスが、エラーも出さずに 0px になっていた**

`pt-2xl` を足しても、実測は `0px` のままでした。
余白の段階は Tailwind 標準の名前空間を避けているので、
**使う形ごとに `@utility` を書く必要があります。**
書かれていたのは `p-*` `px-*` `py-*` `gap-*` の 4 つだけでした。

実際に死んでいたクラス:

```
pt-2xl / pt-3xl / pb-3xl / pb-2xs / mt-xs ×4 / mt-xl / mt-3xl / mb-2xs
```

**配っている `site-footer.tsx` の中にも 2 件ありました。**
見た目が少し詰まるだけなので、目では見つかりません。

→ 方向つきを全部定義し、`scripts/check-space-utilities.mjs` で見張ります
（`tokens.css` から段階と `@utility` を読むので、足せば自動で追随します）。

**(b) 手元の配信サーバが、本番と違う挙動だった**

`BASE_PATH=/WebTemplate` を渡しても、`public/` が **`/` にも生えていました。**
本番（GitHub Pages）で `/` にあるのは別のサイトなので、
root を指したリンクは手元でだけ 200 で通ります。

**この iframe の 404 は、そのせいで判定を素通りしていました。**
`_static.mjs` を直し、basePath の外は 404 を返すようにしました。
直した後に、わざと戻して赤くなることを確認しています。

```
✗ カタログ(responsive): 開いたときに失敗する要求が無い
    (http://127.0.0.1:5055/?embed=1 → HTTP 404)
```

**(c) 章ごとの検査漏れ**

`verify-published.mjs` はカタログの**既定の章しか開いていませんでした。**
端末プレビューは「端末幅」の章にしか無いので、
何を出していても見られません。全部の章を開くようにしました
（判定 15 件 → 21 件）。

---

## Phase 2 — 3 つ目の雛型（ブログ付きサイト）

`apps/site`（ブログ / LP / 会社概要 / 問い合わせ / RSS / sitemap / 404）を
雛型として選べるようにします。いまの最小の astro 版は
「何も無いところから始めたい人」向けに残します。

- `packages/create-webtemplate/scaffold/blog/` を足す
- 中身は `apps/site` から**生成**します（`build-create-template.mjs` が写す）。
  **手でコピーして commit しません。** 原本が 2 か所になると必ずずれます
- 個人的な内容（記事の中身・works）はハリボテに置き換え
- **検査用の記事（qa.md / draft-note.md）も差し替えます。** 「この記事は検査用です」と
  自己申告する文面が、利用者全員のブログに配られるためです（指摘 C-5）。
  検査用の記事は `apps/site` 側に残します
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
