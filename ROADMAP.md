# ROADMAP

現状 (v0.1) と、次に何を足すかの整理。

## v0.1 — 完了

契約層とトンマナ層が固まり、状態を持つコンポーネントが 4 つ動いています。
ここが全体の骨格なので、ここさえ正しければ後から何を足しても崩れません。

- [x] `Action` / `ActionSpec` / `ActionError` の契約
- [x] `useAction`（二重送信防止・中断・自動リトライ・自動リセット）
- [x] `useResource`（依存キーでの再取得・アンマウント中断）
- [x] トンマナ 4 種 × light/dark（色・角丸・影・書体を一括切替）
- [x] `ActionButton` / `AsyncForm` + `Field` / `DataList` / `AsyncBoundary`
- [x] `ThemeProvider` / `ThemeSwitcher` / ちらつき防止スクリプト
- [x] React + Vite のカタログ
- [x] Astro 静的サイト + island 連携（関数を渡せない制約への対処つき）
- [x] shadcn レジストリ生成
- [x] 実ブラウザでの状態検証スクリプト

## v0.2 — 次にやるべきこと

**フロントの「状態を持つ部品」を増やす。** バックエンドはまだ触りません。

- [ ] `AsyncSelect` — 検索つきセレクト。入力するたびに取得し、前のリクエストを中断
- [ ] `FileDrop` — ドラッグ&ドロップ + 進捗 + 失敗した分だけ再送
- [ ] `DataTable` — ソート・ページング・行選択。`DataList` の表版
- [ ] `Toast` / `ToastProvider` — `useAction` の `onError` 既定値として全画面共通の通知先にする
- [ ] `ConfirmDialog` — 現在 `window.confirm` で代用している箇所を置換
- [ ] `OptimisticList` — 楽観更新と、失敗時のロールバック

### この段階で決めておくべき設計

`ActionProvider` を入れて「アプリ全体の既定エラー処理」を持たせるか。
入れると `onError` を毎回書かなくて済みますが、暗黙の挙動が増えます。
`v0.2` の Toast と同時に判断するのが自然です。

## v0.3 — 認証・課金の配線

ここで初めてバックエンドに触れます。ただし**アダプタ経由**にして、
コンポーネント自体はバックエンドを知らないままにします。

- [ ] `AuthAdapter` インターフェース（signIn / signUp / signOut / getSession）
- [ ] `better-auth` 用アダプタ
- [ ] `Supabase` 用アダプタ
- [ ] `LoginForm` / `SignupForm` / `PasswordReset` / `UserMenu` / `AuthGuard`

有償ボイラープレートが $200〜600 取っているのがこの領域です。
アダプタ方式にすれば、バックエンドを乗り換えてもコンポーネントは変わりません。

## v0.4 — 配布とドキュメント

- [ ] レジストリを静的ホスティング（Cloudflare Pages / GitHub Pages）
- [ ] カタログをそのままドキュメントサイトにする（各コンポーネントのコードを表示）
- [ ] `npx shadcn add` の実インストール検証を CI に載せる
- [ ] Renovate で依存更新 → CI が緑ならタグを進める

## 判断待ちの論点

### 1. EmDash 向けテーマとして出すか
Cloudflare の EmDash（Astro ベース、MIT、2026-04 公開）は
サードパーティのテーマ・プラグインがほぼゼロの状態です。
`apps/site` を EmDash テーマの形にすれば、空いた棚に最初に並べられます。
ただし EmDash 自体がまだ v0.x で動きが速く、追随コストが読めません。

### 2. 生成後の更新パス
JS 圏には Python の `copier` / `cruft` に相当するものがありません。
shadcn の配布は「コピーして所有」なので、上流が更新されたときの
取り込みは `shadcn add --diff` に頼ることになります。
これをプロジェクト全体に広げる仕組みは、独立したツールとして切り出す価値があります。
ただし v0.1 の段階で手を出す規模ではありません。

### 3. コンポーネントをどこまで増やすか
「見た目のパーツ」は既存の shadcn ブロック集が 2,500 個以上出しています。
そこと競っても勝てません。**状態を持つものだけ**に絞り続けるのが差別化です。
Hero や Pricing のような静的パーツは、必要になったら既存のものを取り込めば十分です。
