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
- [x] PR CIが成功する（verify 4m41s / verify-create 3m10s）
- [x] `main`へmergeされる（PR #20 / `40c58c5`）

## Wave 4 — FieldArray

### 実施

- `FieldArray`を独立itemとして追加し、registry itemを42 → 43にした
- UI内だけで安定するkeyと、`members.0.email`形式の現在nameを分離した
- add / remove / min / max / empty stateとnative form resetを持たせた
- add後は新しい行、remove後は次・前・Add buttonの順にfocusする
- 構造変更時は、別の行を指すようになった古いnested field errorを消す
- 1段下では`fieldArrayItemName()`と利用側のstateを組み合わせられる
- database ID・reorder・配列のdomain rule・server validationは所有しない

### 完了条件

- [x] 行削除後も残るkey / DOM入力値が安定する実ブラウザ検査がある
- [x] min / max / empty state / add-remove focusの実ブラウザ検査がある
- [x] nested pathがARIA / first-error focusへ届き、構造変更でstale errorを消す検査がある
- [x] `AsyncForm` success後のnative resetでdefaultItemsへ戻る検査がある
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 43/43が成功する
- [x] `pnpm verify` 30 / 30、`pnpm verify:create` 112 / 112が成功する
- [x] PR CIが成功する（verify 4m31s / verify-create 2m57s）
- [x] `main`へmergeされる（PR #21 / `63df788`）

## Wave 5 — ErrorBoundary / useAutosave

### 実施

- `ErrorBoundary`をReact render failure専用itemとして追加した
- accessibleな既定fallback、retry、resetKeys、onError / onResetを持たせた
- callbackがthrow / rejectしてもfallbackを失わず、独自fallbackまで壊れた場合は最小表示を残す
- event handler・Promise・effect・SSR・Server Componentのerrorは捕捉しないと明記した
- `useAutosave`を独立hookとして追加し、debounceと「進行中1件 + 最新待機値1件」を持たせた
- 進行中の保存を新しい編集で不用意にabortせず、途中の待機値を捨てて最新値だけを次へ送る
- staleな成功 / 失敗responseを最新stateとcallbackへ戻さない
- retry / flush / cancel / reset / AbortSignal / unmount cleanupを公開した
- conflict、idempotency、durable draft、offline、navigation guardは所有しない
- 文言とdomain stateを固定しすぎるため`SaveStatus`は独立itemにしなかった

### 完了条件

- [x] render failureがsiblingへ波及せず、fallbackへfocusする実ブラウザ検査がある
- [x] retry、resetKeys、onError failure、fallback failureの復帰境界を検査する
- [x] 高速入力が最新値1件へdebounceされる検査がある
- [x] 保存中の編集がlatest-only queueになり、stale success / failureを無視する検査がある
- [x] failure後のretry / 再編集、flush、cancel、reset、unmount abortを検査する
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 45/45が成功する
- [x] `pnpm verify` 30 / 30、`pnpm verify:create` 112 / 112が成功する
- [x] PR CIが成功する（verify 4m29s / verify-create 3m00s）
- [x] `main`へmergeされる（PR #22 / `5a5e294`）

## Wave 6 — Popover foundation

### 実施

- 既存`usePopover`を実寸計測・左右端補正・最大高・scroll / resize追従へ強化する
- 小さな`Popover` componentへcontrolled / uncontrolled、trigger、Esc、outside pointer、focus復帰を載せる
- placementは希望として扱い、viewport内へ残す必要があれば反転する
- portalは既定にせず、DOM順序 / SSRを保ち、clipping ancestorとtop layerの境界を明記する
- menu / listbox / dialog / tooltipのsemanticsと業務stateは所有しない

### 完了条件

- [x] 320pxの右端・最下部でもpanelがviewport内へ収まる実ブラウザ検査がある
- [x] mouse / touch / keyboardで開け、Escで閉じてtriggerへfocusが戻る
- [x] outside pointerで閉じた際に、移動先のfocusを奪わない
- [x] controlled / uncontrolled / defaultOpenとcontentから閉じる経路を検査する
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 46/46が成功する
- [x] `pnpm verify` 30/30 / `pnpm verify:create` 112/112が成功する
- [x] PR CIが成功する（verify 4m20s / verify-create 3m20s）
- [x] `main`へmergeされる（PR #23 / `195eeb6`）

## Wave 7a — Paginator

### 実施

- `Paginator`を独立itemとして追加し、registry itemを46 → 47にする
- `getHref`を必須にし、client router利用時も本物のlinkを残す
- 前後link、現在page、巨大page数でも上限のあるellipsisを扱う
- 狭い器ではtargetを潰さず、DOM / focus順を保ったまま折り返す
- `getPaginationItems()`を1段下のsupported pathとして公開する
- total取得、URLの意味、router同期、cursor / Load moreのraceは所有しない

