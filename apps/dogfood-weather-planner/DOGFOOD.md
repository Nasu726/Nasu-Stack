# Weather Planner dogfood記録

## provenance

- 起点: `main`の`5e94e3b939234dc92082a6a35874be3097255d8a`
- 公開Pages検査: Actions run `33469478925`のverify / verify-create / deploy / smoke成功後に導入
- 生成: 公開`create-nasu-stack@2.1.0`を実際に`npx`で起動
- 生成引数: `dogfood-weather-planner --lang en --template vite --yes`
- registry: 公開`https://nasu726.github.io/Nasu-Stack/r/{name}.json`
- CLI: `shadcn@4.17.0`固定、`--yes --overwrite`
- 導入item: `async-select`、`use-autosave`、`popover`、`error-boundary`

workspace aliasは使っていない。追加されたsourceと依存はこのappが所有する。

## 無料serviceの境界

Open-Meteoの公開APIはaccount / key / credit card不要だが、無料endpointは非商用、1日10,000
request等の上限、帰属表示が条件である。雛型は帰属linkを画面内に置き、商用利用やsecretを要する
providerはserver / self-host側の責任と文書化する。`VITE_*`にkeyを置くescape hatchは作らない。

## 昇格結果

固定fixture 33件、app単体、生成物、root、Pages build / public smokeをrelease gateへ組み込み、
`docs/plan-dogfood.md`の条件を満たした。このdirectoryを単一原本として、v2.2.0の
`weather-planner`正式CLI雛型とPages作例を生成する。

## 観測

| 観測 | 内容 | 現時点の判断 |
|---|---|---|
| 生Tailwind | 天気card、activity radio、heroの表現 | domain固有。primitive候補にしない |
| 足りないprimitive | 現時点なし | AsyncSelect / useResource / useAutosave / Popoverで構成できる |
| 邪魔なdefault | 英語appでもAsyncSelectとSiteHeaderのfallback / ARIA文言が日本語 | 1本目と反復。copy-owned sourceを英語化し、message contract候補として横断記録する |
| 文書の不足 | Open-Meteoのdata licenceと無料endpointの非商用条件はNasu Stack一般境界の外 | app側README / HowToUseでprovider固有責任として記録 |
| 反復実装 | 外部JSONを`unknown`からdomain型へfail-closedで変換 | Repository Pulseに続く2本目。共通shapeではなく、transport helper候補として横断評価する |
| escape hatch | autosaveのActionだけlocalStorageへ差し替え | queueはhook、保存の正当性と同期はdomainへ残せた |

## productへ戻さないもの

- WMO weather code、Open-Meteo response parser、場所labelはweather domainの責任。
- localStorageをserver syncやoffline weather cacheと呼ばない。
- commercial providerのAPI keyをbrowser設定へ追加しない。
