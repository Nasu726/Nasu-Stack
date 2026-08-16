# v0.6 計画 — ナビゲーション・開閉部品・本文・画像

## この回で埋める穴

**足りない部品は、自分たちが手書きしている場所を探せば分かる。** 今回もそこから決めました。

| 手書きしている場所 | 足りない部品 |
|---|---|
| `apps/site/src/pages/index.astro` — 生の `class=""` が 19 箇所、レイアウト部品の使用 0 箇所、`min-h-11` の注意書きを手でコメント | **ナビゲーション** |
| `apps/playground/src/App.tsx` — タブが素の `<button aria-pressed>`。`role="tablist"` でも `role="tab"` でもない | **Tabs** |

作るものは 4 つです。

1. ナビゲーション一式（`SkipLink` / `SiteHeader` / `NavLink` / `MobileNav`）
2. 開閉部品 4 種（`Dialog` / `Tabs` / `Disclosure`・`Accordion` / `DropdownMenu`）
3. 本文スタイル（`prose.css`）
4. 画像の箱（`Frame`）

SEO / OGP / sitemap / RSS は**ページ雛型と同時**に回します（単体で作ると使いどころが決まらないため）。
入口（`npm create`）とフォームの送信先は今回やりません。

---

## 先に確かめたこと

**レイアウト部品は `.astro` の中でもそのまま動きます。**

React コンポーネントを Astro に非ハイドレートで置くと、children が `<astro-slot>` に
包まれて `Stack` の `gap` が効かなくなる恐れがありました。出力 HTML を見ると包まれず、
隙間も実測 24px で正しく出ています。

```html
<div class="flex flex-col wt-gap items-stretch" style="--wt-gap:var(--space-lg)">
  <div>A</div> <div>B</div> <div>C</div>
</div>
```

**Astro 版のレイアウト部品を別に作る必要はありません。** これは今回の設計の前提になります。

---

## 1. ナビゲーション一式

### 何を作るか

```tsx
<SkipLink />                       {/* 本文へ飛ぶ。Tab の 1 回目に必ず出る */}
<SiteHeader
  brand={<a href="/">Studio Nasu</a>}
  items={[                          {/* 関数ではなく配列。Astro の island に渡せる形 */}
    { href: "/works", label: "Works" },
    { href: "/blog",  label: "Blog"  },
  ]}
  currentPath={Astro.url.pathname}  {/* ルーターに依存しない唯一の移植可能な形 */}
  actions={<ThemeSwitcher />}
  sticky
/>
```

### 設計の決めどころ

**(a) モバイルメニューは `<dialog>` を使い回す。**
`ConfirmDialog` が既に native `<dialog>` + `showModal()` でフォーカストラップ・
背面の inert 化・Esc・top layer を解いています。ドロワーは見た目が違うだけなので、
**2 つ目の実装を持ちません**。CSS で全画面の右寄せに変えます。

**(b) Astro では island にするが、リンクは静的 HTML に出す。**
`client:idle` で載せます。JS が来る前でもリンクは押せて、
**ハンバーガーだけが遅れて有効になる**のが正しい劣化です。
`items` を配列で渡すのは、Astro の island が props を JSON 直列化するためです
（v0.2 で `ActionSpec` を足したのと同じ理由）。

**(c) 現在地は `currentPath` を props で受け取る。**
Astro は `Astro.url.pathname`、Vite の SPA は `location.pathname`、
将来 React Router を使うなら `useLocation()`。
**部品側がルーターを知らない**なら、どれでも動きます。

### 気をつけるところ（先に挙げておく）

- **sticky ヘッダとアンカーリンクは必ず衝突します。** `#contact` へ飛ぶとヘッダの下に
  見出しが隠れます。`scroll-margin-top` が要る。いま `tokens.css` に 1 つもありません。
  カタログのヘッダは既に `sticky top-0` なので、**現時点で壊れている可能性があります**。
- **`showModal()` は背面のスクロールを止めません。** 背面が inert になるだけです。
  指で触ると裏の本文が動きます（iOS Safari で顕著）。`overflow: hidden` が別途要る。
