# v2.0.1 — tag前の境界修正計画

## 背景

release PR #41のmergeとmain Pages smoke後、remote tagをpushする直前に、下位hook・
上位component・transport・form controlの契約ずれが追加reviewで見つかった。
`v2.0.1` tag / GitHub Releaseはまだ公開していないため、未公開候補へ取り込む。

## 対象

1. `pendingDuringGuard`を`AsyncForm` / `ActionButton`から`useAction`へforwardする
2. FormData foldingをprototype-safeにし、repeated emptyを保持し、値sentinelを廃止する
3. HTTP error `fields`をplain object / non-empty stringへruntime正規化する
4. validation payloadをmachine-readableにし、field errorをretryしない
5. form controlのdisabled / event / ARIAを利用者propsとcomposeする
6. `FieldArray.defaultItems`をmount時だけ検査するuncontrolled契約へ揃える
7. SearchListのARIA参照、RadioGroup required、createSubmit serializationを修正する
8. release workflowをmain ancestryと同一SHAのPages successでgateする

## 対象外

- 新しいprimitive、recipe、domain validation、backend機能
- `FieldArray`のcontrolled化やreorder
- Stable API signature / semantic tokenのprevious-tag比較方式の確定

最後のcontract checker強化は必要だが、`.d.ts`の互換判定規則とbaseline取得を別に設計する。
今回の境界bug fixへ、判定が未確定のmajor互換checkerを混ぜない。

## 完了条件

- 指摘された各failureをunitまたは実browserで再現し、修正後にgreenにする
- public item / file / exportを削除しない
- `pnpm verify` / `pnpm verify:create`を完走する
- PR checksとmerge後Pages build / deploy / public smokeを完走する
- その同一commitだけをtag workflowが受け入れ、immutable Releaseを再download監査する
