# v2.0.0 — 判断を減らし、部品を増やしすぎない

## 目的

v2 は「機能を何個足したか」ではなく、次の 3 点で評価します。

1. 初めて使う人が、既知の事故を知らなくても安全な道を選べる
2. 必要な機能より重い仕組みを覚えなくてよい
3. 経験者は component → hook → contract → platform と 1 段ずつ降りられる

外部から受け取った `nasu-stack-v1-worklist.md` は有力な入力ですが、実装の約束では
ありません。現行 40 registry item と責任境界に照らし、追加・既存 item への吸収・
recipe 化・延期・責任外に分類してから実装します。

## 変更しない責任境界

- 認証・認可、database / ORM、router、CMS、global state manager は内製しない
- client validation はフィードバックであり、server validation の代わりにしない
- abort は古い UI 更新を防ぐ要求であり、server の副作用を巻き戻す保証にしない
- retry と二重操作防止を、server の冪等性・重複排除として説明しない
- backend 固有 SDK を包まず、Action / props / 小さな adapter で接続する
- native control で意味と操作が成立するなら、それを再実装しない

詳細な所有者は [`boundaries.ja.md`](boundaries.ja.md) を正とします。

## 新しい public API の審査

候補は次の 6 問を通します。4 問が YES でも自動採用にはしません。

| 問い | 必要な証拠 |
|---|---|
| 初心者が繰り返し踏むか | 既存の失敗記録、再現、複数の利用例のいずれか |
| 経験者も毎回書き直すか | framework に依らない共通配線を説明できる |
| 安全な既定値を決められるか | 既定値が守る性質と、向かない用途を説明できる |
| 特定の backend 等へ固定しないか | plain function / props で接続できる |
| 1 段下へ降りられるか | component 以外の supported path がある |
| 契約を検査できるか | 実ブラウザまたは単体検査で、意図的に赤へできる |

さらに **複雑さの予算**を審査します。

1. platform / native HTML で足りない理由
2. 既存 item の prop / export に吸収できない理由
3. 単一責任の hook では足りず component が必要な理由
4. recipe ではなく安定した public API にする理由
5. 新しい名前を利用者が覚える費用より、減る判断の方が大きい理由

これを説明できない候補は追加しません。

## 問題に合う最も低い層を選ぶ

| 必要なもの | 最初に選ぶ層 | 上の層へ上げる条件 |
|---|---|---|
| HTML が既に持つ意味・操作 | native element | browser 間で共通して欠ける契約がある |
| 値の変換・結果の形 | pure function / contract | lifecycle を所有する必要がある |
| 二重発火など 1 つの振る舞い | 小さな hook | 表示・focus・ARIA が状態と不可分 |
| pending / success / failure / abort | `useAction` 等の state hook | 安全な表示まで一体で既定化できる |
| 複数 primitive の利用例 | behavioral recipe | 複数案件で API が同じ形に収束した |
| 認証・transaction 等 | app / server | Nasu Stack へは contract / adapter のみ |

たとえば「短い同期処理の二重クリックだけを防ぎたい」利用者へ、retry・
`AbortSignal`・成功表示を含む完全な Action state machine を必須にしません。
一方、通信の stale response や unmount を扱う処理を、単なる時間制 debounce として
軽く見せることもしません。必要な保証と同じ高さの API を用意します。

## worklist の採否

### 採用 — 既存 item へ吸収

| 候補 | v2 の扱い | 理由 |
|---|---|---|
| Switcher | `layout` の export として追加 | spacing contract を共有し、registry item を増やさない |
| Sidebar | `layout` の export として追加。名前は prototype 後に確定 | breakpoint ではなく内容が成立する幅で畳む責任は layout に属する |
| Popover | `use-popover` を強化し、小さな component を同系 item として提供 | outside / Esc / focus / viewport の重複を 1 箇所へ寄せる |

`Switcher` と `Sidebar` は CSS / SSR を基本とし、DOM 順序を視覚順序のために
入れ替えません。arbitrary CSS length を escape hatch として保ちます。

### 採用 — 独立した責任

| 候補 | v2 の扱い | 境界 |
|---|---|---|
| ErrorBoundary | render failure 専用 component | async failure / ActionError と統合しない |
| useAutosave | coalescing と stale 防止を持つ hook | 保存の正当性・競合解決は domain / server |
| Validation contract | library 非依存の lib と AsyncForm adapter | schema validator や正規の server 判定は作らない |
| FieldArray | validation contract 後に追加。reorder は初版から外す | stable key / name / focus だけを所有する |
| Paginator | link を基本にした navigation component | URL の意味・総件数の取得は app |
| CopyButton | clipboard 状態に限定した component + lower-level hook | 秘密情報をコピーしてよいかは app |

### 条件付き採用

| 候補 | 先に必要な証拠 |
|---|---|
| Tooltip | Popover の geometry を再利用し、重要情報を tooltip だけへ隠せない API と touch 方針を実証する |
| Recipes | **採用: SearchListRecipe。** debounceだけでなく、古い成功結果の即時非表示・request abort・failure / retry / empty・link semanticsを一体で検査できる |
| cursor / Load more | `useResource` と Paginator で足りない cursor race を再現する。自動 infinite scroll は既定にしない |

