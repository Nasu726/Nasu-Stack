# WebTemplate

**関数をひとつ渡すだけで、状態のある UI が完成する。**

見た目だけのコンポーネント集ではありません。読込中・成功・失敗・空・二重送信・中断
— 毎回書くことになる状態の面倒を、コンポーネント側が全部持ちます。

```tsx
<ActionButton action={() => api.save(form)}>保存する</ActionButton>
```

この 1 行に、以下が全部入っています。

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

## 3 つの層

```
┌─────────────────────────────────────────┐
│  トンマナ層   theme.css                  │  ← 色・角丸・影・書体を data-theme で切替
├─────────────────────────────────────────┤
│  コンポーネント層  ActionButton / …      │  ← 状態を全部持つ。バックエンド非依存
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
| `ThemeProvider` / `ThemeSwitcher` | トンマナ切替。ちらつき防止スクリプトつき |
| `useAction` | 書き込み系の状態管理フック |
| `useResource` | 読み取り系の状態管理フック |

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
registry/nasu/          ← 配布されるソース。ここが本体
  lib/action.ts           契約・エラー正規化・ActionSpec
  lib/theme.css           トンマナ 4 種
  lib/utils.ts            cn()
  hooks/use-action.ts     書き込み系
  hooks/use-resource.ts   読み取り系
  ui/*.tsx                コンポーネント

apps/playground/        ← React + Vite のカタログ（全状態を手で確認できる）
apps/site/              ← Astro の静的サイト例（island 連携の確認）
scripts/                ← レジストリ生成・スクリーンショット・状態検証
registry.json           ← 配布定義
public/r/*.json         ← 生成物（shadcn CLI が読む）
```

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
node scripts/verify-states.mjs    # 実ブラウザで全状態を検証
```

---

## 設計上の約束

1. **バックエンドを固定しない。** fetch でも Supabase でも Convex でも、
   `(input, ctx) => Promise<output>` の形にできれば何でも刺さります。
2. **エスケープハッチを必ず残す。** `ActionButton` の下には素の `Button` があり、
   `AsyncForm` の下には `useAction` があります。抽象が邪魔になったら 1 段降りられます。
3. **エラーは必ず 1 つの型に揃える。** 何が throw されても `ActionError` になるので、
   表示側が分岐する必要がありません。
4. **アクセシビリティは既定で入れる。** 後付けしない。

---

## ライセンス

MIT
