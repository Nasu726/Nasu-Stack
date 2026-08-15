# ROADMAP

## v0.1 — 完了

契約層とトンマナ層が固まり、状態を持つコンポーネントが動いています。

- [x] `Action` / `ActionSpec` / `ActionError` の契約
- [x] `useAction`（二重送信防止・中断・自動リトライ・自動リセット）
- [x] `useResource`（依存キーでの再取得・アンマウント中断）
- [x] トンマナ 4 種 × light/dark
- [x] `ActionButton` / `AsyncForm` + `Field` / `DataList` / `AsyncBoundary`
- [x] `ThemeProvider` / `ThemeSwitcher` / ちらつき防止スクリプト
- [x] React + Vite のカタログ / Astro 静的サイト + island 連携
- [x] shadcn レジストリ生成 + 利用者プロジェクトでの型検査

## v0.2 — 完了

「配置で苦しむ」への答えと、エラー処理の安全網。

- [x] **レイアウト・プリミティブ**
      `Box` / `Stack` / `Inline` / `Columns` + `Column` / `Tiles` / `Spread` /
      `PageBlock` / `ContentBlock` / `Section` / `Divider`
- [x] 余白スケール 9 段階。テーマごとに実寸が変わる
- [x] **段階外の値も書ける**（`space="13px"` / `"clamp(...)"` / `width="18rem"` /
      `columns="repeat(auto-fill, minmax(14rem, 1fr))"`）。
      段階は既定値であって制約ではない
- [x] 画面幅ごとの指定（`space={{ mobile: "sm", tablet: "3rem" }}`。段階と任意の混在も可）
- [x] `Columns` は既定でタブレット幅未満に縦へ畳む
- [x] `ActionDefaults` / `ActionProvider` / `Toast` / `useToast`
- [x] 二重表示の抑制ルール（画面内に出せているものは通知しない）
- [x] 実ブラウザ検証（`scripts/verify-v02.mjs`）

### v0.2 で踏んだ罠（同じことを繰り返さないための記録）

**1. 余白トークンを Tailwind 標準の `--spacing-*` 名前空間に入れてはいけない。**
`--spacing-sm: 0.75rem` を定義すると `max-w-sm` が 24rem ではなく 0.75rem になります。
`sm` / `md` / `lg` は t シャツサイズと衝突するためです。
`@utility gap-* { gap: --value(--space-*); }` の形で独自ユーティリティとして
定義すれば、標準クラスを一切壊しません。

**2. `@theme` は `static` を付けないと変数が消える。**
既定の `@theme` は「CSS 内で使われている変数」しか出力しません。
段階の値をインライン style から `var(--space-3xl)` として参照する設計にすると、
Tailwind からは未使用に見えて変数ごと削除され、余白が 0 になります。
`@theme static { ... }` が必須です。

**3. 制約は壁ではなく既定値にする。**
最初は `space` の型を 9 段階のリテラルに固定しましたが、
「自由度の確保」という目的と、自分で書いた設計原則②（エスケープハッチを必ず残す）に
反していました。`SpaceToken | (string & {})` にすることで、
補完には段階だけを出しつつ任意の値も受けられます。

## v0.3 — 完了

端末幅で崩れないこと、崩れていないと確かめられること。

- [x] 壊れない土台（折り返し / メディアの最大幅 / `pre` のスクロール / `min-width:0`）
- [x] 触れる端末でのタップ領域の最低保証（`@media (pointer: coarse)`）
- [x] 入力欄を常に 16px 以上に（iOS の自動拡大を止める）
- [x] `Scrollable` — 縮められない中身をその部分だけ横スクロールに
- [x] `ContentBlock width="prose"` — em 単位で文字サイズに追従する本文幅
- [x] `npm run check` — 5 つの幅で機械的に検出。崩れがあれば終了コード 1
- [x] カタログに端末プレビュー（実ブラウザ幅で iframe 表示）
- [x] 監査スクリプト 2 本（`audit-stress` / `check-responsive`）

### 実測（v0.3 適用前 → 後）