### 完了条件

- [x] 1 pageと2〜5 pageで不要なellipsisや移動可能なdisabled linkが無い
- [x] 1000 pageでもDOM数が上限内で、先頭・中間・末尾の省略が正しい
- [x] 現在位置、前後関係、disabled、link先を読み上げとDOMで辿れる
- [x] 通常clickのcallbackと、modifier clickのnative link経路を分離する
- [x] 320pxでdocument overflowとtargetの縮み潰れが無い
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 47/47が成功する
- [x] `pnpm verify` 30/30 / `pnpm verify:create` 112/112が成功する
- [x] PR CIが成功する（verify 4m29s / verify-create 3m02s）
- [x] `main`へmergeされる（PR #24 / `c6dd020`）

### Wave 10へ残す観測

同じcheckoutで`pnpm verify`と`pnpm verify:create`を同時に起動すると、両方が共有する
`packages/create-nasu-stack/template`の再生成が競合した。CIの2 jobは別checkoutなので影響
しないが、localで安全に並列化できない重複工程としてWave 10でlockまたは作業領域分離を扱う。
単独再実行では30/30と112/112がそれぞれ成功した。

## Wave 7b — CopyButton / useCopy

### 実施

- clipboard stateだけを持つ`useCopy`と、薄い`CopyButton`を独立itemとして追加する
- Clipboard APIを優先し、無い・拒否された場合だけtemporary textarea fallbackを試す
- copy中の再入をReact描画前に同期的に止める
- success / error / reset timer / custom child / accessible statusを扱う
- componentを使わないsupported pathとして`useCopy` / `copyText()`を公開する
- 秘密情報・個人情報をコピーしてよいか、正確な文字列、保持時間はappの責任に残す

### 完了条件

- [x] Clipboard API成功と、APIなしのfallback成功を実ブラウザで検査する
- [x] 両経路の失敗をerror / retry可能状態 / role=alertへ戻す
- [x] 同じbrowser taskの連打でもclipboard writeが1回だけである
- [x] 2回目のcopyが1回目のreset timerで早くidleへ戻らない
- [x] unmountでreset timerをclearし、temporary textareaとfocus / selectionを残さない
- [x] custom child / labels / announcements / lower-level hookを文書化する
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 49/49が成功する
- [x] `pnpm verify` 30/30 / `pnpm verify:create` 112/112が成功する
- [ ] PR CIが成功する
- [ ] `main`へmergeされる

## 実装台帳

| Wave | 状態 | PR | 証拠 |
|---|---|---|---|
| 0: 計画 / boundary | 完了 | #17 | `770d131` / verify 29工程 / verify-create 112判定 |
| 1: 軽量 interaction guard | 完了 | #18 | `d03133e` / verify 29工程 / verify-create 112判定 |
| 2: Switcher / SidebarLayout | 完了 | #19 | `6346f2d` / verify 29工程 / verify-create 112判定 |
| 3: Validation contract | 完了 | #20 | `40c58c5` / verify 30工程 / verify-create 112判定 / 単体17件 / form実ブラウザ27件 |
| 4: FieldArray | 完了 | #21 | `63df788` / verify 30工程 / verify-create 112判定 / form実ブラウザ40件 |
| 5: ErrorBoundary / useAutosave | 完了 | #22 | `5a5e294` / registry 45 item / state実ブラウザ53件 / verify 30工程 / verify-create 112判定 |
| 6: Popover foundation | 完了 | #23 | `195eeb6` / registry 46 item / nav実ブラウザ64件 / verify 30工程 / verify-create 112判定 |
| 7a: Paginator | 完了 | #24 | `c6dd020` / registry 47 item / nav実ブラウザ76件 / verify 30工程 / verify-create 112判定 |
| 7b: CopyButton / useCopy | ローカル検査済み | — | registry 49 item / state実ブラウザ65件 / verify 30工程 / verify-create 112判定 |
| 7c: Tooltip 判断 | 未着手 | — | — |
| 8: behavioral recipes | 未着手 | — | — |
| 9: cursor / Load more 判断 | 未着手 | — | — |
| 10: checker / CI 時間 | 未着手 | — | — |
| 11: contract audit / release | 未着手 | — | — |

## v2 完了監査

ここは最後に [`plan-v2.md`](plan-v2.md) の完了条件を 1 行ずつ、commit / test / URL の
直接証拠で埋めます。部分的な green CI や意図だけでは完了にしません。
