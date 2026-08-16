# v0.7 計画 — テンプレート化（前半: SEO 基盤とブログ）

## 慎重に進めるための方針

部品が 33 個になり、判定が 106 件あります。ここからは
**「既存に触らない」を設計の制約にします。**

- 新しいものは**新しいファイル**として足す
- 既存の部品を直さないと雛型が作れないなら、**それは部品の設計が足りていない合図**。
  その場で作業を止めて報告する
- 例外は `astro.config`（絶対 URL を出すのに `site` が要る）と
  `Base.astro`（`<Seo>` を通すため）の 2 つだけ。**先に宣言しておきます**

分量が多いので前半・後半に割ります。この計画は前半だけです。

| | 中身 |
|---|---|
| **v0.7 前半（この計画）** | SEO 基盤 / sitemap / RSS / ブログ雛型 / 404 |
| v0.7 後半 | ランディング・会社サイトの雛型 |
| v0.7.5 | ダッシュボード雛型（React 側なので別物） |

---

## 何を作るのか — 「見た目のセクション集」は作りません

方針（docs/direction.md）で決めたとおり、ヒーローや料金表のような
**見た目だけのセクションは既に 2,500 個以上が売られていて、作る価値がありません。**

作るのは**骨格と配線**です。初心者が必ず抜かすのに、見た目には出ないもの。

| 抜かしやすいもの | どうなるか |
|---|---|
| `<title>` がどのページも同じ | 検索結果で見分けが付かない |
| OGP が無い | SNS に貼っても白い箱が出るだけ |
| canonical が相対パス | 同じページが複数 URL で登録される |
| sitemap.xml が無い | 新しい記事が見つけてもらえない |
| RSS の特殊文字を素で出す | `&` ひとつでフィードが壊れる |
| 記事の本文に幅指定が無い | 1 行 120 字で読めない |

---

## 設計 — 純粋な関数 + 薄いアダプタ

**フレームワークに依存する部分を最小にします。**

```
lib/seo.ts    データ → メタタグの配列        （純粋。どこでも動く）
lib/feed.ts   データ → sitemap.xml / rss.xml （純粋。文字列を返すだけ）
      ↓
Seo.astro           ← Astro 用の薄い包み（10 行程度）
sitemap.xml.ts      ← Astro のエンドポイント（10 行程度）
```

`@astrojs/rss` や `@astrojs/sitemap` を**使いません**。理由は 2 つ。

1. Astro 専用になります。この設計の売りは「特定の何かに縛られない」ことです
2. 依存が増えるほど、バージョンのずれで腐ります（このリポジトリが避けたい失敗）

XML の組み立ては 40 行ほどで、しかも**エスケープの規則を自分で持てます**。
`&` や `<` を素で出すとフィードは壊れます。ここは他人任せにしない方が安全です。

---

## 作るもの

### 1. `lib/seo.ts`（純粋）

```ts
buildMeta({
  title: "記事のタイトル",
  siteName: "Studio Nasu",
  description: "…",
  url: "https://example.com/blog/hello",   // 絶対 URL
  image: "/og/hello.png",                   // 相対でも絶対に直す
  type: "article",
  publishedAt: "2026-08-01",
})
// → [{ tag: "title", … }, { tag: "meta", property: "og:title", … }, …]
```

やること: `<title>` / description / canonical / OG / Twitter Card /
JSON-LD（`Article` か `WebSite`）。

**相対 URL を絶対に直すのがこの関数の主な仕事です。** OGP の画像を
相対パスで書くと、SNS 側は解決できずに画像なしになります。

### 2. `lib/feed.ts`（純粋）

```ts
buildSitemap(site, [{ url: "/", lastmod: "2026-08-01" }, …])  // → string
buildRss({ site, title, description, items })                  // → string
```

**XML のエスケープをここに 1 か所だけ持ちます。**

### 3. ブログ雛型（Astro）

- `src/content.config.ts` — Astro 5 の Content Layer で記事を読む
- `src/pages/blog/index.astro` — 一覧
- `src/pages/blog/[...slug].astro` — 記事本文（`prose.css` + `ContentBlock`）
- `src/pages/rss.xml.ts` / `sitemap.xml.ts` / `robots.txt.ts`
- `src/pages/404.astro`
- 記事を 3 本（うち 1 本は `draft: true`）

---

## 気をつけるところ（先に挙げておく）

- **`site` を設定しないと絶対 URL が作れません。** canonical も OGP も sitemap も
  全部これが要ります。設定し忘れると相対パスのまま出て、静かに壊れます
- **下書き（draft）を sitemap と RSS に載せてはいけません。** 一覧から外すだけでは
  漏れます。3 か所すべてで除外する必要があります
- **RSS の `description` に HTML をそのまま入れない。** エスケープするか
  CDATA で包むかを決めて、1 か所で処理します
- **日付は `<time datetime="...">` で出す。** 「2026年8月1日」という文字列だけでは
  機械が読めません
- **記事の見出しが sticky ヘッダに潜りません**（`prose.css` に
  `scroll-margin-top` を入れてあります）。目次からのジャンプで効きます
- **404 は静的ホスティング側の設定に依存します。** ページを置いただけでは
  ステータス 404 にならない環境があります。README に注記します
- **記事内の画像は `Frame` で包む。** 包まないと本文を読んでいる最中にずれます

---

## 実測で確かめる項目

1. すべてのページの `<title>` が一意か
2. canonical が絶対 URL（`https://` で始まる）か
3. `og:image` が絶対 URL か
4. JSON-LD が `JSON.parse` できるか。`@type` が妥当か
5. sitemap.xml が XML として妥当で、公開ページを全部含むか
6. **下書きが sitemap にも RSS にも一覧にも出ないか**（3 か所）
7. rss.xml が XML として妥当か
8. `&` や `<` を含むタイトルでも RSS が壊れないか（**わざと入れて試す**）
9. 記事本文の行長が和文 45em / 欧文 40em を超えないか
10. 記事の日付が `<time datetime>` で出ているか
11. 記事内の画像が比率を持ち、レイアウトシフトが 0 か
12. 記事の見出しが sticky ヘッダに潜らないか（アンカーで飛んで確認）
13. 新しいページが端末幅チェック（5 幅）を全部通るか
14. robots.txt が sitemap を指しているか
15. 404 ページが表示されるか
16. 既存の判定 106 件が緑のままか

---

## 進める順

1. `lib/seo.ts` + `lib/feed.ts`（純粋な関数だけ。ブラウザ不要で試せる）
2. **その 2 つに単体テストを書く**（実ブラウザより速く、エスケープの確認に向く）
3. `Seo.astro` と `Base.astro` の配線
4. ブログのコンテンツと一覧・詳細
5. sitemap / rss / robots / 404
6. `verify-seo.mjs` で実測 16 項目
7. `pnpm verify` 全体 → README / ROADMAP
