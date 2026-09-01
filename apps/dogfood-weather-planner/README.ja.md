# Weather Planner

[English](./README.md)

7日分の天気を見ながら予定を残す、state-heavyなNasu Stackのdogfoodアプリです。
場所を検索し、予報を確認し、各日に軽い予定を付けます。保存が終わった最新の下書きは、
ページを再読み込みしても同じブラウザに残ります。

`apps/dogfood-weather-planner`にあるこのアプリは、CLIの`weather-planner`雛型としても
配布します。Nasu Stack本体をworkspace aliasで直接参照せず、公開shadcn経路で導入した
copy-owned sourceを使います。検査済みのこのdirectoryから雛型を生成するため、公開作例と
利用者が受け取るfileが別々に古くなることはありません。

## 無料ですか

ローカル開発、この作例、条件を満たす非商用利用は無料です。既定endpointにaccount、
API key、credit cardは要りません。Open-Meteoの無料APIは非商用向けで、現在は1日
10,000 requestまでです。帰属表示も必要です。商用製品では適切な商用serviceまたは
self-hostを使い、providerのcredentialは`VITE_*`ではなくserverに置いてください。

- [Open-Meteo利用条件](https://open-meteo.com/en/terms)
- [Open-Meteo data licence](https://open-meteo.com/en/license)

## ローカルで起動する

このアプリのdirectoryのルートで実行します。

```bash
npm install
cp .env.example .env
npm run dev
```

<http://localhost:5173/>を開きます。添付した値では最初からTokyoを表示するため、開始地点や
API endpointを変えないなら`.env.example`のcopyは省略できます。

## 検証しているもの

- `AsyncSelect`: 場所検索のdebounce、abort、古い結果の除外、keyboard選択、画面端での候補表示。
- `useResource`: 予報の読込、再試行、依存変更、古いresponseの隔離。
- `useAutosave`: 進行中1件＋最新待機値1件と、dirty / saving / saved / errorの可視化。
- `Popover`: 予報詳細と、focusが戻る予定消去操作。
- `ErrorBoundary`: render failureを予報section内に閉じ込める。
- layout primitive: 320pxから大画面までのwideなcard composition。

予報と場所検索のresponseは`unknown`としてruntime検査を通してからReactへ渡します。不正な
responseや通信失敗を正しい予報として扱わず、再試行できるerrorとして表示します。

## 公開設定

| 変数 | 既定値 | 責任 |
|---|---|---|
| `VITE_WEATHER_API_URL` | `https://api.open-meteo.com/` | 公開予報endpoint |
| `VITE_GEOCODING_API_URL` | `https://geocoding-api.open-meteo.com/` | 公開場所検索endpoint |
| `VITE_DEFAULT_LATITUDE` | `35.6762` | 公開してよい開始緯度 |
| `VITE_DEFAULT_LONGITUDE` | `139.6503` | 公開してよい開始経度 |
| `VITE_DEFAULT_LOCATION` | `Tokyo` | 最初の表示名 |
| `VITE_DEFAULT_COUNTRY` | `Japan` | 最初の国名 |
| `VITE_DEFAULT_LOCALE` | `en` | 日付・数値・検索結果のlocale |

test用localhost以外はHTTPSだけを受け付けます。credential、query、fragmentを含むURLは起動時に
拒否します。

## 保存の境界

予定はこのブラウザの`localStorage`へ保存します。再読み込みからは復旧できますが、端末間同期、
認証付き保存、version conflict解決、offlineの天気dataではありません。それらはapplication /
serverの責任であり、雛型が実装済みと装うことはしません。

## 検査する

```bash
npm run verify
```

アプリをbuildし、固定されたlocal天気serviceを使ってChromiumをkeyboardとpointerで操作します。
再試行、autosaveの復旧、下書きのreloadに加え、320 / 375 / 414 / 768 / 1024 / 1920pxを
確認します。Open-Meteoの稼働状況はrelease判定に混ぜません。

編集と公開の手順は[HowToUse.ja.md](./HowToUse.ja.md)を参照してください。
