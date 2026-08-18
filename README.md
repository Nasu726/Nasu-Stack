# WebTemplate

**余白は迷わせない。状態は書かせない。**

```bash
npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
```

**先に見る:** [部品のカタログ](https://nasu726.github.io/WebTemplate/catalog/)（38 個を実際に触れます） /
[デモサイト](https://nasu726.github.io/WebTemplate/demo/)（この部品で組んだサイト）

全体像と設計の理由は [docs/overview.md](docs/overview.md) にまとめてあります。
**何を引き受け、何を引き受けないか**は [docs/boundaries.md](docs/boundaries.md) に。
**何を引き受け、何を引き受けないか**は [docs/boundaries.md](docs/boundaries.md) に。

> **npm には publish していません。** 個人的なプロジェクトとして続けるので、
> 継続的な保守を約束できないためです。npm は URL の tarball をそのまま
> 受け取れるので、これで同じことができます。
> **`npx create-webtemplate` とは打たないでください** — その名前は npm で
> 空いており、こちらの配布物ではありません。理由と守りは
> [docs/security.md](docs/security.md) に書いてあります。

見た目だけのコンポーネント集ではありません。初心者が確実に詰まる 2 箇所
— **配置**と**非同期の状態** — を、部品側が引き受けます。

```tsx
// 余白は 9 段階が既定。迷わないが、必要なら段階外も書ける
<Stack space="lg">
  <Hero />
  {/* 関数を 1 つ渡すだけ。読込中も失敗も連打も全部入っている */}
  <ActionButton action={() => api.save(form)}>保存する</ActionButton>
</Stack>
```

`ActionButton` の 1 行に、以下が全部入っています。

- 押している間のスピナー表示とボタン無効化
- 連打による二重送信の防止
- 失敗時のエラーメッセージ表示と、押し直しでの再実行
- 成功時のチェックマーク表示と、数秒後の自動リセット
- アンマウント時のリクエスト中断（`ctx.signal`）
- `aria-busy` / `role="status"` / `role="alert"` の付与

---

## なぜ作ったか

2026 年時点で、shadcn 系のブロック集は 2,500 個以上が $149〜399 で売られています。
しかしそのほぼ全てが **presentational（見た目だけ）** です。
一方で「機能つき」のコンポーネントは Supabase UI Library や Convex Components のように
**特定のバックエンド専用**になっています。

その間 — **バックエンドに依存せず、状態と配線だけを引き受けるコンポーネント** — が空白でした。
このリポジトリはそこを埋めます。

---

## 4 つの層

```
┌─────────────────────────────────────────┐
│  トンマナ層  tokens.css + themes.css      │  ← 色・角丸・影・書体・余白を data-theme で切替
├─────────────────────────────────────────┤
│  レイアウト層  Stack / Columns / Tiles   │  ← 余白は 9 段階のみ。外側の余白は部品が持たない
├─────────────────────────────────────────┤
│  部品層       ActionButton / AsyncForm   │  ← 状態を全部持つ。バックエンド非依存
│               SiteHeader / Dialog / Tabs  │  ← ナビと開閉。ARIA とキーボードは部品の担当
├─────────────────────────────────────────┤
│  契約層       Action / ActionSpec        │  ← (input, ctx) => Promise<output> だけ
└─────────────────────────────────────────┘
                    ↕
        あなたの API / Supabase / Convex / 何でも
```

利用者が覚える契約は実質これだけです。

```ts
type Action<TInput, TOutput> = (
  input: TInput,
  ctx: { signal: AbortSignal },
) => Promise<TOutput>;
```

---

## レイアウト — 迷わせない。でも塞がない

初心者が配置で詰まる原因は、自由度が高すぎることではなく
**選択肢が無限にあること**です。`8px` か `12px` かは、経験が無いと判断できません。

なので**既定の道を 9 段階に絞りました**。入力補完に出るのはこれだけです。

```
none   2xs   xs    sm    md    lg    xl    2xl   3xl
 0      4     8    12    16    24    40    64    96   (px / neutral テーマ)
```

ただし**壁ではありません。** 段階に無い値もそのまま書けます。
Tailwind の `p-4` と `p-[13px]` の関係と同じです。

```tsx
<Stack space="lg" />                        {/* 推奨。補完が効く */}
<Stack space="13px" />                      {/* 段階外の値 */}
<Stack space="clamp(1rem, 4vw, 3rem)" />    {/* 計算式も可 */}
<Stack space={{ mobile: "sm", tablet: "3rem" }} />  {/* 混在も可 */}
```

同じ考え方が幅にも通ります。

```tsx
<Column width="1/3" />       <Column width="18rem" />
<ContentBlock width="prose" />    <ContentBlock width="52rem" />
<Tiles columns={{ tablet: 3 }} />
<Tiles columns="repeat(auto-fill, minmax(14rem, 1fr))" />
```

**段階は既定値であって制約ではない**、という位置づけです。
迷う人には道を示し、分かっている人は踏み外せます。

そして唯一の原則があります。

> **コンポーネントは自分の周囲に余白を持たない。余白はレイアウト部品だけが所有する。**

これで「なぜかここだけ隙間が広い」が起きません。

```tsx
<PageBlock>                        {/* 最大幅 + 左右の余白 */}
  <Stack space="3xl">              {/* 縦に積む */}
    <Section>
      <Spread>                     {/* 両端に寄せる */}
        <Logo /> <Nav />
      </Spread>
    </Section>

    <Columns space="lg">           {/* 段組。狭い画面では自動で縦に畳む */}
      <Column width="1/3"><Side /></Column>
      <Column><Article /></Column>
    </Columns>

    <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="md">
      {items.map((i) => <Card key={i.id} />)}
    </Tiles>
  </Stack>
</PageBlock>
```

| 部品 | 役割 |
|---|---|
| `PageBlock` | ページの外枠。最大幅 + 左右の余白 |
| `ContentBlock` | 中身の最大幅だけ（本文は `width="prose"`） |
| `Section` | ページ 1 区画。上下のリズムを統一 |
| `Stack` | 縦に等間隔で積む（最頻出） |
| `Inline` | 横に並べて折り返す（`wrap={false}` なら横スクロール） |
| `Columns` / `Column` | 段組。既定でタブレット幅未満は縦に畳む |
| `Tiles` | 等間隔グリッド。要素数が半端でも崩れない |
| `Spread` | 両端に寄せる |
| `Box` | 内側の余白・背景・角丸・影 |
| `Scrollable` | 縮められない中身（表・コード）をその部分だけ横スクロールに |
| `Divider` | 区切り線 |

段階ごとの実寸はテーマで変わります（`warm` は広め、`editorial` は詰めぎみ）。
つまり**余白の広さもトンマナの一部**です。

### 自分のテーマを作る

`tokens.css` の `:root` に並んでいる変数を、別のセレクタで上書きするだけです。

```css
[data-theme="mybrand"] {
  --bg: oklch(0.99 0 0);
  --fg: oklch(0.2 0 0);
  --primary: oklch(0.55 0.2 150);
  --primary-fg: oklch(0.99 0 0);
  /* …一覧は tokens.css の :root を参照（25 個） */

  --radius: 0.5rem;                 /* 角丸 */
  --font-display: "Your Font", serif; /* 見出しの書体 */
  --space-3xl: 8rem;                /* 余白の広さもテーマの一部 */
}
[data-theme="mybrand"].dark { /* 暗い版 */ }
```

`themes.css` を読み込まなければ、既定の neutral と自分のテーマだけになります。

本文の幅には `width="prose"` を使ってください。**em 単位なので文字サイズに追従し**、
小さい文字なら幅も自動的に狭まって、1 行の字数が一定に保たれます（和文で 40 字前後）。

---

## 端末幅 — スマホで崩れないこと、崩れていないと確かめられること

### 壊れない土台

スマホ表示が壊れる原因は、ほぼ「縮まない中身」です。
利用者が `overflow-wrap` を知らなくても崩れないよう、テーマ側で受け止めます。

```css
body { overflow-wrap: break-word; }        /* 折り返せない長い URL・英単語 */
img, video, svg, iframe { max-width: 100%; } /* 実寸の大きいメディア */
pre { overflow-x: auto; }                   /* コードは折り返さず内側でスクロール */
.wt-gap > * { min-width: 0; }               /* flex/grid の子が縮めるように */

@media (pointer: coarse) {                  /* 指で押す端末では小さすぎないように */
  button, select, input, textarea { min-block-size: 2.75rem; }
}
```

表のように**縮めると読めなくなる**中身は、潰さずその部分だけスクロールさせます。

```tsx
<Scrollable label="売上の表">
  <table>…</table>
</Scrollable>
```

端が切れていることを示す影が出て、キーボードだけでも到達できます。

入力欄は常に 16px 以上です。16px 未満だと **iOS Safari が触れた瞬間に画面を自動拡大**し、
手動でしか戻せません。iPad でも起きるので「狭い画面のときだけ」では防げません。

### 崩れていないことを数値で確かめる

```bash
npm run check -- http://localhost:5173
```

実ブラウザを 320 / 375 / 414 / 768 / 1024px で開いて機械的に調べます。
崩れがあれば終了コード 1 を返すので、CI にそのまま載せられます。

```
  ✗ http://localhost:5173  @ 320 (小さいスマホ)
      横に 577px はみ出しています
        ↳ <p class="…"> が 577px 外へ  "https://example.com/very/long…"
        → 長い文字列なら overflow-wrap、表やコードなら <Scrollable> で囲んでください
      入力欄の文字が 16px 未満: 3 件 (name=14px, email=14px, password=14px)
        → iOS では触れた瞬間に画面が自動拡大されます
      タップ領域が 24px 未満: 2 件 (a 43x20 "Works", a 54x20 "Contact")
        → 指で押しづらく、WCAG 2.1 AA の最低基準を下回ります
```

検出するもの: 横スクロールの発生と原因要素 / タップ領域 24px 未満 /
入力欄の 16px 未満 / 画面幅より縮まない要素 / 1 行が長すぎる本文。

1 行の長さは**和文と欧文で閾値を変えています**。和文は 1 文字がほぼ 1em、
欧文は平均 0.5em 前後で、同じ px 幅でも読みやすさが倍違うためです。

---

## 使い方

### 1. インストール（shadcn CLI）

コードは npm パッケージではなく**あなたのリポジトリに直接コピー**されます。
中身を自由に書き換えられるのが目的なので、これが正しい配り方です。

**先に `components.json` へ 1 行足してください。** これが無いと、部品の
依存（`@nasu/action` など）が解決できず `Unknown registry "@nasu"` で止まります。

```jsonc
{
  "registries": {
    "@nasu": "https://nasu726.github.io/WebTemplate/r/{name}.json"
  }
}
```

```bash
npx shadcn@4.17.0 add @nasu/action-button
```

> **版を固定しているのはわざとです。** 最新版をそのまま実行すると、
> lockfile も待機期間も素通りします。ここに書いてあるのは、こちらの検査が
> 実際に通した版です（`package.json` の devDependencies が唯一の定義）。

依存する `use-action` / `spinner` / `utils` / `tokens` は自動で一緒に入ります
（`action-button` なら 10 ファイル）。

URL を直に指定する形（`npx shadcn@4.17.0 add https://…/r/action-button.json`）
でも**その部品 1 つは**入りますが、**依存を辿るところで失敗します。**
`registries` の宣言が必要なのはそのためです。

### 2. トンマナを当てる

```css
/* src/index.css */
@import "./styles/tokens.css";   /* 土台 + 既定テーマ。これだけで動きます */
@import "./styles/themes.css";   /* 追加の 3 テーマ。不要なら省略可 */
```

```html
<html data-theme="warm" class="dark"></html>
```

`neutral` / `warm` / `editorial` / `vivid` の 4 種。
色だけでなく**角丸・影の強さ・書体・字間**まで一緒に変わるので、
部分的に浮くことがありません。

切り替え UI が要るなら `ThemeSwitcher` をそのまま置けます。

---

## コンポーネント一覧

| 名前 | 何をしてくれるか |
|---|---|
| `ActionButton` | 関数を渡すだけの 4 状態ボタン。連打防止・確認ダイアログ・自動リトライ |
| `AsyncForm` + `Field` | 送信関数 1 つでフォーム完成。フィールド単位のエラー表示と自動クリア |
| `DataList` | 取得・スケルトン・空・失敗と再試行を 1 個で |
| `AsyncBoundary` | 読込中 / エラー / 空 / データありの 4 分岐を閉じ込める |
| `DataTable` | 並べ替え・ページング。**狭い画面では 1 行 = 1 カードに組み替え** |
| `AsyncSelect` | 検索つきセレクト。前の要求を自動で中断。キーボード操作つき |
| `FileDrop` | ドラッグ&ドロップ・進捗・失敗した分だけ再送 |
| `ConfirmDialog` / `useConfirm` | 確認ダイアログ。native `<dialog>` |
| `ActionProvider` | エラー処理の書き忘れを握り潰さない安全網（下記） |
| `Toast` / `useToast` | 画面隅の通知 |
| `ThemeProvider` / `ThemeSwitcher` | トンマナ切替。ちらつき防止スクリプトつき |
| `useAction` | 書き込み系の状態管理フック |
| `useResource` | 読み取り系の状態管理フック |

### DataTable — 狭い画面では表をやめる

320px で 8 列の表は、横スクロールできても実用に耐えません。
なので**タブレット幅未満では 1 行 = 1 カード**に組み替え、各値に列名を付けます。

```tsx
<DataTable
  rows={rows}                    // 配列を渡せばメモリ上で並べ替え・ページング
  columns={[
    { key: "date",  label: "日付", sortable: true },
    { key: "owner", label: "担当", hideOnCard: true },  // カードでは省く
    { key: "amount", label: "金額", sortable: true, align: "end" },
  ]}
  pageSize={5}
/>
```

`label` が必須なのは、**カード表示では列名が唯一の手がかりになる**ためです。
サーバー側で処理したい場合は `loader` に `{ rows, total }` を返す関数を渡します。

### FileDrop — なぜ XHR なのか

**`fetch` はアップロードの進捗を取れません。** 2026 年時点でもそうです。
リクエストのストリームで測れるのは「ブラウザが自分のストリームからデータを
引き取った時点」であって、送信された時点ではありません。

なので内部では `XMLHttpRequest` を使いますが、`uploadWithProgress` が隠すので
利用者が XHR を書くことはありません。

```tsx
<FileDrop
  action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)}
  accept="image/*"
  maxSize={5 * 1024 * 1024}
/>
```

**1 ファイルずつ**送ります。まとめて送ると 1 つ失敗しただけで全部やり直しになるためです。
個別に状態を持つので「失敗した分だけ再送」が自然に書けます。

### ActionProvider — 書き忘れの受け皿

アプリの一番外側に 1 回置くだけです。**無くても全部動きます。**

```tsx
<ActionProvider>
  <App />
</ActionProvider>
```

置くと、`onError` を書かなかったアクションが失敗したとき画面隅に通知が出ます。
初心者が一番やりがちな「エラー処理の書き忘れ」で失敗が黙って消えるのを防ぎます。

二重に出ないよう、既に画面内へ出せている場合は通知しません。

| 状況 | 表示 |
|---|---|
| `onError` を書いた | 書いたものだけ |
| `ActionButton`（`showError` 既定 true） | ボタン下に赤字。通知は出ない |
| `ActionButton showError={false}` | 画面隅の通知 |
| `AsyncForm` の入力ミス（`fields` あり） | 各入力欄の下。通知は出ない |
| `AsyncForm` の通信断・サーバー障害 | 画面隅の通知 |

---

## Astro でも使えます

静的ページは Astro、動く部分だけ React の island、という構成に対応しています。

**注意点**: `.astro` から `client:load` の island へ **関数は渡せません**（props が JSON 化されるため）。
そのため、関数を使わずに書ける「宣言」の形も用意しています。

```astro
---
import { DataList } from "@/ui/data-list";
---
<DataList client:load
  loader={{ url: "/api/works", method: "GET" }}
  columns={[
    { key: "title", primary: true },
    { key: "year", badge: true },
  ]} />
```

独自ロジックを持たせたい島は `.tsx` でラップしてから読み込みます
（`apps/site/src/components/ContactForm.tsx` が例）。

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
registry.json                 ← 配布定義（38 アイテム）
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
pnpm verify   # 型検査・ビルド・配布物・実ブラウザ検証をまとめて実行（18 項目）
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

**判定は 271 件あります。** 以前は測った数字を印字するだけで、
タップ領域が 44px から 20px に戻っても緑のまま通っていました。
いまは 1 つでも外れると落ちます。

判定にしているのは「壊れたら困る性質」と「トークンから決まる値」だけです。
要素の絶対座標のような、配置で変わる値は判定にしていません
（フォントが変わっただけで落ちる検査は、やがて誰も見なくなります）。

### 対応環境

| | |
|---|---|
| **配布物（利用者が受け取る 38 ファイル）** | OS 非依存。Node 18 以上 |
| **このリポジトリの開発用スクリプト** | Linux / macOS / **Windows 11** で動作確認済み |

Windows は v0.9a で実機確認しました（Windows 11 / Node 24.13 / pnpm 10.28）。
`pnpm verify` 19 工程と `pnpm verify:create` 29 判定が緑です。
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

## 設計上の約束

1. **バックエンドを固定しない。** fetch でも Supabase でも Convex でも、
   `(input, ctx) => Promise<output>` の形にできれば何でも刺さります。
2. **エスケープハッチを必ず残す。** どの層でも 1 段下に降りられます。
   「乗り換え」ではなく「降りる」形にすること。

   ```
   <ActionButton action={…}>  →  <Button> + useAction()  →  useState / fetch
   <Stack space="lg">         →  <Stack space="13px">    →  className="gap-[13px]"
   ```

3. **エラーは必ず 1 つの型に揃える。** 何が throw されても `ActionError` になるので、
   表示側が分岐する必要がありません。
4. **見た目だけの部品は作らない。** ヒーローや料金表のようなセクションは
   既存の shadcn ブロック集に 2,500 個以上あります。ここで作るのは
   **状態を持つもの**と**レイアウトの制約**だけです。
5. **アクセシビリティは既定で入れる。** 後付けしない。

---

## ライセンス

MIT