```
折り返せない長い URL       320px で 577px はみ出し  →  ✓
長い英単語の羅列           320px で 349px はみ出し  →  ✓
入力欄の font-size         全 7 箇所が 16px 未満    →  ✓
タップ領域                 2 件が 24px 未満         →  ✓
1 行の長さ                 6 件が長すぎ             →  ✓
```

`npm run check` が 2 ページ × 5 幅すべてで緑になりました。

### v0.3 で踏んだ罠

**1. スクロール領域の中身を「はみ出し」と誤検出した。**
`pre` や `Scrollable` の中身は親の外へ出ていて当然です。
祖先に `overflow-x: auto|scroll|hidden` があるかを見て除外する必要があります。

**2. 1 行の長さの閾値を欧文基準で作ってしまった。**
和文は 1 文字がほぼ 1em、欧文は平均 0.5em 前後。同じ 704px でも
欧文なら 100 字、和文なら 50 字で、読みやすさが倍違います。
和文比率を見て閾値を変えないと、日本語サイトが常に誤検出されます。

**3. `md:text-sm` では iOS の自動拡大を防げない。**
拡大は画面幅ではなくフォントサイズで起きるので、iPad でも発生します。
入力欄は常に 16px 以上にするしかありません。

## v0.3.5 — 完了（リファクタリング）

部品を増やす前に土台を整えました。

- [x] `theme.css`（557 行）を `tokens.css`（土台 + 既定テーマ）と
      `themes.css`（追加 3 テーマ）に分割。**自分のテーマを作れるようになった**
- [x] レジストリも `@nasu/tokens` と `@nasu/theme` に分離。
      `@nasu/layout` は tokens にだけ依存（テーマ無しでも動く）
- [x] デモを配布物のレイアウト部品で組み直し。生の `flex flex-col gap-*` を一掃
- [x] `Panel` の重複を解消し、`App.tsx` のローカル `Section` の名前衝突を解消
- [x] ちらつき防止スクリプトの 3 重重複を解消（定義は `themeInitScript` の 1 箇所だけ）
- [x] スクリプト 10 本 → 8 本。死んでいた `audit-responsive.mjs` を削除、
      `verify-states2` を統合、`verify-v02` → `verify-layout` に改名
- [x] `pnpm verify` で 10 項目を 1 コマンド実行
- [x] GitHub Actions（push / PR / 週 1）+ Renovate
- [x] `Columns_` → `TileColumns`

### リファクタ中に見つけて直したもの

**1. `Stack dividers` の線が左右非対称だった。**
`divide-y` は要素の下端に線を付けるので、`gap` と併用すると
線の上が 0、下が gap 分になります。区切り線を**実際の要素として差し込む**形に変更し、
上下とも同じ余白（実測 24px / 24px）になりました。

**2. `Inline wrap={false}` が子を潰していた。**
`.wt-gap > * { min-width: 0 }` が効いて、幅 400px に 3 つ入れると
261/163/49px まで圧縮されていました。折り返さない指定なら
**潰さず横スクロール**が正しいので（`Scrollable` と同じ考え方）、
`min-width` を解除して `overflow-x: auto` にしました。

## v0.4 — 完了

状態を持つ部品を 4 つ。**見た目だけの部品は引き続き作っていません。**

- [x] `ConfirmDialog` / `useConfirm` — native `<dialog>`。Provider が無ければ
      `window.confirm` に落ちるので、置かなくても壊れない
- [x] `DataTable` — 並べ替え・ページング。**狭い画面では 1 行 = 1 カードに組み替え**
- [x] `AsyncSelect` — debounce + 前の要求の自動中断 + WAI-ARIA combobox
- [x] `FileDrop` + `uploadWithProgress` — 進捗つき、1 ファイルずつ、失敗分だけ再送
- [x] カタログに「部品」タブ
- [x] `scripts/verify-parts.mjs`（14 項目）を `pnpm verify` に追加 → 全 11 項目

### 計画に書いた「実測で確かめる項目」の結果

計画段階で 10 個列挙しておいたものを全部測りました。

