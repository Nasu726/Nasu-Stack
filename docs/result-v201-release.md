# v2.0.1 — patch release結果

## release candidate

PR #40で修正した互換bug fixを、public contractを変えず`2.0.1`へ揃えた。

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
- size: 270,170 bytes
- SHA-256: `c5ae46f4d3e5df3e98550f43162d4e55d821a36ee8942166abc7a4b68bb3a539`
- manifest: `nasu-stack-2.0.1-manifest.json`

不一致の`v2.0.2`を渡すと`tagとpackage versionがずれています`でexit 1になった。
このlocal hashは同じWindows checkout内の3経路が一致する証拠であり、公開assetのhashは
Releaseから再downloadしたbyteを公開checksumと照合して別に確認する。

## local検査

- `pnpm verify`: 34 / 34
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
