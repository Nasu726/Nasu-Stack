# v2.0 Stable 後 — 全体リファクタリング計画

## 目的

v2.0.0で固定したpublic contractを変えずに、次の変更を安全かつ安くする。

1. 1つのファイルを直す理由を減らす
2. 同じ判定・文字列・配布知識を1か所へ寄せる
3. 検査が何を実行したかを、件数と終了コードの両方で保つ
4. shadcnのcopy ownershipと、利用者が受け取るファイルの単純さを守る

リファクタリング自体を新機能の理由にはしない。外から見える名前、export、既定値、DOMの
意味、keyboard / focus、CLIの質問順と出力、registry itemと依存関係は維持する。

## 2026-08-28の基準線

- `v2.0.0`: 検査済みcommit `2b7837c`、immutable Release公開済み
- `main`: post-release記録を含む`250088d`
- registry: 51 item / real shadcn install 51 item・53 file
- `pnpm verify`: 33 / 33
- `pnpm verify:create`: 112 / 112
- state browser: 98 / 98、pageerror 0
- responsive: 日英29 page × 5幅
- TypeScript / TSX / MJS / Astro / CSS: 33,458行

行数上位は次のとおり。ただし、行数は優先順位ではなく調査の入口にだけ使う。

| ファイル | 行数 | 混ざっている責任 |
|---|---:|---|
| `apps/playground/src/App.tsx` | 1,680 | catalog shell、15種のstate demo、test probe |
| `packages/create-nasu-stack/index.mjs` | 1,385 | CLI制御、scaffold、日英UI、日英HowToUse |
| `scripts/verify-states.mjs` | 1,092 | 98判定の複数scenario |
| `registry/nasu/components/ui/layout.tsx` | 907 | 同じregistry itemのlayout primitive群 |
| `scripts/verify-nav.mjs` | 876 | nav / dialog / tabs / popover / paginatorのscenario |
| `scripts/verify-create.mjs` | 871 | CLI、生成結果、full install / browser |
| `registry/nasu/components/ui/data-table.tsx` | 780 | 1つのDataTable contractと内部表示 |

## 実測した構造上の問題

### R0. 検査の判定集計が複製されている

`must()`、checks配列、失敗一覧、終了コードの組み立てが11本以上にある。表記差だけでなく、
失敗詳細を出さないscriptやpageerrorを別に数えるscriptがあり、checkerを直すたびに同じ
変更を繰り返す。`scripts/_check.mjs`へ集約し、scenario側には「何を判定するか」だけを残す。

### R1. catalog shellとstate scenarioが同居している

`App.tsx`を触る理由が、header、language、embedded preview、Action、autosave、search、cursor、
toastまで広がった。catalog shellとstate tabを分け、state側も通信・render・listの責任で
分ける。検査用idと操作可能なprobeは削らず、DOM契約を前後で比較する。

### R2. CLI実行制御と長い利用者文書が同居している

CLIの引数解析を直すだけで、700行を超える日英HowToUse本文と同じファイルに触れる。
実行入口、引数 / 対話、scaffold、利用者向け文書へ分ける。ただし配布tarballのfile一覧、
bin、実行コマンド、生成結果は変えない。packした実物からmodule不足も検査する。

### R3. browser verifierがscenario単位になっていない

1,000行の検査は、失敗箇所の所有者とintentional break対象が分かりにくい。起動と集計は
現在の1 processに保ち、scenario関数だけをimportする。判定数、順序、文言、pageerror集計を
前後で一致させる。Chromium processを増やす分割はしない。

### R4. build / fixtureの小さな知識が散っている

TypeScript sourceを一時directoryへcompileしてaliasを書き換える処理、temp cleanup、server
readinessなどに類似がある。入力と出力の境界を明示できるものだけhelper化する。異なる
失敗理由を同じhelperへ押し込まない。

## 分割しないもの

- `layout.tsx`は行数だけでは分割しない。1 registry itemを追加した利用者へ多数の内部fileを
  配る費用の方が大きい。責任が別itemとして成立した場合だけ別PRで審査する
- `data-table.tsx`等のpublic itemも、private helperを別fileへ逃がすだけの分割はしない
- 日英catalog文言は、translation checkerが比較できる現在の1 mapを保つ
- Action / validation / cursor等のpublic contractを「きれいな型」に置き換えない
- test数を減らして速く見せない。並列度と重複実行の改善だけを速度改善と呼ぶ

## PRの波

| Wave | 変更 | 完了条件 |
|---|---|---|
| 0 | 計画、共通check harness | 全対象scriptの判定数・失敗詳細・exitが一致、intentional failureが赤 |
| 1 | catalog shell / state demo分離 | state 98/98、全tab / responsive、App.tsxがshell責任だけになる |
| 2 | create CLI内部module分離 | light 79/79・full 113/113、3 templateのnpm install / build / browser、pack実物で起動 |
| 3a | states / nav verifierのscenario分離 | state 98/98・nav 76/76と順序を維持、intentional breakが該当scenarioを赤にする |
| 3b | create verifierのscenario分離 | light 79/79・full 113/113と実行順を維持、intentional breakが該当scenarioを赤にする |
| 4 | compile / fixture / build helper整理 | 同じ一時treeを複製せず、Windows cleanup・並列lockを維持 |
| 5 | public registry内部監査 | public file / export / registryDependencies不変、51/51 real install |
| 6 | 全体監査 | verify 34/34、verify:create 113/113、Pages deploy / public smoke成功 |

各Waveは独立PRを基本とする。前のPRをmainへmergeし、Pagesの公開smokeまで成功してから
次のbranchをmainから切る。大きなmoveと挙動変更を同じPRへ入れない。

## リファクタリング共通のDefinition of Done

- public API、registry item、target path、CLI option、既定動作に意図的変更がない
- 行数だけでなく、変更理由または重複する知識が実際に減っている
- helper名がdomainの違いを隠していない
- 既存の判定数と主要な判定文言を前後で比較する
- checker / test harnessを変えた場合、わざと壊してexit 1を確認する
- Windows実機の`pnpm verify`と`pnpm verify:create`を通す
- commit / PR / main Pagesの直接証拠を`result-refactor-v2.md`へ残す