初期候補も再評価しました。`delete-with-confirmation`は既存`ActionButton confirm`、
`settings-form`は`AsyncForm`、`upload-form`は`FileDrop`、`autosave-editor`は`useAutosave`の
既存例を並べ直す比率が高く、名前を増やす費用に届きません。`master-detail`はrouter・URL・
domain APIを先に固定しすぎます。一方`search-list`は、`AsyncSelect`（値を選ぶ）とも`DataList`
（検索欄を持たない）とも異なり、debounce中の古い結果、query切替直後の1-frame stale表示、
進行中requestのabortという反復可能な失敗をまとめて解消するため採用します。recipeは
copy & ownであり、新しいruntime frameworkにはしません。

### v2 の public primitive にしない

| 候補 | 判断 |
|---|---|
| Wizard | まず recipe で利用実績を集める。巨大な state / validation / router API を固定しない |
| Editable | settings / autosave recipe で共通部分を観測してから判断する |
| InfiniteList | 自動無限スクロールを既定にしない。必要なら Load more の contract / recipe に分解する |

延期は「不要」の意味ではありません。v2 で安定契約にする証拠が足りない、という意味です。

## backend 側へ伸ばす範囲

Nasu Stack は backend framework を持ちません。v2 では次の **境界の形**だけを増やします。

- validation success / field error / form error / transformed data の結果型
- client と server のどちらでも同じ結果を返せる validator interface
- server error を `AsyncForm` の field / form 表示へ戻す adapter
- page / cursor の結果型と、重複しない Load more の最小 contract（採用条件を満たした場合）
- example receiver での fail-closed な結合例と、認証等を引き受けない明記

Zod 等の schema、database transaction、認証、rate limit、idempotency store は作りません。

## 実装の波

各行を 1 PR の上限目安とします。必要ならさらに分けます。

| Wave | 主題 | 同じ PR に必ず含めるもの |
|---|---|---|
| 0 | この計画・責任境界・引き継ぎ | 日英 boundary、ROADMAP |
| 1 | 過剰な Action を避ける軽量 interaction guard | catalog、連打のrace test、使い分けdocs |
| 2 | Switcher / Sidebar layout | 320px〜desktop、長文・入力・DOM順の検査 |
| 3 | Validation contract | unit、AsyncForm、field focus / ARIA、server adapter例 |
| 4 | FieldArray | stable key、min/max、focus、nested path、install検査 |
| 5 | ErrorBoundary / useAutosave | render failure と async failure の分離、race / unmount |
| 6 | Popover foundation | controlled/uncontrolled、focus、outside、Esc、viewport edge |
| 7 | Paginator / CopyButton、条件を満たせば Tooltip | keyboard、読み上げ、failure、timer cleanup |
| 8 | behavioral recipes | install / typecheck / mobile / failure state |
| 9 | cursor / Load more の採否と backend contract 監査 | stale / duplicate / end / retry。不要なら非採用理由 |
| 10 | checker と検証時間 | intentional break、false positive、CI の重複排除 / 並列化 |
| 11 | v2 contract audit と release | migration、日英docs、全item実install、Pages smoke、tag / Release |

## item ごとの Definition of Done

- public API が 1 つの責任を短い例で説明できる
- beginner 向け default と、向かない用途が書かれている
- component から 1 段下へ降りる supported path がある
- keyboard、focus、accessible name / description / status を検査する
- 320px、長文、長 URL、大きい入力、zoom 相当で overflow / crush を検査する
- failure、race、double action、stale result があり得る場合は意図的に再現する
- checker を追加したら、対象を壊してその判定が赤になることを確認する
- `registryDependencies`、空の利用者 project への install、型検査を通す
- catalog と利用者向け docs を英語・日本語で同時に更新する
- 正常系だけでなく失敗系と責任境界を catalog / docs に置く
- `pnpm verify` と `pnpm verify:create` を通す
- 変更理由と実測結果を `ROADMAP.md` または `docs/result-v2.md` に残す

## 検証時間を増やし続けない

- 単体、型検査、build、独立 browser scenario は依存関係の範囲で並列にする
- 同じ SHA に対する `verify` / `verify-create` の重複実行を release / Pages の要件と
  照らして減らす。ただし別経路を検査しているものは統合しない
- browser を無制限に起動せず、CI runner の lane 数を上限にする
- 速さのために出力を混ぜない。結果は定義順に読みやすく表示する
- test 数ではなく、public contract のどの失敗を捕まえるかを記録する

## v2.0.0 の完了条件

- 採用した全候補が上の Definition of Done を満たす
- 条件付き / 非採用候補に、証拠と判断が残っている
- v1 からの breaking change と移行方法が日英で読める
- registry / CLI / catalog / demo / template / receiver の公開面が同期している
- 全 item を空 project へ本物の shadcn CLI で追加できる
- `verify` / `verify:create` / Pages deploy / 公開後 smoke が成功する
- release workflow の tag 引数経路を tag 前に同じ形で回帰検査する
- 検査済み main commit にだけ `v2.0.0` tag を打ち、immutable asset を公開する

途中の PR が green でも、この一覧を満たすまでは v2 完了としません。
