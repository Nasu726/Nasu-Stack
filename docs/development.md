# 開発するとき

**このリポジトリ自体を触る人向け**です。部品を使うだけなら [README](../README.md) で足ります。

---

## リポジトリ構成

```
registry/nasu/                ← 配布されるソース。ここが本体
  lib/action.ts                 契約・エラー正規化・ActionSpec
  lib/action-defaults.ts        既定のエラー処理を配るコンテキスト
  lib/tokens.css                余白・幅・ヘッダ高さ・壊れない土台・既定テーマ
  lib/prose.css                 本文（Markdown）の見た目。幅は持たない
  lib/seo.ts                    title / canonical / OGP / JSON-LD の組み立て
  lib/feed.ts                   sitemap.xml / rss.xml / robots.txt の組み立て
  lib/submit.ts                 フォームの送信先への配線（タイムアウト・翻訳・おとり）
  lib/themes.css                追加テーマ 3 種（差し替え・追加が前提）
  lib/utils.ts                  cn() / inputClass()
  scripts/check-responsive.mjs  端末幅チェック（利用者にも配られます）
  hooks/use-action.ts           書き込み系
  hooks/use-resource.ts         読み取り系
  components/ui/layout.tsx      レイアウト・プリミティブ
  components/ui/*.tsx           そのほかのコンポーネント

apps/playground/              ← React + Vite のカタログ（全状態を手で確認できる）
apps/site/                    ← Astro の静的サイト例（island 連携の確認）
scripts/                      ← レジストリ生成・検証・スクリーンショット
registry.json                 ← 配布定義（40 アイテム）
public/r/*.json               ← 生成物（shadcn CLI が読む）
```

**ディレクトリ構造は利用者側と一致させてあります。**
開発時の `@` エイリアスが `registry/nasu` を指し、shadcn が展開する先も
`src/components/ui/...` と同じ形になるので、
「開発では動くが配ると壊れる」が構造的に起きません。

---

## 開発

```bash
pnpm install
pnpm dev          # カタログ (React + Vite)
pnpm dev:site     # 静的サイト例 (Astro)
pnpm build        # 両方ビルド + レジストリ生成
```

### 動作確認

```bash
pnpm verify   # 型検査・ビルド・配布物・実ブラウザ検証をまとめて実行（25 工程）
pnpm verify:create   # 生成物を install → build → 配信して実ブラウザで確認
pnpm check -- http://localhost:5173/   # 端末幅の崩れだけを見る
```

`pnpm verify` がやること:

```
✓ 型検査 (カタログ + レジストリ)      ✓ 実ブラウザ: 非同期の状態
✓ 型検査 (Astro サイト)               ✓ 実ブラウザ: レイアウトと通知
✓ ビルド (カタログ / Astro サイト)     ✓ 実ブラウザ: 壊しにくる中身
✓ レジストリ生成                      ✓ 実ブラウザ: 部品
✓ 配布の依存漏れ                      ✓ 実ブラウザ: 入力/選択/楽観更新
✓ 単体: SEO / フィードの組み立て       ✓ 実ブラウザ: ナビ/開閉/本文/画像
✓ 利用者プロジェクトへ展開して型検査   ✓ 実ブラウザ: SEO / ブログ / フィード
                                     ✓ 実ブラウザ: 端末幅の崩れ
```

端末幅の検査は、カタログの **全タブ**（`?tab=` で指定）と Astro サイトの全ページを、
5 つの画面幅で回します。合わせて 70 通り。

画像が場所を先に取っているかは、**画像の読み込みを遮断してから**測ります。
属性から推測すると、速い環境では読み終わってしまって見逃します（実際に見逃しました）。
Astro 側のページ一覧は **sitemap.xml から取ります**（手で並べると、
ページを足したときに検査から漏れるため）。

`404.html` を置いてもステータスを 404 にしない静的ホスティングがあります。
配信側の設定を確かめてください。
既定タブしか見ていなかったせいで新しい部品が検査から漏れていた、という事故が
実際にあったためです（[docs/refactor-v05.md](docs/refactor-v05.md)）。

`check-registry-deps.mjs` は、ソースが実際に import しているものと
`registry.json` の `registryDependencies` を突き合わせます。
ここが漏れていても**このリポジトリでは何も起きず**、
利用者が部品を 1 つだけ入れたときにだけ壊れるためです。

**測った数字を印字するだけの検査を残さないでください。**
以前はそれで、タップ領域が 44px から 20px に戻っても緑のまま通っていました。
いまは 1 つでも外れると落ちます。

判定にしているのは「壊れたら困る性質」と「トークンから決まる値」だけです。
要素の絶対座標のような、配置で変わる値は判定にしていません
（フォントが変わっただけで落ちる検査は、やがて誰も見なくなります）。

### 対応環境

| | |
|---|---|
| **配布物（利用者が受け取る 38 ファイル）** | OS 非依存。Node 18 以上 |
| **このリポジトリの開発用スクリプト** | Linux / macOS / **Windows 11** で動作確認済み |

Windows は実機確認しています（Windows 11 / Node 24.13 / pnpm 10.28）。
`pnpm verify` 25 工程と `pnpm verify:create` 106 判定が緑です。
子プロセスの起動と停止は [`scripts/_proc.mjs`](scripts/_proc.mjs) が唯一の定義で、
**なぜ OS ごとに違うのかはそこに書いてあります**（`.cmd` は shell 無しで
spawn できない / Windows にプロセスグループが無い）。

GitHub Actions で push・PR・週 1 の定期実行にかけています。
Renovate の依存更新 PR も、これが緑なら中身を見ずに上げられます。
**「テンプレは腐る」への唯一の実効的な対策です。**

`verify-install.mjs` は shadcn CLI と同じ依存解決を再現して、まっさらな
TypeScript プロジェクトへ展開したうえで `tsc` を通します。
オフラインでも回せるので CI に載せられます。

---
