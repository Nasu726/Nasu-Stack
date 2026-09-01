# Repository Pulseの構成

[English](./HowToUse.md)

コマンドは`package.json`があるproject rootで実行します。`.env.example`を
`.env`へコピーし、`npm install`と`npm run dev`を実行してください。

同梱の`package-lock.json`はcommitしてください。この雛型が検査を通った依存treeを
固定しています。依存を更新した場合も、buildとbrowser検査を通した後のlockfileを
commitします。

## 実装の地図

| 場所 | 責任 |
|---|---|
| `src/App.tsx` | page compositionとアプリ固有の文言 |
| `src/lib/config.ts` | 描画前の公開環境変数検証 |
| `src/lib/github.ts` | GitHub URL、HTTP error翻訳、responseのruntime検証 |
| `src/components/recipes/search-list.tsx` | debounce、stale request中断、検索状態 |
| `src/components/ui/load-more-list.tsx` | cursor状態、明示的な次page、retry、focus復帰 |
| `src/components/ui/data-table.tsx` | sort、paging、tableからcardへのresponsive composition |
| `src/components/ui/copy-button.tsx` | clipboard状態と読み上げ |
| `src/components/ui/error-boundary.tsx` | render failureの局所化 |

`src/components`、`src/hooks`、`src/lib`以下のファイルはこのアプリへコピーした
application-owned sourceです。workspaceの原本を隠れて参照してはいません。

## データの流れ

`readPublicConfig()`は公開repositoryの座標とAPI URLだけを受け付けます。
`createGithubClient()`は概要、release、検索、cursor式のrecent workという4操作を
提供します。すべてのresponseは`unknown`として入り、Reactへ渡す前に検証します。
そのため、shapeが違う200 responseはrender errorや偽の成功ではなく、画面に見える
`BAD_RESPONSE`になります。

このアプリは`Authorization` headerを送りません。browserの環境変数、request header、
bundle済みsourceはすべて訪問者から読めるためです。

## 対象repositoryを変える

`.env`を編集し、開発serverを再起動します。

```dotenv
VITE_GITHUB_OWNER=Nasu726
VITE_GITHUB_REPO=Nasu-Stack
# VITE_GITHUB_API_URL=https://api.github.com/
```

API URLはHTTPS必須です。固定test fixtureを安全性を下げずに使えるよう、HTTPは
`localhost`と`127.0.0.1`だけ許可します。

## コピー済みitemを追加・更新する

registry aliasは`components.json`にあります。application側の変更を上書きする前に
差分を確認してください。

```bash
npx shadcn@4.17.0 add @nasu/data-table --dry-run
npx shadcn@4.17.0 add @nasu/data-table --diff
```

`--overwrite`は差分確認後だけ使います。後のregistry releaseがコピー済みsourceを
黙って更新することはありません。

## 検査とdeploy

`npm run verify`はlocal fixture APIでbuildし、Chromiumでsuccess、検索、追加読込、
retry、keyboard操作、設定失敗、狭い/広いlayoutを検査します。GitHub自体の可用性を
CIの合否には混ぜません。

`npm run build`は`dist/`を作ります。URLのsubpathへdeployする場合は
`vite.config.ts`の`base`を設定します。公開API URLはGitHub Enterpriseにも向けられますが、
private accessにはserver-side proxyが必要です。browser tokenで代用しません。
