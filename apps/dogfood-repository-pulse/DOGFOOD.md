# Repository Pulse dogfood記録

## provenance

- 起点: `main`の`549fad518285474269b7428b318d5f97018b5004`
- 公開Pages検査: Actions run `33386266751`のverify / verify-create / deploy / smoke成功後に導入
- 生成: packした`create-nasu-stack@2.0.1`を`npm exec --package=file:<tgz>`で起動
- 生成引数: `dogfood-repository-pulse --lang en --template vite --yes`
- registry: 公開`https://nasu726.github.io/Nasu-Stack/r/{name}.json`
- CLI: `shadcn@4.17.0`固定、`--yes --overwrite`
- 導入item: `search-list`、`data-table`、`load-more-list`、`copy-button`、`error-boundary`

workspace aliasは使っていない。追加されたsourceと依存はこのappが所有する。

## 検査結果

- app単体: `23 / 23`（固定API、Chromium、320〜1920px）
- root: `pnpm verify` = `36 / 36`
- 生成物: `pnpm verify:create` = `113 / 113`
- app自身の`npm install`は脆弱性0件で、`package-lock.json`を保持する

## 観測

| 観測 | 内容 | 現時点の判断 |
|---|---|---|
| 生Tailwind | hero、metric、issue labelの見た目をapp側で記述 | domain固有の表現。primitive候補にしない |
| 足りないprimitive | なし。既存のcomponent / hook / contractで構成できた | 追加しない |
| 邪魔なdefault | 英語appでも`SiteHeader`、`ThemeSwitcher`、`AsyncBoundary`、`DataTable`等のfallback/ARIA文言が日本語 | copy-owned sourceを英語化した。2本目でも繰り返すならmessage contractを検討 |
| 文書の不足 | `VITE_*`をsecretにしない境界は十分明確だった | 変更不要 |
| 反復実装 | 外部JSONを`unknown`からdomain型へfail-closedで変換する処理 | 1本目なのでpublic API化しない。次appでも形が似るか観測 |
| escape hatch | `DataTable`のresponsive/sortはcomponentを使用し、localeだけcopy-owned sourceを編集 | componentから降りずに解決。locale APIは未判断 |

## productへ戻さなかったもの

- GitHub response parser、rate limit文言、repository URL構築はapp/domainの責任。
- browser tokenを便利機能として追加しない。private repositoryはserver proxyの責任。
- 自動infinite scrollへ変更しない。追加読込の意思決定を利用者へ残す。
