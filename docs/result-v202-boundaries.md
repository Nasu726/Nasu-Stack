# v2.0.2候補 — dogfood前の境界修正結果

## 結論

外部reviewで再現条件が示されたform / transport境界を、dogfood app側の回避策ではなく
Nasu Stack本体で修正した。新しいUI primitiveは追加していない。既存component、field
context、transport helperの契約を揃え、利用者projectへ配った状態まで検査した。

## 修正したこと

### AsyncFormのfield error表示先

- DOMに`name`を持つcontrolが1件あるか、という推測を廃止した
- `useFieldState()`を使うcomponentが表示可能なfield nameをform contextへ登録する
- 同名radio等に備えて参照数を持ち、最後の表示先がunmountした時だけ登録を外す
- 返されたfield errorの**すべて**に表示先がある場合だけ一般errorを抑止する
- 既知+未知fieldの混在は、既知field errorと一般errorを両方残す
- `FieldArray` root errorは重複表示せず、空配列なら追加buttonへfocusする

### AsyncSelectのfield contract

- `useFieldState()`へ接続し、AsyncForm pending中のdisabledを合成する
- server / client field error、`aria-invalid`、`aria-describedby`、変更時clearを揃える
- hidden inputではなくvisible comboboxをfirst-error focus対象として登録する
- `required`は入力した検索文字列ではなく、候補の選択値がある場合だけ満たす
- 選択後もFormDataへは検索文字列ではなく`getFormValue()`の値を送る

### transportとraw FormValues

- `serializeJsonBody()`をlower-level transport APIとして`EndpointSpec`と`createSubmit()`で共有した
- helperは値を補わず、各呼び出し側が自身の既存契約に沿って既定値を決める
- `EndpointSpec`の既存契約どおり、`undefined`はbodyなし、`null`はJSON `null`として送る
- `createSubmit()`は従来どおり`null` / `undefined` payloadを空objectとして送る
- BigInt / cycle等はnetworkへ出さず、両経路とも`SERIALIZATION`になる
- `createSubmit.timeout`は有限な0以上のnumberだけを受け付ける
- `CheckboxGroup`のraw値が0件=`""`、1件=`string`、複数=`string[]`であることを
  英日validation guideとsource commentへ記録した

## 追加した回帰条件

- 既知fieldと表示先のないfieldが混ざってもfailureが消えない
- `FieldArray` root errorは1回だけ表示し、追加操作へfocusする
- `AsyncSelect`がpending disabled、field error、ARIA、focus、clearを継承する
- 検索文字列だけではrequiredを満たさず、候補選択後はhidden valueを送る
- EndpointSpecのundefined / null / BigInt / cycleを個別に回帰検査する
- createSubmitのnull / undefinedが従来どおり空objectになることを回帰検査する
- NaN / Infinity / 負数のtimeoutは`createSubmit()`生成時にfail-fastする

途中、既存のpending検査がguard開始から固定200ms後を観測してfalse-redになった。
action開始とerror出現をDOM状態で待つ検査へ変更し、処理速度による競合を除いた。

## 検査結果

| 検査 | 結果 |
|---|---|
| `pnpm --filter playground exec tsc --noEmit` | 成功 |
| `pnpm --filter playground build` | 成功 |
| `node scripts/check-registry-deps.mjs` | 51 item / 53 file / 252 export、依存漏れなし |
| `pnpm verify`（最終diff） | 35 / 35 |
| `pnpm verify:create` | 113 / 113 |
| `verify-forms`（最終diff、実browser） | 59 / 59、pageerror 0 |
| `verify-submit`（全体runner内） | 36 / 36、pageerror 0 |

## dogfoodへ持ち越すこと

このPRでは`apps/dogfood-*`をまだ作らない。form境界修正と実アプリを同じPRへ混ぜると、
不具合修正の回帰条件とtemplateの製品判断を分離できないためである。次は
[`plan-dogfood.md`](plan-dogfood.md)の順に、workspace aliasではなく実create / registry copy
経路でRepository Pulseから実装し、観測表を残す。
