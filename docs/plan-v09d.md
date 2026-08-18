# v0.9d — 幅の制御を実測で直し、shadcn のレジストリに登録する

## Context

v0.9c の PR で verify を待っている間に、作者がカタログを見て 9 件を挙げました。
あわせて配布の方針が変わりました（tarball のみ → **shadcn のレジストリにも登録**）。

指摘を手元で全部測ったところ、**バラバラに見えた 5 件が 1 つの原因**に行き着き、
**1 件は v0.9c で私が入れた後退**でした。以下はすべて実測値です
（`BASE_PATH=/WebTemplate` で `public/` を配り、実ブラウザで計測）。

### 測った結果

| # | 症状 | 実測 | 原因 |
|---|---|---|---|
| 1 | ハンバーガーの中身が切れる | 枠は `bottom=794`（高さ 107）、項目は `bottom=948` → **154px 切れ** | デモの枠の `overflow-hidden` |
| 2 | タブがタッチパッドで動かない | — | v0.9c で入れた「縦→横」変換。**横（`deltaX`）を見ていない** |
| 3 | ヘッダのタブが窮屈 | 1440: 必要 951 / 器 1024（余り 73）。**375: タブの可視幅 13px**（中身 530px） | **v0.9c で私が `max-w` を `flex-1` に変えた後退** |
| 4 | dividers の余白が変わらない | — | 部品は正しい。**デモが `space="md"` 固定** |
| 5 | 半画面で `width="1/3"` が全幅、`auto` が縮む | 親 678 に対し `auto` が **179px / 48px** | 畳んだとき `items-start` が**横方向**に効く |
| 6 | 画像が出ない／比率の例が崩れる | `naturalWidth=0`、Frame が **24px / 24px / 31px** | `IMAGE` が root 相対（base 無し）＋ 上の #5 と同じ |
| 9 | デモのテーマがカタログに連動 | `/demo/lp/` は `data-theme="warm"` のはずが **`vivid` + dark** | `localStorage` のキーが共通、デモに切り替えボタン無し |

**#5 と #6 の後半は同じ原因**です。`Columns` は畳むと `flex-col` になりますが、
`alignY`（`items-start`）はそのまま残ります。**列方向では `items-*` は横方向の指定**
なので、幅を持たない列が中身の幅まで縮みます。

**直し方も実測で確かめました。**
`.wt-col{width:100%}` を当てたら**行方向が壊れました**（`auto` 列が 0px）。
正しいのは「**畳んでいる間だけ `items-*` を外す**」で、当てると全列が 678px に揃います。

### #3 は私の後退です

v0.9c で「半画面で無駄にスクロールする」を直すとき、`max-w-[min(38rem,60vw)]` を
`min-w-0 flex-1` に変えました。半画面は直りましたが、**375px ではタブが 13px に
潰れました。** `check-responsive` は「はみ出し」しか見ないので、
**潰れは 1 つも検出しません。**

---

## Phase A — 配布物（`registry/nasu`）

### A-1. `Columns` の畳み方（#5 / #6 後半）

`registry/nasu/components/ui/layout.tsx` の `Columns`。
`ALIGN_Y[alignY]` を**行になる幅でだけ**当てます。畳んでいる間は既定（`stretch`）。

```ts
// Tailwind は文字列を静的に探すので、接頭辞つきを literal で持ちます
const ALIGN_Y_AT = {
  tablet:  { start: "md:items-start", center: "md:items-center", end: "md:items-end", baseline: "md:items-baseline" },
  desktop: { start: "lg:items-start", center: "lg:items-center", end: "lg:items-end", baseline: "lg:items-baseline" },
} as const;
```

`collapseBelow: null` のときだけ既存の `ALIGN_Y` を使います。

### A-2. `Scrollable` の横スクロール（#2 / #8）

`registry/nasu/components/ui/scrollable.tsx`。

- **`wheelX`（縦→横の変換）を削除します。** 作者が明確に嫌っているうえ、
  コード例や表の上でページの縦読みが止まる副作用がありました
- 代わりに**横の動き（`deltaX`）を拾って `scrollLeft` に流します**。
  `Inline wrap={false}`（`wt-nowrap` = `overflow-x:auto` だけ）と挙動を揃えます
- `axis="x"` のとき `overflow-y-hidden` をやめ、`wt-nowrap` と同じ形にします
- `scrollbar?: "auto" | "hidden"`（既定 `auto`）を足します。
  `hidden` は `scrollbar-width:none` と `::-webkit-scrollbar{display:none}`。
  **端の影は消しません**（消すとスクロールできることが分からなくなります）

`Tabs` は `<Scrollable wheelX>` をやめ、`scrollbar` をそのまま通します。

### A-3. テーマの保存先を分ける（#9）

`registry/nasu/components/ui/theme-provider.tsx`。

- `STORAGE_KEY` 固定をやめ、`storageKey` を `ThemeProvider` の props と
  `themeInitScript(options)` の引数にします（既定は今の `webtemplate.theme`）
- **`themeInitScript` に「明暗だけ」の形を足します。**
  `data-theme` を書き換えず、`.dark` の付け外しだけをします
- `ThemeSwitcher` に `themes={false}` 相当（明暗ボタンだけ）を足します

**同じ origin に 2 つのサイトを置くと必ずぶつかります。**
これは配布物の欠陥で、利用者が `/app/` と `/docs/` を同じドメインに置いても起きます。

### A-4. 画像のパス（#6 前半）

これはカタログ側（`apps/playground/src/TextDemo.tsx` の `IMAGE`）ですが、
**同じ間違いが利用者にも起きます。** `withBase()` の説明に
「`<img src>` も手書きなら base は付きません」を足します。

---

## Phase B — カタログとデモ

