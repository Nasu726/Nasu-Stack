# v0.3.5 — リファクタリング計画

部品を増やす前に、土台を整える提案です。**推測ではなく実際に数えた結果**をもとにしています。

---

## 1. 現状の数字

### 配布される本体（registry/）— 3,757 行

| ファイル | 行数 | |
|---|---:|---|
| `components/ui/layout.tsx` | 707 | |
| `lib/theme.css` | 557 | ⚠️ 2 つの関心事が混在 |
| `components/ui/async-form.tsx` | 293 | |
| `scripts/check-responsive.mjs` | 291 | |
| `components/ui/toast.tsx` | 242 | |
| `lib/action.ts` | 239 | |
| `hooks/use-action.ts` | 234 | |
| `components/ui/action-button.tsx` | 220 | |
| ほか 9 ファイル | 974 | |

### デモ（apps/）— 1,587 行

| ファイル | 行数 | |
|---|---:|---|
| `playground/src/App.tsx` | 445 | ⚠️ 自分のレイアウト部品を使っていない |
| `playground/src/LayoutDemo.tsx` | 361 | ⚠️ `Panel` が重複 |
| `playground/src/ResponsiveDemo.tsx` | 256 | ⚠️ `Panel` が重複 |

### 検証スクリプト（scripts/）— 929 行 / 10 本

| ファイル | 行数 | |
|---|---:|---|
| `audit-responsive.mjs` | 185 | ⚠️ `check-responsive.mjs` に完全に置き換わった。**死んでいる** |
| `verify-v02.mjs` | 143 | ⚠️ 版数が名前に入っていて陳腐化する |
| `verify-install.mjs` | 113 | |
| `verify-states.mjs` | 100 | |
| `verify-states2.mjs` | 59 | ⚠️ 一度きりの追試。本体に統合すべき |
| ほか 5 本 | 329 | |

---

## 2. 見つかった問題

### P1. `theme.css` に別々の関心事が同居している（557 行）

いま 1 ファイルに 2 つのものが入っています。

- **テーマ（約 300 行）** — 4 テーマ × light/dark の色・角丸・書体
- **土台（約 250 行）** — 余白トークン、`wt-*` ユーティリティ、端末幅で壊れないための base CSS

**実害**: 自分の色に差し替えたい人が、土台ごと書き換えることになります。
「トンマナを選べる」が売りなのに、**5 個目のテーマを足す手順が存在しない**。

配布単位としても不自然で、いま `@nasu/layout` は `@nasu/theme` に依存しています。
レイアウトが欲しいだけの人に 4 テーマ分の色が付いてきます。

### P2. デモが自分の部品を使っていない

`App.tsx` の「状態」タブは生の Tailwind で組まれたままです。

```tsx
<section className="flex flex-col gap-4">          // ← Stack があるのに
  <div className="flex flex-col gap-1.5">          // ← Stack があるのに
  <div className="rounded-xl border ... p-5">      // ← Box があるのに
  <div className="flex flex-wrap items-start gap-6">// ← Inline があるのに
  <div className="max-w-md">                       // ← ContentBlock があるのに
```

**実害が 3 つあります。**

1. **見本になっていない。** 利用者が最初に読むコードが、部品の使い方を示していない
2. **名前が衝突している。** `App.tsx` のローカル `Section` が、レイアウトの `Section` と同名
3. **レスポンシブ回帰の温床。** 生の値は `npm run check` を通っても、次に触ったとき壊れやすい

### P3. ちらつき防止スクリプトが 3 箇所にコピーされている

同じロジックが独立に 3 つあります。

- `registry/nasu/components/ui/theme-provider.tsx` の `themeInitScript`（エクスポート済み、**誰も使っていない**）
- `apps/playground/index.html` に手書き
- `apps/site/src/layouts/Base.astro` に手書き

**実害**: 1 箇所だけ直し忘れると、そのページだけ初回描画でちらつきます。
気づきにくい類のバグです。

### P4. 死んだスクリプトと、版数依存の名前

- `audit-responsive.mjs`（185 行）は `check-responsive.mjs` に置き換わり済み。**消し忘れ**
- `verify-states2.mjs`（59 行）は追試用の使い捨て
- `verify-v02.mjs` — v0.3 でレイアウト以外も検証しているのに名前が v02 のまま

