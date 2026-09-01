# Weather Plannerの使い方

このguideのcommandはすべて、`package.json`があるWeather Planner projectのdirectoryの
ルートで実行します。

## 1. 起動する

```bash
npm install
cp .env.example .env
npm run dev
```

<http://localhost:5173/>を開きます。添付したTokyoの既定値だけで動くため環境fileのcopyは
必須ではありませんが、公開設定を明示できます。

この雛型にはNasu Stackが検査した`package-lock.json`が入っています。`npm install`後も
gitに含め、npmが変更しなかった場合も依存treeを意図して更新した場合もlockfileをcommitして
ください。

## 2. 最初に表示する場所を選ぶ

`.env`を編集します。

```dotenv
VITE_DEFAULT_LATITUDE=51.5072
VITE_DEFAULT_LONGITUDE=-0.1276
VITE_DEFAULT_LOCATION=London
VITE_DEFAULT_COUNTRY=United Kingdom
VITE_DEFAULT_LOCALE=en-GB
```

`.env`を変えたらdevelopment serverを再起動します。訪問者はアプリ内で別の場所も検索できます。

`VITE_*`の値はbuild後のJavaScriptから誰でも読めます。座標、表示名、locale、公開API URLは
置けます。API key、token、password、非公開account ID、provider credentialは置けません。

## 3. 無料APIの境界を理解する

既定のOpen-Meteo endpointは、条件を満たす非商用利用ならaccountもkeyも不要です。無料serviceには
利用上限があり、uptime保証はありません。表示dataには帰属も必要です。このproviderを使う間は、
画面の「Weather data by Open-Meteo.com」linkを残してください。

商用製品では適切な商用serviceまたはself-hostを使います。providerがsecretを要求するなら、
自分のserverから呼び、このアプリには自分の公開endpointだけを渡します。
`VITE_WEATHER_API_URL`などbrowserへ配る変数にsecretを書かないでください。

- Terms: <https://open-meteo.com/en/terms>
- Licence: <https://open-meteo.com/en/license>

## 4. 製品へ合わせて編集する

- `src/App.tsx`: page composition、各日のcard、予定control、画面の文言。
- `src/lib/config.ts`: 公開環境変数の検査と安全な既定値。
- `src/lib/weather.ts`: API requestとfail-closedなresponse parser。
- `src/lib/planner.ts`: local draft schema、復旧、保存Action。
- `src/hooks/use-autosave.ts`: copy-ownedなautosave queue。
- `src/components/ui/async-select.tsx`: copy-ownedな検索selector。
- `src/styles/tokens.css`と`src/styles/themes.css`: design tokenとトンマナ。

トンマナはcode中の`data-theme="vivid"`と`defaultTheme="vivid"`で固定しています。訪問者用の
theme pickerは要りません。製品に合わせて両方を`neutral`、`warm`、`editorial`のいずれかへ
変えられます。

## 5. 保存先を意図して変える

添付した保存Actionは、version付きの下書き1件を`localStorage`へ書きます。端末間同期、user account、
version conflict解決、server acknowledgement、offline予報を約束しません。

本物のserver保存を追加するなら、`savePlannerDraft`を自分のreceiverへ送る`Action`へ差し替えます。
requestには`ctx.signal`を渡し、競合とidempotencyの規則はserverで定義し、serverが確認する前に
成功と表示しないでください。

## 6. 公開前に検査する

```bash
npm run verify
```

検査はlive providerではなくlocal fixtureを使います。外部APIの停止で既知の正しいsource releaseを
失敗させず、fixtureによって不正なresponse parserを隠さないようにします。

production buildは次のとおりです。

```bash
npm run build
npm run preview
```

`dist/`を任意のstatic hostへ公開します。同じ公開環境変数をhostのbuild設定へ置いてください。
保存Actionを意図してserver境界へ差し替えない限り、予定はbrowser内だけに残ります。