| 場所 | 直すこと |
|---|---|
| `NavDemo.tsx` | 枠の `overflow-hidden` を外す（#1）。角丸は残ります |
| `App.tsx` のヘッダ | **`lg` 未満は 2 段**（1 段目 = ブランド + テーマ、2 段目 = タブ全幅）。`lg` 以上は今のまま 1 行。`flex-1` はやめる（#3） |
| `LayoutDemo.tsx` | dividers の例を `space={space}` に繋ぐ（#4） |
| `TextDemo.tsx` | `IMAGE` に `withBase()`（#6） |
| `apps/site/src/layouts/Base.astro` | 明暗だけの切り替えを置き、保存先を `webtemplate.site.theme` に。`data-theme` はページが決めた値のまま（#9） |

`lg`（1024px）にする根拠: 1440 のとき器 1024 に対して必要 951（余り 73）。
器が 980 を切ると 1 行に入りません。

---

## Phase C — 検査（#7）

**「はみ出し」しか見ていないので、「潰れ」は 1 つも検出できていません。**
実際、タブの 13px も `auto` 列の 48px も全部緑でした。

`registry/nasu/scripts/check-responsive.mjs` に**潰れの判定**を足します。

- 対象: `.wt-col` / `.wt-frame` / `[role="tablist"]` の器 / `Tiles` の子
- 判定: 縦に積まれている親の中で**親の幅の 40% 未満**になっているもの、
  および**スクロールできる器が 1 項目分より狭い**もの
- 幅: いまと同じ 5 段階（320 / 375 / 768 / 1024 と実寸）

`scripts/verify-parts.mjs` などと同じく、**わざと壊して赤くなることを確かめてから**
入れます（`items-start` を戻す / `flex-1` を戻すの 2 通り）。

これが #7 の「全部の部品を 1 つずつ実測する」への答えです。
**一度目で見るのではなく、毎回機械が見ます。**

---

## Phase D — shadcn のレジストリに登録

作者の判断: **ディレクトリ登録のみ。npm publish はしません。**
（[docs](https://ui.shadcn.com/docs/registry/registry-index) より、登録に npm は不要）

入口の CLI は今までどおり tarball の URL です。

### D-1. 公開する形を要件に合わせる

| 要件 | いま | すること |
|---|---|---|
| 公開 URL に `registry.json` | `r/index.json` | **`r/registry.json` を出す**（`index.json` は当面残す） |
| `$schema` / `name` / `homepage` | 無し | 足す |
| `items[]` に `files[{path,type}]` | `files` 自体が無い | 足す |
| `items[].files[].content` は**入れない** | 個別 JSON にのみ入っている | そのまま（一覧には入れない） |
| 個別 JSON が root に平置き | ✓ `r/<name>.json` | そのまま |

`scripts/build-registry.mjs` を直し、`scripts/verify-published.mjs` に
**`registry.json` が取れて schema に合う**判定を足します。

### D-2. 登録の PR

`shadcn-ui/ui` の `apps/v4/registry/directory.json` に項目を足し、
`pnpm validate:registries` を通してから PR を出します。
**これは別リポジトリへの PR なので、作者の判断で出してください。**
こちらは項目の JSON を用意して `docs/` に置きます。

### D-3. 文書

`SECURITY.md` / `README.md` / `HowToUse` の「npm には publish しません」は
**そのまま正しい**ので変えません。「shadcn のディレクトリに載っている」ことと
「npm には無い」ことを並べて書きます（混同されると危ないので）。

---

## 触るファイル

**配布物**
- `registry/nasu/components/ui/layout.tsx`（`Columns` の畳み方）
- `registry/nasu/components/ui/scrollable.tsx`（横ホイール / `scrollbar`）
- `registry/nasu/components/ui/tabs.tsx`（`wheelX` をやめる）
- `registry/nasu/components/ui/theme-provider.tsx`（`storageKey` / 明暗だけ）
- `registry/nasu/lib/base.ts`（`<img src>` の注意書き）
- `registry/nasu/scripts/check-responsive.mjs`（潰れの判定）

**カタログ / デモ**
- `apps/playground/src/{App,NavDemo,LayoutDemo,TextDemo}.tsx`
- `apps/site/src/layouts/Base.astro`

**配布**
- `scripts/build-registry.mjs` / `scripts/verify-published.mjs`
- `docs/shadcn-directory-entry.json`（PR に貼る中身）

---

## 検証

| | 何をもって完了とするか |
|---|---|
| A-1 | 760px で `auto` 列が **179 → 678px**。1440px では今までどおり（1/3 = 314px） |
| A-2 | 横ホイールでタブが動く。**縦ホイールでは動かない**（ページが縦に動く） |
| A-3 | カタログで vivid+dark にしても、`/demo/lp/` は `data-theme="warm"` のまま |
| B（#3） | 375 / 500 / 760 / 1024 / 1440 で、タブの可視幅が **1 項目分以上** |
| B（#6） | 画像が `naturalWidth > 0`。Frame の比率例が 24px → 親幅いっぱい |
| C | **わざと壊して赤くなる**ことを 2 通りで確認してから入れる |
| D | `verify-published` が `registry.json` を schema ごと確かめる |

各 Phase の終わりに `pnpm verify` と `pnpm verify:create` を通します。
`docs/handoff.md` と `docs/plan-v09d.md` / `docs/result-v09d.md` を残します。

---

## お願いすること

1. **v0.9c の PR をマージ**（この計画は v0.9c の上に積みます）
2. **shadcn-ui/ui への PR** — 別リポジトリなので作者から出してください。
   貼る中身は `docs/shadcn-directory-entry.json` に用意します
3. required status check に `verify-create` を足すかの判断（v0.9c からの持ち越し）