検証が 5 本に散っていて、**全部走らせる 1 コマンドがありません**。手で順番に叩いています。

### P5. CI が無い

検証スクリプトが 5 本あるのに、動かすのは手作業です。
ROADMAP に「create-t3-app は 9 か月止まった」と書いておきながら、
**依存更新で壊れても気づけない状態**です。自分で指摘した問題に自分が該当しています。

### P6. 細かい命名

`Columns_`（末尾アンダースコア）— `Columns` コンポーネントとの衝突を避けただけの名前。
公開 API なので `TileColumns` にすべきです。

---

## 3. やること（v0.3.5）

### R1. `theme.css` を 2 つに割る

```
styles/tokens.css   余白・幅・wt-* ユーティリティ・壊れない土台   （テーマ非依存）
styles/themes.css   4 テーマの色・角丸・書体                      （差し替え可能）
```

レジストリも分けます。

| アイテム | 中身 | 依存 |
|---|---|---|
| `@nasu/tokens` | 土台。これだけで layout が動く | なし |
| `@nasu/theme` | 4 テーマ | `@nasu/tokens` |
| `@nasu/layout` | レイアウト部品 | `@nasu/tokens`（theme ではなく） |

**得られるもの**: 自分の色だけ書けばテーマを作れるようになります。
「5 個目のテーマを足す」手順を README に書けます。

### R2. デモを自分の部品で組み直す

- 共通の `Panel` を 1 つに（`apps/playground/src/Panel.tsx`）
- `App.tsx` のローカル `Section` を廃止し、レイアウトの `Section` / `Stack` / `Box` / `ContentBlock` に置換
- 生の `flex flex-col gap-*` / `p-5` / `max-w-md` を一掃

**得られるもの**: 見本として成立します。行数もかなり減る見込みです。

### R3. ちらつき防止スクリプトを 1 箇所に

`themeInitScript` を実際に使う形にして、HTML と Astro の手書きコピーを消します。
Astro 側は `<script is:inline set:html={themeInitScript} />` で参照できます。

### R4. スクリプトの整理（10 本 → 6 本）

```
削除   audit-responsive.mjs       （check-responsive.mjs に置換済み）
統合   verify-states2.mjs      →  verify-states.mjs
改名   verify-v02.mjs          →  verify-layout.mjs
新規   verify.mjs              →  上記を順に走らせる 1 本

pnpm verify   型検査 + ビルド + 全ブラウザ検証 + 利用者側への展開検査
pnpm check    端末幅の崩れ検出
```

### R5. GitHub Actions

push とプルリクごとに `pnpm verify` と `pnpm check` を回します。
Renovate を入れて、依存更新の PR が緑なら安心して上げられる状態にします。

**これが「テンプレは腐る」への唯一の実効的な対策です。**

### R6. `Columns_` → `TileColumns`

---

## 4. やらないこと

### `layout.tsx`（707 行）の分割

読みづらいのは事実ですが、**分けません。**
shadcn は 1 アイテム = 1 ファイルで配るので、10 個に割ると
利用者のプロジェクトに 10 ファイル増えます。
レイアウト部品は互いに参照し合うので、依存も 10 本に増えます。

**読みやすさより配布の単純さを取ります。** ファイル内の区切りコメントで十分です。

---

## 5. なぜ部品を増やすより先か

1. **いま直すのが一番安い。** 部品は 6 個。`DataTable` や `AsyncSelect` を足してから
   デモを組み直すと、対象が倍になります
2. **CI が無いまま増やすと、v0.3 で入れた土台が回帰しても気づけません。**
   実際 v0.2 → v0.3 で 3 つの罠を踏んでいます（`--spacing-*` の衝突、`@theme static`、
   iOS の自動拡大）。どれも人力で見つけました
3. **テーマを差し替えられないままだと「トンマナを選べる」が主張倒れになります。**
   4 つから選ぶだけなら、Wix の方が選択肢が多い

---

## 6. 未検証の懸念（このリファクタで確認する）

- `Stack dividers` — `gap` と `divide-y` を併用したときの線の位置を目視確認していません
- `Inline wrap={false}` + `min-width: 0` — 子が潰れすぎないか未確認
- `Scrollable axis="both"` — 縦横同時のときの影の出方が未確認
