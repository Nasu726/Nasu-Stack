# v2.0.0 — 実施結果

この文書は [`plan-v2.md`](plan-v2.md) の実施証拠を、PR ごとに追記する台帳です。
予定を書き直して完了に見せず、実装・検査・公開状態が確認できたものだけを記録します。

## 開始時点

- base: v1.0.0 Stable と release 引数修正を含む `main`
- registry item: 40
- `pnpm verify`: 29 工程
- `pnpm verify:create`: 112 判定
- catalog: 英語既定、日本語 `?lang=ja`
- public boundary: `docs/boundaries.md` / `.ja.md`

## Wave 0 — 責任境界と複雑さ予算

### 実施

- worklist の全候補を、既存 item へ吸収 / 独立責任 / 条件付き / public primitive に
  しない、の 4 群へ分類
- platform → contract → hook → component → recipe → app/server の順に、問題を解ける
  最も低い層を選ぶ規則を日英の public boundary へ追加
- 「二重クリックだけを防ぎたい」処理へ完全な Action state machine を要求しないと明記
- Nasu Stack / app / server が所有する再入防止・再許可・冪等性を分離
- backend 拡張を validation / page-cursor result / adapter の境界に限定
- Wizard / Editable / InfiniteList は API を先に固定せず、recipe / Load more で観測する

### 完了条件

- [x] 全候補に採否または採用条件がある
- [x] 日英 boundary の意味が一致する
- [x] ROADMAP と handoff から v2 計画へ辿れる
- [x] 基準線の `pnpm verify` が 29 / 29 成功する
- [x] PR CI が成功する
- [x] `main` へ merge される（PR #17 / `770d131`）

## Wave 1 — 軽量 interaction guard

### 実施

- `useInteractionGuard` を独立 item として追加
- registry item は 40 → 41
- 公開 API を `isLocked` / `tryLock()` / `release()` の 3 つに限定
- `tryLock()` は React の再描画を待たず ref を同期更新し、同じ描画内の再入も止める
- 自動タイマー、pending / success / failure、retry、`AbortSignal` を持たせない
- 通信や非同期 state machine が必要なら `useAction`、サーバ側の重複排除が必要なら
  idempotency を選ぶ、と日英 README / overview / catalog で分離

### 完了条件

- [x] 同じ描画内で 5 回呼んでも最初の 1 回だけ通る実ブラウザ検査がある
- [x] `release()` 後に次の 1 回を受け付ける検査がある
- [x] 日英カタログに使い分けと操作できるデモがある
- [x] `pnpm verify` 29 / 29、`pnpm verify:create` 112 / 112 が成功する
- [x] PR CI が成功する
- [x] `main` へ merge される（PR #18 / `d03133e`）

## Wave 2 — content-aware layout

### 実施

- `Switcher` / `SidebarLayout` を独立 item にせず、既存 `layout` の export へ追加
- `Switcher` は CSS Grid の `auto-fit` と項目の最小幅で列数を決める
- `SidebarLayout` は side / 本文の成立幅と `flex-wrap` で 2 列 / 1 列を決める
- どちらも viewport breakpoint、JavaScript の幅測定、hydration を必要としない
- 操作状態を持つ Sidebar と誤認しないよう、配置責任だけを示す名前にした
- `sidePosition` は CSS の見た目順だけを変えず、DOM 順も同時に変える

### 完了条件

- [x] 同じ viewport 内で器の幅だけを変え、横 / 縦が切り替わる検査がある
- [x] 長い URL / 大きい入力でも縮み潰れ・overflow が無い検査がある
- [x] `sidePosition=end` の DOM / 見た目 / キーボード順が一致する検査がある
- [x] 日英 README / overview / catalog に役割と例がある
- [x] `pnpm verify` 29 / 29、`pnpm verify:create` 112 / 112 が成功する
- [x] PR CI が成功する（verify 4m45s / verify-create 3m05s）
- [x] `main` へ merge される（PR #19 / `6346f2d`）

## Wave 3 — validation result contract

### 実施

- library非依存の `ValidationResult<T>` / `Validator<T, Input>` を独立itemとして追加
- registry item は 41 → 42
- successの変換済み`data`、field error、form-level errorだけを共通契約にした
- `runValidation` がJavaScript / adapterから来る壊れた結果を実行時にfail closedにする
- 複数field文言は先頭の有効な1件へ揃え、nested pathは書き換えない
- `AsyncForm validate` はsuccess時だけactionを呼び、最初のinvalid controlへfocusする
- `validationFailureResponse` はWeb-standard `Response`で422 payloadへ変換する
- schema・domain rule・認証・認可・CSRF・rate limit・response schemaは所有しない

### 完了条件

- [x] success / field / form / transformed data / malformed resultの単体検査がある
- [x] client failure時にactionを呼ばず、focus / ARIAでerrorを辿れる実ブラウザ検査がある
- [x] client errorからserver errorへ切り替えても二重表示しない検査がある
- [x] server adapterが422・safe payload・header保持・2xx拒否を満たす検査がある
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] `pnpm verify` 30 / 30、`pnpm verify:create` 112 / 112 が成功する
- [ ] PR CIが成功する
- [ ] `main`へmergeされる

## 実装台帳

| Wave | 状態 | PR | 証拠 |
|---|---|---|---|
| 0: 計画 / boundary | 完了 | #17 | `770d131` / verify 29工程 / verify-create 112判定 |
| 1: 軽量 interaction guard | 完了 | #18 | `d03133e` / verify 29工程 / verify-create 112判定 |
| 2: Switcher / SidebarLayout | 完了 | #19 | `6346f2d` / verify 29工程 / verify-create 112判定 |
| 3: Validation contract | 実装中 | — | verify 30工程 / verify-create 112判定 / 単体17件 / form実ブラウザ27件 |
| 4: FieldArray | 未着手 | — | — |
| 5: ErrorBoundary / useAutosave | 未着手 | — | — |
| 6: Popover foundation | 未着手 | — | — |
| 7: Paginator / CopyButton / Tooltip 判断 | 未着手 | — | — |
| 8: behavioral recipes | 未着手 | — | — |
| 9: cursor / Load more 判断 | 未着手 | — | — |
| 10: checker / CI 時間 | 未着手 | — | — |
| 11: contract audit / release | 未着手 | — | — |

## v2 完了監査

ここは最後に [`plan-v2.md`](plan-v2.md) の完了条件を 1 行ずつ、commit / test / URL の
直接証拠で埋めます。部分的な green CI や意図だけでは完了にしません。