```
1. dialog::backdrop     rgba(0,0,0,0.45) が効く。:modal にも一致（top layer）
2. Provider 無しの confirm  window.confirm に落ちる
3. Scrollable 内の表     min-width 576px で潰れない
4. 320px 最下部の候補    上向きに出て画面内に収まる（自前実装で足りた）
5. キーボード操作        ↑↓ で activedescendant が動き、Enter で確定
6. XHR の中断            signal で abort される
7. 失敗分だけ再送        2 件中 1 件失敗 → 再送ボタンは 1 つ
8. pnpm check            2 ページ × 5 幅すべて緑
9. カードの列名          日付/案件/状態/件数/金額 が全部読める
10. 打ち直しの競合        古い候補が残らない
```

**AsyncSelect の位置決めは自前で足りました。** 320px・画面最下部で
候補が上向きに出て、画面内（上端 292 / 下端 552 / 画面高 600）に収まりました。
floating-ui への差し替えは不要と判断します。

### v0.4 で見つけて直したもの

**エラーが二重に出ていた。** FileDrop が失敗を行内に出しつつ
`ActionProvider` の通知にも流していました。
v0.2 で決めた「画面内に出せているものは通知しない」に反していたので、
`onError` を任意の口として切り出し、既定では通知しないようにしました。

**`id` が固定で衝突していた。** FileDrop の `<input type="file">` が
`id="wt-file-input"` 固定だったので、1 画面に 2 つ置くと `label` の
関連付けが壊れます。`useId` に変更。

## v0.5 — 完了

- [x] **`AsyncForm` の FormData バグ修正**（入力部品の前提）
- [x] 入力部品 `SelectField` / `CheckboxField` / `CheckboxGroup` /
      `RadioGroup` / `DateField`
- [x] `DataTable` の行選択（キーで保持・Shift+クリック・カード表示にも対応）
- [x] `useOptimisticList` — 楽観更新と、失敗した操作だけのロールバック
- [x] カタログに「入力/選択」タブ
- [x] `scripts/verify-forms.mjs`（15 項目）を追加 → `pnpm verify` は 12 項目に

### 計画に書いた「実測で確かめる項目」の結果

```
 1. indeterminate     プロパティとして true、属性としては存在しない ✓
 2. ページ移動        1 件選択中 → 表示中を全選択で 6 件 ✓
 3. 伝播しない        チェックで onRowClick が発火しない ✓
 4. 並べ替え          選択件数 4 件を維持 ✓
 5. Shift+クリック    0→3 の範囲で 4 件 ✓
 6. 追加失敗          削除した項目が復活しない ✓
 7. 直列化            同一キーの update を順に流す ✓
 8. 再取得            保留中: あり → あり（消えない）✓
 9. 複数選択          langs が配列 3 件 ✓
10. 未チェック        agree が "" として届く ✓
11. タップ領域        ラベルの高さ 44px ✓
12. 日付の文字        16px ✓
13. RadioGroup       fieldset + legend ✓
14. pnpm check       2 ページ × 5 幅すべて緑 ✓
```

### v0.5 で見つけて直したもの

**1. `AsyncForm` が複数値を取りこぼしていた（計画段階で発見）。**
`Object.fromEntries(fd.entries())` は同じキーが複数あると最後だけ残すので、
`<select multiple>` で 3 つ選んでも 1 つしか送られませんでした。
同名を配列に畳む `formDataToObject` に置換。
未チェックのチェックボックスは FormData に現れないため、
隠し入力で目印を送り、`""` として必ず届くようにしました。

**2. 整形した列を、整形後の文字列で並べ替えていた（検証中に発見）。**
`get: (r) => \`¥${r.amount.toLocaleString()}\`` のような列を並べ替えると、
`¥2,600` が `¥12,400` より後ろに来ていました（"2" > "1" のため）。
並べ替えは **`get` の結果ではなく元の値**を使うように変更し、
別のキーで並べたいとき用に `sortValue` を足しました。
数値らしい文字列も数値として比較します。

**3. ソースに NUL バイトが混入していた。**
チェックボックスの目印文字列に制御文字が入り、ファイルがバイナリ扱いに
なっていました。`__wt_unchecked__` に変更。