- **マウス端末ではナビのリンクが 20px になります。** `tokens.css` の base 層が 44px を
  保証するのは `pointer: coarse` のときだけ。DataTable の並べ替えボタンと同じ罠です。

---

## 2. 開閉部品 4 種

### Dialog

`ConfirmDialog` と土台を共有します。`ConfirmDialog` は `Dialog` の上に載せ直します。

- 罠: **`open` 属性を JSX に書くとモーダルになりません。** top layer にも入らず、
  `::backdrop` も出ません。`showModal()` を effect で呼ぶ必要があります
  （`ConfirmDialog` で経験済み）。
- 罠: `close` イベントは Esc でも背景クリックでも発火します。`onOpenChange` に集約します。

### Tabs

- 罠: **パネルを `hidden` にするかアンマウントするかで挙動が変わります。**
  `hidden` なら入力途中の値が残り、アンマウントなら消えます。どちらが正しいかは
  用途次第なので `unmountInactive` で選べるようにします。
- 罠: **roving tabindex。** `role="tab"` を全部 `tabIndex={0}` にすると、
  Tab キーでタブの数だけ止まります。選択中だけ 0、他は -1 にして、
  左右キーで移動するのが WAI-ARIA の形です。
- 罠: **URL 連動は最初から想定します。** カタログの `?tab=` でまさに必要になりました。
  制御コンポーネント（`value` / `onValueChange`）にしておけば、
  URL でもクエリでも state でも繋げます。
- 罠: タブが多いと横にはみ出します。`Scrollable` を使います（既存部品の再利用）。

**カタログのタブを、この `Tabs` に差し替えます。** 自分で使わない部品は必ず腐ります。

### Disclosure / Accordion

`<details>` / `<summary>` を使います。**JS 0 で開閉できる**ので Astro に最適です。

- 罠: `<summary>` の既定マーカーを `list-style: none` で消すと、
  **キーボードで開けることが見えなくなります**。自前の矢印を必ず付けます。
- 罠: 1 つだけ開く Accordion は `name` 属性（新しい HTML）で JS なしに書けます。
  **実ブラウザで排他になるか実測します。** ならなければ JS で補います。

### DropdownMenu

- 罠: **`role="menu"` をナビのリンク集に使ってはいけません。**
  `menu` / `menuitem` はアプリのコマンド用です。リンクの集まりに付けると
  読み上げが「メニュー項目」と言い、リンクだと分からなくなります。
  ナビのドロップダウンは `<ul><li><a>` のままで、開閉だけ制御します。
  **この 2 つは別部品として分けます**（`DropdownMenu` と `NavDropdown`）。
- 画面外に出ない配置と外側クリックは、`AsyncSelect` が既に解いています。
  **そこから切り出して共有します**（`use-dismiss` / `use-placement`）。

---

## 3. 本文スタイル（prose.css）

Markdown を流し込んだときの `h2` / `p` / `ul` / `blockquote` / `code` の見た目です。

- **`lib/prose.css` として独立させます。** 全員が要るものではないので `tokens.css` に入れません。
- **幅は持たせません。** 行長は `ContentBlock width="prose"` の担当です。
  両方が幅を持つと、和文 45em / 欧文 40em の基準が二重管理になります。
- **原則の例外を明記します。** 「コンポーネントは自分の外側の余白を持たない」を
  この回で初めて破ります。Markdown が吐く `<h2>` に `<Stack>` を挟めないためです。
  例外であることを README に書きます。
- 罠: `@layer components` に書けば利用者の `className` で上書きできます。
  base に書くと詳細度で勝ってしまい、上書きできません。
- 罠: `pre { overflow-x: auto }` は既に base 層にあります。競合しないことを確かめます。

---

## 4. 画像の箱（Frame）

**Astro には組込の `<Image>` があり、最適化までやります。対抗するものは作りません。**
作るのは**比率を先に確保する箱**だけで、中身は Astro の `<Image>` でも素の `<img>` でも入ります。

```tsx
<Frame ratio="16/9" fit="cover">
  <img src="/hero.avif" alt="" />
</Frame>
```

- 罠: **`loading="lazy"` を既定にすると、ヒーロー画像（LCP）が遅くなります。**
  `priority` を明示できるようにします。
