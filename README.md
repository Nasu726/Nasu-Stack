# WebTemplate

**余白は選ばせない。状態は書かせない。**

見た目だけのコンポーネント集ではありません。初心者が確実に詰まる 2 箇所
— **配置**と**非同期の状態** — を、部品側が引き受けます。

```tsx
// 余白は 9 段階からしか選べない。13px で悩む余地が無い
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
│  トンマナ層   theme.css                  │  ← 色・角丸・影・書体・余白を data-theme で切替
├─────────────────────────────────────────┤
│  レイアウト層  Stack / Columns / Tiles   │  ← 余白は 9 段階のみ。外側の余白は部品が持たない
├─────────────────────────────────────────┤
│  部品層       ActionButton / AsyncForm   │  ← 状態を全部持つ。バックエンド非依存
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

## レイアウト — 余白を選ばせない

初心者が配置で詰まる原因は、自由度が高すぎることではなく
**選択肢が無限にあること**です。`8px` か `12px` かは、経験が無いと判断できません。
ビジュアルエディタでドラッグしても、その判断は必要なままです。

なので値そのものを減らしました。**余白はこの 9 段階しかありません。**

```
none   2xs   xs    sm    md    lg    xl    2xl   3xl
 0      4     8    12    16    24    40    64    96   (px / neutral テーマ)
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
| `ContentBlock` | 中身の最大幅だけ（本文は `width="narrow"`） |
| `Section` | ページ 1 区画。上下のリズムを統一 |
| `Stack` | 縦に等間隔で積む（最頻出） |
| `Inline` | 横に並べて、入り切らなければ折り返す |
| `Columns` / `Column` | 段組。既定でタブレット幅未満は縦に畳む |
| `Tiles` | 等間隔グリッド。要素数が半端でも崩れない |
| `Spread` | 両端に寄せる |
| `Box` | 内側の余白・背景・角丸・影 |
| `Divider` | 区切り線 |

段階ごとの実寸はテーマで変わります（`warm` は広め、`editorial` は詰めぎみ）。
つまり**余白の広さもトンマナの一部**です。

---

## 使い方

### 1. インストール（shadcn CLI）

コードは npm パッケージではなく**あなたのリポジトリに直接コピー**されます。
中身を自由に書き換えられるのが目的なので、これが正しい配り方です。

```bash
npx shadcn@latest add https://<あなたのホスト>/r/action-button.json
```

依存する `use-action` / `spinner` / `utils` は自動で一緒に入ります。

### 2. トンマナを当てる

```css
/* src/index.css */
@import "./styles/theme.css";
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
| `ActionProvider` | エラー処理の書き忘れを握り潰さない安全網（下記） |
| `Toast` / `useToast` | 画面隅の通知 |
| `ThemeProvider` / `ThemeSwitcher` | トンマナ切替。ちらつき防止スクリプトつき |
| `useAction` | 書き込み系の状態管理フック |
| `useResource` | 読み取り系の状態管理フック |

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
  lib/theme.css                 トンマナ 4 種 + 余白スケール
  lib/utils.ts                  cn()
  hooks/use-action.ts           書き込み系
  hooks/use-resource.ts         読み取り系
  components/ui/layout.tsx      レイアウト・プリミティブ
  components/ui/*.tsx           そのほかのコンポーネント

apps/playground/              ← React + Vite のカタログ（全状態を手で確認できる）
apps/site/                    ← Astro の静的サイト例（island 連携の確認）
scripts/                      ← レジストリ生成・検証・スクリーンショット
registry.json                 ← 配布定義（15 アイテム）
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
node scripts/build-registry.mjs   # public/r/*.json を生成
node scripts/verify-install.mjs   # 利用者プロジェクトへ展開して型検査
node scripts/verify-states.mjs    # 実ブラウザで非同期の全状態を検証
node scripts/verify-v02.mjs       # 実ブラウザでレイアウトと通知を検証
```

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
   <ActionButton action={…}>    →  <Button> + useAction()  →  useState / fetch
   <Stack space="lg">           →  <Box padding={…}>       →  className="…"
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