## v0.5.5 — 完了（リファクタリング）

詳細は [docs/refactor-v05.md](docs/refactor-v05.md)。

**この回の要点は「検査の穴」でした。** `pnpm check` はカタログの URL を 1 つしか
渡しておらず、カタログはタブで中身が入れ替わる画面だったので、
**v0.4 と v0.5 の部品は 320px で一度も検査されていませんでした。**

### 直したもの

| | 内容 |
|---|---|
| 検査の穴 | 端末幅の検査対象を 1 ページ → 6 ページ（全タブ）へ。`?tab=` を実装 |
| 検査の誤り | sr-only の入力／`<label>` の当たり判定／スクロール領域内の `min-width`／URL を「長い行」と呼ぶ、の 4 種の誤検知 |
| 本物の指摘 | 表の中のチェックボックス 20×20、並べ替えボタン 44×20、デモの裸のチェックボックス |
| 配布物 | `registryDependencies` の漏れ **9 項目**。`check-registry-deps.mjs` を新設して常設 |
| 中断 | `useOptimisticList` の `AbortController` が誰にも中断されていなかった |
| 重複 | 入力欄の class が 4 か所にコピー → `inputClass()` へ集約 |
| id | `ConfirmProvider` の固定 id を `useId` へ |

### 覚えておくこと

- **画面がタブや分岐で切り替わるなら、検査対象も切り替えないと意味がない。**
  「検査は通っている」と「検査対象に入っている」は別のことです。
- **`registryDependencies` の漏れは、このリポジトリでは絶対に再現しません。**
  全ファイルが揃っているからです。壊れるのは利用者のところだけ。
  だから import 文から機械的に突き合わせる検査が要ります。
- **表の中で `w-full` は効かない。** 列幅は中身から決まるので循環します。`min-width` を使います。
- **`new AbortController().signal` を渡すのは、中断できるふりでしかない。**
  controller を誰かが持っていて、いつか `abort()` を呼ばないと意味がありません。

## 積み残し（優先度順）

- [ ] `Field` にリアルタイム検証（送信前に気づける）
- [ ] `DataTable` の列の表示/非表示切り替え
- [ ] 一括操作の進捗表示（`selectionActions` から `useAction` へ繋ぐ）

## v0.6 — テンプレート化

レイアウト部品が揃ったので、ページ雛型が「組み合わせ」として安く作れます。

- [ ] ランディング / ブログ / 会社サイト / ダッシュボードの雛型
- [ ] 各雛型を registry のアイテムとして配布
- [ ] Astro 版と React 版の両方

## v0.7 — 配布とドキュメント

- [ ] レジストリを静的ホスティング（Cloudflare Pages / GitHub Pages）
- [ ] カタログをそのままドキュメントサイトにする
- [ ] `npx shadcn add` の実インストール検証を CI に載せる
      （現状はサンドボックスから ui.shadcn.com へ到達できず未実施。
       `verify-install.mjs` が同じ依存解決を再現して代替している）
- [ ] Renovate で依存更新 → CI が緑ならタグを進める

## 判断待ち

### ビジュアル編集
**方針: 当面やらない。** 「コードを全く書けない人」は対象外と決めたため。
やるとしても、レイアウト部品が揃った後に「限られた選択肢から選ぶ UI」として
載せる形にします。先に作ると無限の CSS 値を吐いてきれいなコードになりません。

競合調査の結果、Builder.io / Plasmic / Makeswift の 3 つとも
ページ内容を独自のクラウド形式で保存しており、セルフホストの選択肢がありません。
「ロックインしない」を満たせているものは無い、というのが唯一の勝ち筋です。

### 認証・課金の配線
有償ボイラープレートが $200〜600 取っている領域。アダプタ方式にすれば
バックエンドに依存せず作れます。ただし静的サイト中心の方針と直交するので後回し。

### 生成後の更新パス
JS 圏には Python の `copier` / `cruft` に相当するものがありません。
独立したツールとして切り出す価値はありますが、この規模で手を出すものではありません。
