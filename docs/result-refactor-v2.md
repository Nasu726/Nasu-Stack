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
| 2: create CLI modules | main公開済み | [#34](https://github.com/Nasu726/Nasu-Stack/pull/34) | main `b9e3767` / Pages `33106595791` 全job成功 |
| 3a: states / nav verifier scenarios | main公開済み | [#35](https://github.com/Nasu726/Nasu-Stack/pull/35) | main `f974b1f` / Pages `33145511135` 全job成功 |
| 3b: create verifier scenarios | main公開済み | [#36](https://github.com/Nasu726/Nasu-Stack/pull/36) | main `a00da77` / Pages `33162898273` 全job成功 |
| 4: build / fixture helpers | local完了 | — | verify 34/34・create 113/113、intentional break exit 1 |
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
projectを作らず成功終了したため7.49が赤になった。空の一時projectへtgzをnpm installした
2回目も、Linuxの`npm exec`はexit 0のままローカルbinを実行しなかった。npmで展開した
packageのbin mappingを検証し、そのtargetをNodeで直接起動する形へ分け、npmのcommand推論と
配布物の完全性を混同しない検査にした。

### local検証

- 全内部moduleの`node --check`: 成功
- create light: 79/79
- `pnpm verify:create`: 113/113。packしたtgzのnpm起動、3 templateのnpm install、audit、
  real shadcn、typecheck、build、production browser、responsiveが成功
- `pnpm verify`: 34/34、registry 51 item / 53 file、state 98/98、pageerror 0、
  translation 568/568、日英29 page × 5幅

### PR / main公開

- PR [#34](https://github.com/Nasu726/Nasu-Stack/pull/34): 最終runで`verify` 4m21s、
  `verify-create` 3m29s。tgz検査のLinux差をCIで2回検知し、上記の経路へ修正
- squash merge: `b9e37679a813b15f51b5516f8fb892c74a359362`
- main Pages run `33106595791`: verify-create、verify、build、deploy、公開smokeがすべて成功

## Wave 3a — states / nav verifier scenario

### 実施

- 1,092行の`verify-states.mjs`を、browser lifecycleとscenario順だけを持つ50行のrunnerへ変更
- Action、search、cursor、recovery、error boundary、autosave、copyの7 scenarioを個別moduleへ分離
- 876行の`verify-nav.mjs`を18行のrunnerへ変更し、foundation、navigation、paginatorの3 scenarioへ分離
- browserは従来どおり各verifierで1回だけ起動し、check集計・pageerror収集・終了コードもrunnerで
  1回だけ確定する。Chromium process数、操作順、判定名は変更していない

### intentional break

search scenarioの最初の判定だけを一時的にfalseへ変え、同scenarioだけをrunnerから実行した。
12判定中1件が指定した詳細`intentional scenario break`付きで失敗し、exit code 1、pageerror 0を
確認した。その後、判定条件と7 scenarioの実行順を元へ戻した。

### local検証

- 全11 scenario moduleの`node --check`: 成功
- production preview上のstate verifier: 98/98、pageerror 0
- production preview上のnav verifier: 76/76、pageerror 0
- `pnpm verify:create`: 113/113。`pnpm verify`との手動同時実行でもcreate側は完走
- 2本の完全browser suiteを手動で同時実行すると、create側の完走後もverify側のresponsive区間が
  通常より大幅に遅くなったため、そのverify process treeだけを停止した。残留browserが無いことを
  確認して単独で再実行し、製品の失敗とlocal資源競合を分けた
- 単独の`pnpm verify`: 34/34、state 98/98、pageerror 0、registry 51 item / 53 file、
  translation 568/568、日英29 page × 5幅

### PR / main公開

- PR [#35](https://github.com/Nasu726/Nasu-Stack/pull/35): `verify` 4m35s、
  `verify-create` 2m52s
- squash merge: `f974b1f4b6892aaef58c2f217acc2851e9afbc18`
- main Pages run `33145511135`: `verify` 4m22s、`verify-create` 3m12s、build、deploy、
  公開smokeがすべて成功

## Wave 3b — create verifier scenario

### 実施

- 919行の`verify-create.mjs`を、設定、1つのtemp tree、template lock、scenario順、集計だけを
  持つ102行のrunnerへ変更
- light 79判定を、generation、safety、generated configuration、guidanceの4 scenarioへ分離
- full 34判定を、配布tgz、共有registry server、3 templateの実動作scenarioへ分離
- `CASES`と`PAGES`はrunnerの唯一の一覧として維持し、template生成からcopy完了までのlock、
  npm / shadcn / browserの実行順、判定名、同じ作業treeを変更していない
- checker coordinationは旧runner 1 fileだけを読む前提をやめ、runnerとscenario directoryの
  `.mjs`を再帰的に結合して必須のfail-closed診断を確認する

### intentional break

generation scenarioの最初の判定だけを一時的にfalseへ変えた。79判定中、指定した
`0. テンプレートが生成できる`だけが詳細付きで失敗し、exit code 1を確認した。その後、
元の生成数判定へ戻した。

checker側も、projects scenarioの`local registryを配れませんでした`だけを一時的に外した。
`full create検査でlocal registry不在をskipしない`のassertionでexit code 1になり、文言復元後は
checker coordinationが成功することを確認した。

### local検証

- runnerと7 scenario moduleの`node --check`: 成功
- create light: 79/79
- `pnpm verify:create`: 113/113。配布tgzのnpm展開・bin起動、Astro / blog / Viteの
  install、lockfile不変、production audit、実shadcn、型、build、browser、responsiveが成功
- 最初の`pnpm verify`でchecker coordinationの旧runner単体走査を検知。directory再帰走査へ
  直し、同checkerの成功と上記intentional failureを確認
- 修正後の`pnpm verify`: 34/34、state 98/98、pageerror 0、registry 51 item / 53 file、
  translation 568/568、日英29 page × 5幅

### PR / main公開

- PR [#36](https://github.com/Nasu726/Nasu-Stack/pull/36): `verify` 4m27s、
  `verify-create` 2m59s
- squash merge: `a00da77f44bef173a8f5591b08adc5c38490783b`
- main Pages run `33162898273`: `verify` 4m17s、`verify-create` 2m57s、build、deploy、
  公開smokeがすべて成功

## Wave 4 — build / fixture helper

### 実施

- 6本のverifierに重複していた「固定出力先の初期化、tsconfig生成、TypeScript原本の同期compile、
  ESM境界、終了時cleanup」を`scripts/_compiled-fixture.mjs`へ集約
- action、SEO、resource keyで個別実装していた`@/…`の出力後alias変換を、出力treeの深さから
  相対importを計算する1つの処理へ統合
- verifier側には、対象原本と固有のcompiler optionだけを残した。固定の出力先、compile順、
  同期実行、cleanupの`recursive / force`条件は変更していない
- server待機、createの一時tree、Windows再試行、workspace lockも棚卸ししたが、失敗条件と
  lifecycleが異なるためこのhelperへ混ぜず、既存の責任境界を維持

### intentional break

validation verifierがcompileする原本名だけを一時的に存在しない
`validation-intentional-break.ts`へ変更した。TypeScriptのTS6053とhelperの呼出箇所を出して
exit code 1になり、compile失敗を握り潰さないことを確認した。原本名の復元後は17/17へ戻った。

### local検証

- helperと6 verifierの`node --check`: 成功
- action 27/27、SEO / feed 36/36、resource key 13/13、validation 17/17、
  receiver 41/41
- submit verifierは単独でcompileとHTTP契約12項目まで成功し、完全検査ではサイトを含む
  28/28、pageerror 0
- `pnpm verify`: 34/34、state 98/98、pageerror 0、registry 51 item / 53 file、
  translation 568/568、日英29 page × 5幅
- `pnpm verify:create`: 113/113。配布tgz、Astro / blog / Viteのinstall、lockfile不変、
  production audit、実shadcn、型、build、browser、responsiveが成功
