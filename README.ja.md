# Nasu Stack

**余白は迷わせない。状態は書かせない。**

React / Astro 向けの**部品と雛型**です。見た目だけのコンポーネント集ではありません。
初心者が確実に詰まる 2 箇所 — **配置**と**非同期の状態** — を、部品側が引き受けます。

*[English](README.md)*

```tsx
<Stack space="lg">
  <Hero />
  {/* 関数を 1 つ渡すだけ。読込中も失敗も連打も全部入っている */}
  <ActionButton action={() => api.save(form)}>保存する</ActionButton>
</Stack>
```

**先に見る:** [部品のカタログ](https://nasu726.github.io/Nasu-Stack/catalog/?lang=ja)（全部の部品を実際に触れます） /
[デモサイト](https://nasu726.github.io/Nasu-Stack/demo/ja/)（この部品で組んだサイト）

> **Nasu Stack 1.0 は Stable です。** 公開している registry 名、export、token、
> 文書化した部品の契約は semantic versioning に従い、破壊的変更は次の major version
> まで入れません。Stable になっても責任範囲は広がりません。**認証・認可、
> サーバ側の検証、問い合わせの受け口のレート制限は引き続きアプリ側の責任です。**
> 公開する前に [docs/boundaries.ja.md](docs/boundaries.ja.md) を 1 度読んでください。

---

## 使い方

### 新しく作る

コマンドは 1 つです。最初に言語、次にどこから始めるかを選びます。

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v1.0.0/create-nasu-stack-1.0.0.tgz my-site
```

Stable の入口には version 付き GitHub Release URL を使います。版ごとに URL が
変わるため、npm/npx が同じコマンドに紐づいた古い版を再利用しません。

#### まっさらから始める

**自分で組み立てたい人向け。** 土台とトンマナだけ入っていて、中身は空です。

| 選ぶもの | |
|---|---|
| `astro` | **1 ページだけ**の静的サイト。動く部分だけ React の island にできます |
| `vite` | React 単体のアプリ。管理画面やツールのように、画面の中が動くもの |

#### テンプレートから始める

**動いているサイトを削って作りたい人向け。** 白紙から書き始めずに済みます。

| 選ぶもの | |
|---|---|
| `blog` | **ブログ・LP・会社概要・問い合わせ・RSS・sitemap・404** が入った状態 |

[デモサイト](https://nasu726.github.io/Nasu-Stack/demo/ja/)がこれです。**中身を見てから決められます。**

最初に **English / 日本語**、次に **まっさらな状態から / 雛型を使う**を選びます。
ターミナルの表示と、生成される `README.md`・`HowToUse.md`・環境変数の案内は
選んだ言語に揃います。

対話を飛ばすなら `--lang ja --template <種類> --yes` を付けます。英語の案内は
`--lang en` です。

> **npm には publish していません。** 個人的なプロジェクトとして続けるので、
> 継続的な保守を約束できないためです。npm は URL の tarball をそのまま受け取れます。
> **`npx create-nasu-stack` とは打たないでください** — その名前は npm で空いており、
> こちらの配布物ではありません（[docs/security.ja.md](docs/security.ja.md)）。

### 既にあるプロジェクトへ足す

コードは npm パッケージではなく**あなたのリポジトリに直接コピー**されます。
中身を自由に書き換えられるのが目的なので、これが正しい配り方です。

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/action-button
```

**これだけです。設定は要りません。** `components.json` への追記も、
名前空間の登録も不要です。依存する `use-action` / `spinner` / `utils` /
`tokens` は自動で一緒に入ります（`action-button` なら 10 ファイル）。

<details>
<summary>短い <code>@nasu/…</code> の形で書きたいとき</summary>

名前空間を 1 回登録すると、以後は短い名前で書けます。

```bash
npx shadcn@4.17.0 registry add "@nasu=https://nasu726.github.io/Nasu-Stack/r/{name}.json"
npx shadcn@4.17.0 add @nasu/action-button
```

`shadcn search @nasu` が使えるようになり、フォークやミラーへ差し替えることも
できます。登録しないまま `@nasu/…` と打つと `Unknown registry "@nasu"` で止まります。

なお、URL を直に指定する形（`npx shadcn add https://…/r/action-button.json`）
では **1 ファイルも入りません。** 依存を辿る前に止まります（実測）。

</details>

> **版を固定しているのはわざとです。** 最新版をそのまま実行すると、lockfile も
> 待機期間も素通りします。ここに書いてあるのは、こちらの検査が実際に通した版です。

### トンマナを当てる

```css
/* src/index.css */
@import "./styles/tokens.css";   /* 土台 + 既定テーマ。これだけで動きます */
@import "./styles/themes.css";   /* 追加の 3 テーマ。不要なら省略可 */
```

```html
<html data-theme="warm" class="dark"></html>
```

`neutral` / `warm` / `editorial` / `vivid` の 4 種。
色だけでなく**角丸・影の強さ・書体・字間・余白の広さ**まで一緒に変わるので、
部分的に浮くことがありません。切り替え UI は `ThemeSwitcher` をそのまま置けます。

自分のテーマは、`tokens.css` の `:root` に並んでいる変数を別のセレクタで
上書きするだけです。

```css
[data-theme="mybrand"] {
  --bg: oklch(0.99 0 0);
  --fg: oklch(0.2 0 0);
  --primary: oklch(0.55 0.2 150);
  --primary-fg: oklch(0.99 0 0);
  /* …一覧は tokens.css の :root を参照（25 個） */

  --radius: 0.5rem;                   /* 角丸 */
  --font-display: "Your Font", serif; /* 見出しの書体 */
  --space-3xl: 8rem;                  /* 余白の広さもテーマの一部 */
}
[data-theme="mybrand"].dark { /* 暗い版 */ }
```

`themes.css` を読み込まなければ、既定の neutral と自分のテーマだけになります。

---

## 何のための道具か

Web で品質を求めるとまだ人の力が重要ですが、毎回同じところで手間がかかります。
その「毎回同じところ」を部品側が引き受けて、**創作に使える時間を増やす**ための土台です。

既存のビジュアルエディタ系ツールより自由度が高く、素の Astro / Next.js より最初の壁が低い。
その間を目指しています。

### 想定している人

| | |
|---|---|
| 主な対象 | プログラミング初心者〜中級者。**少しはコードを触れる人** |
| 副次的 | 自由度を求める開発者 |
| 対象外 | **コードを全く書かない人** |

「少しは触れる」を下限にしたのが、この設計の最も大きな分岐点です。
ここを含めるとビジュアルエディタが必須になり、開発規模が一桁変わります。

### 設計上の約束

1. **バックエンドを固定しない。** fetch でも Supabase でも Convex でも、
   `(input, ctx) => Promise<output>` の形にできれば何でも刺さります。
2. **エスケープハッチを必ず残す。** どの層でも 1 段下に降りられます。
   「乗り換え」ではなく「降りる」形にすること。

   ```
   <ActionButton action={…}>  →  <Button> + useAction()
                              →  <Button> + useInteractionGuard()  →  素の React
   <Stack space="lg">         →  <Stack space="13px">    →  className="gap-[13px]"
   ```

3. **エラーは必ず 1 つの型に揃える。** 何が throw されても `ActionError` になるので、
   表示側が分岐する必要がありません。
4. **見た目だけの部品は作らない。** ヒーローや料金表のようなセクションは
   既存の shadcn ブロック集に 2,500 個以上あります。ここで作るのは
   **状態を持つもの**と**レイアウトの制約**だけです。
5. **アクセシビリティは既定で入れる。** 後付けしない。

### 4 つの層

```
┌─────────────────────────────────────────┐
│  トンマナ層  tokens.css + themes.css     │  ← 色・角丸・影・書体・余白を data-theme で切替
├─────────────────────────────────────────┤
│  レイアウト層  Stack / Switcher / SidebarLayout │  ← 中身の成立幅で畳む。外側余白なし
├─────────────────────────────────────────┤
│  部品層       ActionButton / AsyncForm / FieldArray │  ← 状態を持つ。バックエンド非依存
│               SiteHeader / Dialog / Tabs│  ← ナビと開閉。ARIA とキーボードは部品の担当
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

設計の理由は [docs/overview.ja.md](docs/overview.ja.md) にもっと詳しく書いてあります。

---

## 中身

### 状態 — `ActionButton` の 1 行に入っているもの

- 押している間のスピナー表示とボタン無効化
- 連打による二重送信の防止
- 失敗時のエラーメッセージ表示と、押し直しでの再実行
- 成功時のチェックマーク表示と、数秒後の自動リセット
- アンマウント時のリクエスト中断（`ctx.signal`）
- `aria-busy` / `role="status"` / `role="alert"` の付与

| 名前 | 何をしてくれるか |
|---|---|
| `ActionButton` | 関数を渡すだけの 4 状態ボタン。連打防止・確認ダイアログ・自動リトライ |
| `AsyncForm` + `Field` | 送信関数1つでフォーム完成。任意のvalidation・変換済みdata・field focus・error自動クリア |
| `ValidationResult` / `Validator` | client / serverで共有するlibrary非依存の成功・field・form結果。規則そのものは決めない |
| `FieldArray` | stable key・index付きname・min/max・追加/削除focusを持つ繰り返し入力。reorderやdomain ruleは持たない |
| `DataList` | 取得・スケルトン・空・失敗と再試行を 1 個で |
| `AsyncBoundary` | 読込中 / エラー / 空 / データありの 4 分岐を閉じ込める |
| `ErrorBoundary` | React render failureを1つのsubtreeへ閉じ込め、読み上げ可能なfallbackとresetを提供。async errorとは分離 |
| `Popover` | non-modalな補助内容のcontrolled/uncontrolled開閉・Esc/外側・focus復帰・viewport配置を扱う。中身のsemanticsは利用側のまま |
| `Paginator` | URLを正にした番号navigation。現在pageと上限のあるellipsisを扱い、URLの意味とtotalはappのまま |
| `DataTable` | 並べ替え・ページング。**狭い画面では 1 行 = 1 カードに組み替え** |
| `AsyncSelect` | 検索つきセレクト。前の要求を自動で中断。キーボード操作つき |
| `FileDrop` | ドラッグ&ドロップ・進捗・失敗した分だけ再送 |
| `ConfirmDialog` / `useConfirm` | 確認ダイアログ。native `<dialog>` |
| `ActionProvider` | エラー処理の書き忘れを握り潰さない安全網 |
| `Toast` / `useToast` | 画面隅の通知 |
| `ThemeProvider` / `ThemeSwitcher` | トンマナ切替。ちらつき防止スクリプトつき |
| `useAction` / `useResource` | 書き込み系 / 読み取り系の状態管理フック |
| `useInteractionGuard` | 同じ画面操作の重なりだけを防ぐ。いつ再許可するかは利用側が決める |
| `useAutosave` | 保存をdebounce・最新値へ集約し、stale responseをstateへ戻さない。競合解決はserverの責任 |
| `Switcher` / `SidebarLayout` | 中身の最小幅が入らない時だけCSSで縦に畳むレイアウト |

`AsyncForm`・server `Response`・任意のschema library adapterを一緒に見る場合は、
[validation結果契約](docs/validation.ja.md)を参照してください。
繰り返し入力のnested path・UI key・focus・reset・1段下への降り方は、
[FieldArrayガイド](docs/field-array.ja.md)にまとめています。
render failureからの復帰とautosave queueの責任境界は、
[ErrorBoundary](docs/error-boundary.ja.md)と[useAutosave](docs/autosave.ja.md)の
ガイドにまとめています。`Popover`の中立なsemantics・focus・viewport配置・意図的な
no-portal境界は[Popoverガイド](docs/popover.ja.md)で説明しています。
番号navigation・client routerによる横取り・localization・URLの責任は
[Paginatorガイド](docs/paginator.ja.md)で説明しています。

<details>
<summary><b>DataTable — 狭い画面では表をやめる</b></summary>

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

</details>

<details>
<summary><b>FileDrop — なぜ XHR なのか</b></summary>

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

**1 ファイルずつ**送ります。まとめて送ると 1 つ失敗しただけで全部やり直しに
なるためです。個別に状態を持つので「失敗した分だけ再送」が自然に書けます。

`accept` と `maxSize` は**利用者への助言であって守りではありません**
（[docs/boundaries.ja.md](docs/boundaries.ja.md)）。

</details>

<details>
<summary><b>ActionProvider — 書き忘れの受け皿</b></summary>

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

</details>

### 配置 — 迷わせない。でも塞がない

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

<Column width="1/3" />          <Column width="18rem" />
<ContentBlock width="prose" />  <ContentBlock width="52rem" />
<Tiles columns={{ tablet: 3 }} />
<Tiles columns="repeat(auto-fill, minmax(14rem, 1fr))" />
```

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

本文の幅には `width="prose"` を使ってください。**em 単位なので文字サイズに追従し**、
小さい文字なら幅も自動的に狭まって、1 行の字数が一定に保たれます（和文で 40 字前後）。

### 端末幅 — 崩れないこと、崩れていないと確かめられること

スマホ表示が壊れる原因は、ほぼ「縮まない中身」です。
利用者が `overflow-wrap` を知らなくても崩れないよう、テーマ側で受け止めます。

```css
body { overflow-wrap: break-word; }          /* 折り返せない長い URL・英単語 */
img, video, svg, iframe { max-width: 100%; } /* 実寸の大きいメディア */
pre { overflow-x: auto; }                    /* コードは折り返さず内側でスクロール */
.wt-gap > * { min-width: 0; }                /* flex/grid の子が縮めるように */

@media (pointer: coarse) {                   /* 指で押す端末では小さすぎないように */
  button, select, input, textarea { min-block-size: 2.75rem; }
}
```

入力欄は常に 16px 以上です。16px 未満だと **iOS Safari が触れた瞬間に画面を自動拡大**し、
手動でしか戻せません。iPad でも起きるので「狭い画面のときだけ」では防げません。

表のように**縮めると読めなくなる**中身は、潰さずその部分だけスクロールさせます
（`<Scrollable label="売上の表">`）。端が切れていることを示す影が出て、
キーボードだけでも到達できます。

**そして、崩れていないことを数値で確かめられます。**

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

### Astro でも使えます

静的ページは Astro、動く部分だけ React の island、という構成に対応しています。

**注意点**: `.astro` から `client:load` の island へ **関数は渡せません**（props が
JSON 化されるため）。そのため、関数を使わずに書ける「宣言」の形も用意しています。

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
（[`apps/site/src/components/ContactForm.tsx`](apps/site/src/components/ContactForm.tsx) が例）。
詳しくは [docs/astro-and-react.ja.md](docs/astro-and-react.ja.md)。

---

## もっと詳しく

| | |
|---|---|
| [docs/overview.ja.md](docs/overview.ja.md) | 全体像と、設計をそう決めた理由 |
| [docs/boundaries.ja.md](docs/boundaries.ja.md) | **何を引き受け、何を引き受けないか**（公開する前に読む） |
| [docs/security.ja.md](docs/security.ja.md) | 配り方と、その安全性の根拠 |
| [docs/development.md](docs/development.md) | このリポジトリ自体を触るとき |
| [README.md](README.md) | English |
| [docs/rename.md](docs/rename.md) | `WebTemplate` から改名した経緯 |

**v0.9e より前の記録（`docs/plan-*` `docs/result-*` と `ROADMAP.md`）は、
旧名の `WebTemplate` のままです。** 当時の記録なので直していません。

個人のプロジェクトです。保守と対応期限は約束していません（[SECURITY.ja.md](SECURITY.ja.md)）。

## ライセンス

MIT