- 罠: `tokens.css` の base 層に `img { height: auto }` があります。
  `aspect-ratio` + `object-fit: cover` と競合しないか確かめます。

---

## 5. 検査の追加

### (a) タブの一覧を単一の情報源にする

いまタブ名は 2 か所にあります。`App.tsx` の `TABS` と、`scripts/_browser.mjs` の `TABS`、
それに `verify.mjs` の `PLAYGROUND_TABS` で 3 か所です。
**今回タブを 1 つ足すので、必ずどれかを忘れます。** 前回塞いだ穴と同じ形です。

`apps/playground/src/tabs.mjs` を作り、App.tsx と検査スクリプトの両方がそこを読みます。

### (b) レイアウトシフト（CLS）の検査

画像は初心者が一番派手に壊す場所で、壊れ方は「読み込んだ瞬間に本文が下へずれる」です。
目で見ても気づきにくいので、`PerformanceObserver` の `layout-shift` で数値にします。
`check-responsive.mjs` に足します（利用者にも配られる検査なので、価値が高い）。

### (c) キーボード操作の検査

開閉部品はキーボードが本体です。`scripts/verify-nav.mjs` を新設し、
Tab / 矢印 / Esc / フォーカスの戻り先を実測します。

---

## 実測で確かめる項目

作る前に列挙します。ここに書いていないものは、たぶん見落とします。

### ナビゲーション

1. sticky ヘッダのある状態で `#contact` へ飛び、見出しがヘッダに隠れないか
2. モバイルメニューを開いた状態で、背面がスクロールしないか
3. 開いている間、Tab を 10 回押してもフォーカスがメニュー外へ出ないか
4. Esc で閉じ、フォーカスがハンバーガーに戻るか
5. Astro でヘッダを island にしたとき、JS 読込前の HTML にリンクが出ているか
6. `aria-current="page"` が Astro と React の両方で正しく付くか
7. ナビのリンクのタップ領域が、マウス端末でも 24px 以上あるか

### 開閉部品

8. `Dialog` が `:modal` にマッチするか（`open` 属性ではなく `showModal()` か）
9. `Dialog` と `ConfirmDialog` を同時に使っても `<dialog>` が二重に出ないか
10. `Tabs` で矢印キーが効き、Tab キーは tablist を 1 回で抜けるか
11. `Tabs` を `?tab=` に繋いだとき、ブラウザの戻る/進むで壊れないか
12. `Tabs` のタブが多いとき、潰れずに横スクロールになるか
13. `Disclosure` が JS 無効でも開閉できるか
14. Accordion の `name` 属性が実ブラウザで排他になるか
15. `DropdownMenu` を画面下部で開いても、候補が画面外へ出ないか
16. ナビのドロップダウンに `role="menu"` を使っていないか（リンクは `<a>` のまま）

### 本文・画像

17. prose の行長が和文 45em / 欧文 40em を超えないか（既存の検査がそのまま効く）
18. prose の `pre` が base 層の `overflow-x: auto` と競合しないか
19. prose のスタイルを `className` で上書きできるか（layer の順番）
20. 画像を含むページの CLS が 0 か
21. `priority` を付けた画像に `loading="lazy"` が付いていないか

### 全体

22. 新しいタブが、足しただけで検査対象に入るか（単一情報源になっているか）
23. 既存の 13 工程が緑のままか
24. `registryDependencies` の漏れが 0 か（`check-registry-deps.mjs`）

---

## 進める順

1. **タブの単一情報源化** — 先にやります。後だと必ず忘れます
2. **`scroll-margin-top` を tokens.css へ** — いま壊れている可能性があるので先に実測
3. `Dialog`（`ConfirmDialog` を載せ替え）
4. `Tabs` → **カタログのタブを差し替える**
5. `Disclosure` / `Accordion`
6. `DropdownMenu`（`AsyncSelect` から配置と外側クリックを切り出す）
7. ナビゲーション一式 → **`apps/site/index.astro` の手書き nav を置き換える**
8. `prose.css` / `Frame`
9. 検査の追加（CLS・キーボード）
10. `pnpm verify` → README / ROADMAP

**4 と 7 が要です。** 作った部品で自分のカタログとサイトを書き直せなければ、
その部品は使い物になっていません。
