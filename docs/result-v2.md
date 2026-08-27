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
- [x] PR CIが成功する（verify 5m02s / verify-create 3m04s）
- [x] `main`へmergeされる（PR #25 / `e883e80`）

## Wave 7c — Tooltipの条件付き判断

### 結論

v2のpublic `Tooltip` itemは追加しない。既存`usePopover`のgeometryは再利用できたが、
重要情報・touch・native disabled triggerを同時に安全な既定へできないため、条件を満たさない。

### 根拠

- WAI-ARIA APGは2026-08-25時点でも[Tooltip patternをtask forceの合意前にあるwork in
  progress](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)と明記している
- [WCAG 2.2 SC 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)が
  求めるdismissible・hoverable・persistentと、focus / hoverの両経路は実装できる
- [ARIA上のtooltip](https://w3c.github.io/aria/#tooltip)は`aria-describedby`で結ぶdescriptionであり、
  triggerのaccessible name、必須手順、error、task完了に必要な情報の代わりにはしない
- Playwright 1.62.1 / Chromiumのprobeではnative disabled buttonへ`.focus()`してもactive elementは
  `BODY`のまま、最初のTabは次のenabled buttonへ進む一方、pointerenterは発火した。wrapperを
  focusableにすれば別の代理controlを作るため、黙って行う既定にはできない
- touch contextの1回のtapではpointerenter・focus・clickがすべて発火した。click-to-pinは本来の
  actionと競合し、hover-onlyはtouchから到達できない

### 支持する経路

- 必須の説明とdisabledの理由: controlの近くへvisible textとして置く
- touchでも意図的に開く補足: `Popover`を使う
- application固有のTooltip: `usePopover`をgeometryとして使い、appがtrigger / touch / disabled
  policyを所有する

この判断は「Tooltipは不要」という主張ではない。初心者向けのstable APIとして固定する証拠が
足りず、誤用を促すpublic itemを増やさないという複雑さ予算の適用である。

## Wave 8 — Search list behavioral recipe

### 採否

6候補を既存itemと照合した。`delete-with-confirmation`は`ActionButton confirm`、
`settings-form`は`AsyncForm`、`upload-form`は`FileDrop`、`autosave-editor`は`useAutosave`の
既存例を並べ直す比率が高い。`master-detail`はrouter / URL / domain APIを先に固定しすぎる。

`search-list`だけは`AsyncSelect`（form valueを選ぶ）とも`DataList`（検索欄なし）とも責任が
重ならず、debounce・古い成功結果の即時非表示・進行中requestのabort・failure / retry /
empty・本物のresult linkという、見本だけでは繰り返し壊れる配線を持つ。copy & ownのrecipe
として採用し、registry itemを49 → 50にする。

### 実施

- `SearchListRecipe`を`components/recipes/search-list.tsx`へcopyするblockとして追加する
- `Action<string, SearchListItem[]>`だけを接続契約にし、検索backendを固定しない
- 2文字 / 300ms / 自動retry 0を安全な既定にし、全て変更可能にする
- queryが変わった瞬間に古い結果componentを外し、debounce後は新しいpending stateから始める
- 前のtransportへ`AbortSignal`を通知し、遅いresponseをUIへ戻さない
- `AsyncBoundary`へ`retryLabel`を追加し、recipeの全表示文言をlocaleに合わせられるようにする
- serverの認可・result filter・rate limit・abuse防止・ranking・index整合性を境界外に残す

### intentional break

最初に`SearchResults`の`key`だけを外したが、検査は77/77のまま成功した。debounce待機分岐が
結果component自体をunmountするためkeyは冗長だった。二重の防御に見えても証拠が無いcodeは
残さず、keyを削除した状態を正とした。

次にdebounce待機分岐を意図的に常時falseへ変更したところ、state実ブラウザ検査は77件中
2件を正しく失敗にした。

1. 最小文字数未満の途中値までactionへ流れ、`["a", "nasu"]`の2回になった
2. 新しいqueryのdebounce中に古い成功結果が残った

分岐を復旧すると77/77とpageerror 0へ戻った。checkerは見た目の存在ではなく、request回数と
古い結果のDOM不在を測っている。

### 完了条件

- [x] 既存itemで足りるrecipe候補を追加せず、採否理由を残す
- [x] 最小文字数未満0 request、高速入力1 request、進行中request abortを実ブラウザで検査する
- [x] query変更直後から古い成功結果を1 frameも表示しない
- [x] failure / localized retry / recovery / empty / real href / Tab focusを検査する
- [x] 長い切れない結果を含め、320pxでdocumentとrecipeのoverflowが0
- [x] intentional breakで対象判定が赤になることを確認する
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry依存 / 空project install / 型検査 / 本物のshadcn CLI 50/50が成功する
- [x] local `pnpm verify` 30/30 / `pnpm verify:create` 112/112が成功する
- [x] PR #27のCIが成功する（verify 4m30s / verify-create 3m35s）
- [x] `main`へmergeする（PR #27 / `0390a82`）

merge後の`main`でも`pnpm verify`は成功した。最初のPages公開後smokeだけは、全50 item中
`frame.json`の1 requestがHTTP 503になり9/10で失敗した。同じURLは直後から200へ戻り、配布漏れ
ではなく一時障害だったが、公開物checkerに一時障害と恒常的欠落を分ける境界が無いことは実在する
穴だった。再実行で公開状態を確認し、上限付きretryをWave 10から前倒しした。

## Wave 9 — LoadMoreList / useCursorList / CursorPage

### 採否

自動`InfiniteList`をstable public primitiveにはしない。一方、`useResource`と`Paginator`では、
cursorの同期連打、後続pageだけのretry、deps変更後のstale response、末尾、cursor loopを同時に
扱えない。この責任は繰り返し可能で検査できるため、1つのregistry itemに次の3段を同梱した。

1. `CursorPage` / `CursorLoader` contract
2. 表示を持たない`useCursorList`
3. 明示的なbuttonを既定にする`LoadMoreList`

itemを3つへ分けず、初心者には1つの入口、経験者には1段ずつ降りる経路を提供する。registry itemは
50 → 51。`IntersectionObserver`は、footer到達・history・scroll復元・支援技術でのnavigationを
product側が判断した後に足すものとして境界外へ残す。

### 実施

- 最初のpageだけを自動取得し、後続pageは明示buttonで開始する
- Reactの再描画より前の同期5連打もref lockで1 requestへまとめる
- deps変更時に前itemを即座に隠し、進行中transportへabortを通知する
- transportがabortを無視して遅れて成功してもgenerationとkeyで結果を捨てる
- 後続page失敗時は取得済みitemを残し、失敗cursorだけをretryする
- 空pageでも`nextCursor`があれば末尾にせず継続できる
- 既出cursorへのloopを`CURSOR_LOOP`、不正pageを`INVALID_CURSOR_PAGE`でfail closedにする
- append後はLoad more、失敗後はretry、末尾ではend statusへfocusを移す
- item重複排除・安定順序・cursor発行・全pageの認可/filter・history復元をapp/serverへ残す

### intentional break

`pendingRef`の同期guardを外すと、state実ブラウザ検査はhook直接5連打とbutton 5連打の2件を
正しく失敗にした。guardを戻すと両方とも1 requestへ戻った。

loader成功後のabort / generation / key判定を外すと、deps変更後に前pageの遅延成功が空の新listを
置き換え、専用のstale検査1件が失敗した。判定を戻すと、古い成功はDOMへ戻らずabort通知も1回に
なった。checkerは「itemが無い」だけでなく、新しい空stateが表示され続けることまで測る。

### 完了条件

- [x] 自動infinite scrollにせず、最初だけ自動・後続はbuttonである
- [x] hook直接 / buttonの同期5連打がどちらも1 requestになる
- [x] append / focus / end / failure保持 / failed-page retryを実ブラウザで検査する
- [x] deps変更直後の非表示、abort通知、abortを無視したstale成功の除外を検査する
- [x] empty / 空page+next / loop / malformed / 320px overflowを検査する
- [x] intentional breakで対象判定が赤になることを確認する
- [x] 日英README / overview / boundary / catalog / 専用guideに役割と非目標がある
- [x] registry 51 itemの依存 / install / 型検査 / 本物のshadcn CLI 51/51が成功する
- [x] local `pnpm verify` 31/31 / `pnpm verify:create` 112/112が成功する
- [x] PR CIが成功する（verify 4m39s / verify-create 2m55s）
- [x] `main`へmergeする（PR #28 / `c2e7103`）

## Wave 10 — checker / CI時間

### 公開物GETの一時障害（Wave 9から前倒し）

PR #27のPages smokeで、存在する`frame.json`への単発HTTP 503だけが公開jobを赤くした。公開物の
欠落を隠さず外部経路の一時障害だけを吸収するため、GETを次の境界へ限定した。

旧mainの同じjobを再実行すると、今度は`frame.json`ではなく`submit.json`だけがHTTP 503になった。
対象が変わって再現したため、特定itemの欠落ではなく公開経路の一時応答であることも確認できた。

- network errorと429 / 500 / 502 / 503 / 504だけ最大3 attempt
- 404など非一時statusは1回で返し、欠落判定を隠さない
- transient statusが3回続けば最終Responseを返し、従来どおりcheckerを失敗させる
- 250ms / 750msの有限backoffで、外部障害を待ち続けない
- networkを使わない単体治具で、503→503→200、404、継続503、network errorを固定する

### 同じSHAのCI重複を排除

`main`へのpushを`verify.yml`と`pages.yml`が両方受けていたため、前者の2 jobと、後者が
reusable workflowとして呼ぶ同じ2 jobが同一SHAで重複していた。`main`はPagesだけが受け、
Pages内から唯一の`verify.yml`を呼ぶ形へ統一した。PR / weekly schedule / manual dispatch /
workflow callは残し、tag releaseも同じreusable workflowを呼ぶ。

`verify-checker-coordination.mjs`がこのworkflow topologyを固定し、required check名の`verify` /
`verify-create`、PR / schedule / tag経路を誤って消していないことも同時に見る。

### 未実施をgreenにしない

checkerのskip / warning経路を横断監査し、次のfalse-greenを閉じた。

- sitemap取得失敗・空sitemapをトップ1ページへ黙って縮退せず、独立工程として赤にする
- npm registryが一時的に不調なら有限retryし、CIでは依存存在確認と本物のshadcn検査を必須にする
- `verify:create --full`でlocal registryを配れなければ、3雛型のCLI追加判定を省略せず失敗にする
- `npm audit`へ到達できない場合も、full検査では成功扱いにしない
- Astro 7が削除予定とする`astro:content`の`z`を、Astro自身が公開する`astro/zod`へ移し、
  直接依存を増やさず0 errors / 0 warnings / 0 hintsへ戻す

これにより`pnpm verify`は、sitemap discoveryとchecker / CI協調を独立させた33工程になった。

### 同じworkspaceのwriterだけを直列化

同じcheckoutで`pnpm verify`と`pnpm verify:create`を同時に起動すると、共有する
`packages/create-nasu-stack/template`を双方が削除・再生成し、片方が途中のtreeを読むraceがあった。

- system tempにworkspace絶対pathのhashと用途名でlock directoryを置く
- atomicな`mkdir`でprocess間排他し、owner token / PIDが一致するownerだけがreleaseする
- 生きているownerは経過時間だけで奪わず、dead PIDとowner書き込み前に止まった古いlockは回収する
- stale回収は先に別名へatomic renameし、checkとremoveの間に別processのlockを消さない
- template buildからCLI生成先へのcopy完了まで、packはtarball読み取り完了までをlockする
- npm install / build / audit / browserは独立temp directoryなのでlockを外し、重い工程は並行のままにする

実際に`pnpm verify`と`pnpm verify:create`を同じWindows checkoutで同時実行し、前者33/33、
後者112/112がともに成功した。2つのlight verifierを同時起動した検査でも双方79/79で、片方が
owner PIDを表示して待った後に成功した。`pnpm release:build`もtemplate build → pack → SHA-256 →
manifestまで同じlock経路で成功した。

### intentional break

- `verify.yml`へ`main` pushを戻すと協調checkerがexit 1になり、二重経路を名指しした
- lock取得をno-opにすると2 workerのtraceが`start, start, end, end`になり、重複を検知した
- 本物のshadcn検査のCI必須分岐を無効化すると、network検査のskipとしてexit 1になった
- 復旧後は`start, end, start, end`へ戻り、dead owner / owner不明lockも回収した

### 完了条件

- [x] 公開GETの一時障害と恒常的欠落を分け、双方の単体治具を通す
- [x] 同じSHAに対するmainのverificationを1経路へ統一する
- [x] sitemap / registry / real CLI / auditの未実施をCIのgreenにしない
- [x] 同じworkspaceのtemplate writerをprocess間で安全に直列化する
- [x] heavy install / build / browserは並行可能なままにする
- [x] intentional breakでCI二重経路とwriter競合のcheckerが赤になる
- [x] local concurrent `pnpm verify` 33/33 / `pnpm verify:create` 112/112が成功する
- [x] `pnpm release:build`が成功する
- [x] PR CIが成功する（verify 4m23s / verify-create 3m10s）
- [x] `main`へmergeする（PR #29 / `88b3406`）

## Wave 11 — v2 contract audit / release

### v1からのpublic差分

`v1.0.0` tagとrelease candidateをregistry source単位で比較した。v1のregistry item名、
public export、semantic tokenに削除はない。既存itemのpublic宣言は追加だけで、意図的な
挙動変更は`useAction`が`VALIDATION` / HTTP `422`を自動retryしないことに限定した。

copy済みsourceを裏で更新しない契約を保ち、日英の`migration-v2`へ次を記録した。

- v1 applicationは現在のcopyを使い続けられる
- `shadcn add --dry-run` / `--diff`で先に確認し、未変更fileだけを`--overwrite`する
- customize済みfileはapplication ownerが必要な差分をmergeする
- 新しい11 itemと、`load-more-list`に含まれる下位のcursor exportを分ける

### v2.0.0 release candidate

- root / create CLI / Stable URLを`2.0.0`へ統一
- README / SECURITY / security guide / directory guide / CLI commentを同じimmutable URLへ統一
- CHANGELOGに追加責任、唯一の挙動変更、引き受けないbackend責任を記録
- PR CIのrelease buildを、tag workflowと同じtag引数ありの経路へ変更
- 日英translation checkerはmigrationを含む16対で成功
- `release:build`を引数なし / `v2.0.0` / `-- v2.0.0`の3経路で実行
- 3経路とも268,724 bytes、SHA-256
  `43076fc99ec11878cb7043eb843a6ed6e774137ca010a5bc31efc2607a2a6d60`
- 不一致の`v2.0.1`を渡すとversion差を検知してexit 1になる
- 同じWindows checkoutで`pnpm verify` / `pnpm verify:create`を同時実行し、
  33/33・112/112がともに成功
- Astro 0 errors / 0 warnings / 0 hints、本物のshadcn CLI 51/51 item・53/53 file、
  state browser 98/98・pageerror 0、日英を含む29 page × 5幅で崩れなし

### release gate

- [x] v1との差分と移行方法が日英で読める
- [x] registry / CLI / catalog / demo / template / receiverのpublic面を検査する
- [x] 全51 itemを本物のshadcn CLIで空projectへ追加し、型検査する
- [x] local `pnpm verify` 33/33 / `pnpm verify:create` 112/112が成功する
- [x] tag引数経路をtag前に実行し、不一致も赤になる
- [ ] release PRのrequired checksが成功する
- [ ] release PRをmainへmergeし、Pages deploy / 公開smokeが成功する
- [ ] 検査済みmain commitへ`v2.0.0` tagを打ち、immutable Releaseを公開する

tagはまだ打たない。release PRをmergeしたmainのPages deploy / 公開smokeが成功した後、
その同じcommitだけへ`v2.0.0`を付ける。

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
| 7b: CopyButton / useCopy | 完了 | #25 | `e883e80` / registry 49 item / state実ブラウザ65件 / verify 30工程 / verify-create 112判定 |
| 7c: Tooltip 判断 | 非採用 | — | APG WIP / disabled focus / touch tapを実測し、visible text・Popover・usePopoverへ分離 |
| 8: behavioral recipes | 完了 | #27 | `0390a82` / registry 50 item / state実ブラウザ77件 / verify 30工程 / verify-create 112判定 |
| 9: cursor / Load more 判断 | 完了 | #28 | `c2e7103` / registry 51 item / state実ブラウザ98件 / verify 4m39s / verify-create 2m55s |
| 10: checker / CI 時間 | 完了 | #29 | `88b3406` / verify 4m23s / verify-create 3m10s / main Pages 1経路でbuild・deploy・smokeまで成功 |
| 11: contract audit / release | release candidate検証中 | — | migration日英 / version 2.0.0 / tag引数3経路で同一asset |

## v2 完了監査

ここは最後に [`plan-v2.md`](plan-v2.md) の完了条件を 1 行ずつ、commit / test / URL の
直接証拠で埋めます。部分的な green CI や意図だけでは完了にしません。
