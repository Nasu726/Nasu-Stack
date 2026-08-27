# v2.0 Stable 後 — 全体リファクタリング実施結果

[`plan-refactor-v2.md`](plan-refactor-v2.md)の各Waveについて、実装・intentional break・
検査・PR・main公開状態の直接証拠だけを記録する。

## 基準線

- base: `250088dbc748f39dfd5a49222a7f444cb5a83b5f`
- `pnpm verify`: 33 / 33
- `pnpm verify:create`: 112 / 112
- registry: 51 item / 53 installed file
- state browser: 98 / 98、pageerror 0
- responsive: 日英29 page × 5幅

## 実装台帳

| Wave | 状態 | PR | 証拠 |
|---|---|---|---|
| 0: plan / check harness | main公開済み | [#32](https://github.com/Nasu726/Nasu-Stack/pull/32) | main `55cb6c8` / Pages `33099215948` 全job成功 |
| 1: catalog / state demo | main公開済み | [#33](https://github.com/Nasu726/Nasu-Stack/pull/33) | main `74a1828` / Pages `33102054224` 全job成功 |
| 2: create CLI modules | local完了 | — | verify 34/34 / verify-create 113/113 / pack実物からnpm起動成功 |
| 3: verifier scenarios | 未着手 | — | — |
| 4: build / fixture helpers | 未着手 | — | — |
| 5: public registry audit | 未着手 | — | — |
| 6: completion audit | 未着手 | — | — |

## Wave 0 — plan / check harness

### 実施

- 33,458行を棚卸しし、行数と責任数を分けた計画を`plan-refactor-v2.md`へ記録
- 11本以上に複製されていたchecks配列、`must()`、`mustEq()`、失敗一覧、pageerror集計を
  `scripts/_check.mjs`へ集約
- browser harnessも同じ集計器を使うが、browser lifecycleとpageerror収集は`_browser.mjs`に維持
- `verify-check-harness.mjs`を追加し、集計数、失敗詳細、pageerror、子processのexitを自己検査
- 各scenarioの判定内容・順序・件数は変更せず、診断形式とexit ownershipだけを共通化

### intentional break

別processで必ずfalseになる判定を実行し、exit code 1を確認した。成功だけの別processは
exit code 0になる。同じprocess内でも4判定中2失敗・pageerror 1件を正しく分けて集計した。

### local検証

- check harness self-test: 8/8
- action unit: 27/27
- SEO / feed unit: 36/36
- validation unit: 17/17
- resource key unit: 13/13
- receiver unit: 41/41
- create light: 79/79
- `pnpm verify` / `pnpm verify:create`を同じWindows checkoutで同時実行
- `pnpm verify`: 34/34、state browser 98/98、pageerror 0、日英29 page × 5幅
- `pnpm verify:create`: 112/112、Astro / blog / Viteのnpm install、audit、real shadcn、
  typecheck、build、browser、responsiveが成功

### PR / main公開

- PR [#32](https://github.com/Nasu726/Nasu-Stack/pull/32): `verify` 4m27s、`verify-create` 2m57s
- squash merge: `55cb6c8a8682855d14374d67cb74e3ab4e82499c`
- main Pages run `33099215948`: verify、verify-create、build、deploy、公開smokeがすべて成功

## Wave 1 — catalog shell / state demo

### 実施

- 1,680行の`App.tsx`からcatalog shell以外のstate demoとtest probeを分離し、300行へ縮小
- `StateDemo.tsx`は表示順だけを持つ43行のcomposition rootに変更
- state demoを変更理由で4moduleに分割
  - Action / guard / abort: 404行
  - render boundary / copy / autosave: 349行
  - form / search / cursor list: 537行
  - toast: 96行
- registry component、hook、public exportは変更せず、catalog内部のimport境界だけを変更

### local検証

- playground TypeScript: 成功
- playground production build: 成功、78 module
- production preview上の`verify-states.mjs`: 98/98、pageerror 0
- Vite開発serverではStrict Modeによるeffect二重実行を検知したため、CIと同じproduction previewへ
  揃えて再実行した。検査環境差を回帰として記録しない
- 最初の完全検査で、翻訳checkerが`src`直下だけを走査する前提を検知。再帰走査へ直し、
  module分割後の翻訳568/568を確認
- `pnpm verify`: 34/34、state 98/98、pageerror 0、日英29 page × 5幅
- `pnpm verify:create`: 112/112、Astro / blog / Viteのinstall、実shadcn、型、build、browserが成功

### PR / main公開

- PR [#33](https://github.com/Nasu726/Nasu-Stack/pull/33): `verify` 4m27s、`verify-create` 3m16s
- squash merge: `74a182840d34735b8d74d455d9a6bacc8eabef0a`
- main Pages run `33102054224`: verify、verify-create、build、deploy、公開smokeがすべて成功

## Wave 2 — create CLI内部module

### 実施

- 1,385行の`packages/create-nasu-stack/index.mjs`を、publicな実行入口だけを持つ182行へ縮小
- 設定 / UI / template定義、名前・生成先validation、引数解析、対話、scaffold、利用者向け文書を
  変更理由ごとの内部moduleへ分離
- `MIN_NODE`、validation、scaffold、対話関数など従来のpublic exportを入口からre-exportし、
  option、質問順、既定言語、生成結果を維持
- packageの`files`へ`lib`を明示し、配布tgzに内部moduleを含める
- full verifierで実際にtgzをpackし、空の一時projectへnpm installして同梱binから
  英語Astro生成物まで確認する

### 検査が捕まえた不整合

最初のlight検査で、利用者向け文書moduleに`MIN_NODE`のimportが無いことを検知した。入口の
巨大fileでは暗黙に同じscopeだった値がmodule境界を越えていなかったためで、importを明示して
79/79へ戻した。配布file一覧の漏れはソース起動では検知できないため、tgz実物の検査を恒久化した。

最初のPR CIでは`npm exec --package=<絶対tgz path>`がWindowsだけでbinを起動し、Linuxでは
projectを作らず成功終了したため7.49が赤になった。空の一時projectへtgzをnpm installしてから
ローカルbinを実行する経路へ変更し、OSごとのpackage指定解釈に依存しない検査にした。

### local検証

- 全内部moduleの`node --check`: 成功
- create light: 79/79
- `pnpm verify:create`: 113/113。packしたtgzのnpm起動、3 templateのnpm install、audit、
  real shadcn、typecheck、build、production browser、responsiveが成功
- `pnpm verify`: 34/34、registry 51 item / 53 file、state 98/98、pageerror 0、
  translation 568/568、日英29 page × 5幅
