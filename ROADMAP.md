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
- [x] 画面幅ごとの指定（`space={{ mobile: "sm", tablet: "xl" }}`）
- [x] `Columns` は既定でタブレット幅未満に縦へ畳む
- [x] `ActionDefaults` / `ActionProvider` / `Toast` / `useToast`
- [x] 二重表示の抑制ルール（画面内に出せているものは通知しない）
- [x] 実ブラウザ検証（`scripts/verify-v02.mjs`）

### v0.2 で踏んだ罠（同じことを繰り返さないための記録）

**余白トークンを Tailwind 標準の `--spacing-*` 名前空間に入れてはいけない。**
`--spacing-sm: 0.75rem` を定義すると `max-w-sm` が 24rem ではなく 0.75rem になります。
`sm` / `md` / `lg` は t シャツサイズと衝突するためです。
`@utility gap-* { gap: --value(--space-*); }` の形で独自ユーティリティとして
定義すれば、標準クラスを一切壊しません。

## v0.3 — 次

状態を持つ部品を増やす。**見た目だけの部品は引き続き作りません。**

- [ ] `AsyncSelect` — 検索つきセレクト。入力のたびに取得し、前の要求を中断
- [ ] `FileDrop` — ドラッグ&ドロップ + 進捗 + 失敗した分だけ再送
- [ ] `DataTable` — ソート・ページング・行選択。`DataList` の表版
- [ ] `ConfirmDialog` — 現在 `window.confirm` で代用している箇所を置換
- [ ] `OptimisticList` — 楽観更新と、失敗時のロールバック
- [ ] `Field` の拡張（select / checkbox / radio / date）

## v0.4 — テンプレート化

レイアウト部品が揃ったので、ページ雛型が「組み合わせ」として安く作れます。

- [ ] ランディング / ブログ / 会社サイト / ダッシュボードの雛型
- [ ] 各雛型を registry のアイテムとして配布
- [ ] Astro 版と React 版の両方

## v0.5 — 配布とドキュメント

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
