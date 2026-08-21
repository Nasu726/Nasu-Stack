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
- [ ] PR CI が成功する
- [ ] `main` へ merge される

## 実装台帳

| Wave | 状態 | PR | 証拠 |
|---|---|---|---|
| 0: 計画 / boundary | 作業中 | — | この文書の Wave 0 |
| 1: 軽量 interaction guard | 未着手 | — | — |
| 2: Switcher / Sidebar | 未着手 | — | — |
| 3: Validation contract | 未着手 | — | — |
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
