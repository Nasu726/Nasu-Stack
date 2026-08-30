# v2.0.1 — patch release結果

## release candidate

PR #40で修正した互換bug fixを、public contractを変えず`2.0.1`へ揃えた。
PR #41のmerge後、tagをpushする前に追加の境界bugが見つかったため、最初の
release candidateは公開せず、[`result-v201-boundary-fixes.md`](result-v201-boundary-fixes.md)
の修正を同じ未公開`2.0.1`へ取り込んだ。

- root / `create-nasu-stack` package: `2.0.1`
- Stable URL: `v2.0.1/create-nasu-stack-2.0.1.tgz`
- public registry contract: 51 item / 53 file / 251 exportの基準線を維持
- playground / site / 生成される利用者applicationのversionは変更しない
- `v2.0.0`が`immutable: false`だった履歴は変更しない

## release assetの事前検査

次の3経路を同じcheckoutで実行した。

1. `pnpm release:build`
2. `pnpm release:build v2.0.1`（tag workflowと同じ引数形）
3. `pnpm release:build -- v2.0.1`

すべて次の同一結果になった。

- asset: `create-nasu-stack-2.0.1.tgz`
- size: 271,977 bytes
- SHA-256: `5367e8ea68e8316b0c4d688a1434ec92bd420226b93623e54058950ba22be2b4`
- manifest: `nasu-stack-2.0.1-manifest.json`

不一致の`v2.0.2`を渡すと`tagとpackage versionがずれています`でexit 1になった。
このlocal hashは同じWindows checkout内の3経路が一致する証拠であり、公開assetのhashは
Releaseから再downloadしたbyteを公開checksumと照合して別に確認する。

## local検査

- `pnpm verify`: 35 / 35
- `pnpm verify:create`: 113 / 113
- translation parity: 16組
- public registry contract: 51 item / 53 file / 251 export

`verify:create`ではAstro最小構成・ブログ構成・Vite構成を生成し、依存導入、
本物のshadcn CLI、型検査、build、配信、5画面幅のbrowser検査まで通した。

## 残るrelease工程

1. release PRのrequired checks
2. merge commitのmain Pages build / deploy / 公開smoke
3. そのcommitへの注釈付き`v2.0.1` tag
4. tag workflowとimmutable Release
5. 公開tarball / checksum / manifestの再download監査

tagとReleaseの直接証拠はrelease PRへ追記する。
