# Repository Pulse

[English](./README.md)

Repository Pulseは、Nasu Stackを実アプリで検証するread-heavyなdogfood
アプリです。公開repositoryの概要、Issue / Pull Request検索、明示的な追加読込、
狭い画面でカードへ組み替わるrelease表を提供します。

[公開中のdogfoodアプリを見る](https://nasu726.github.io/Nasu-Stack/dogfood/repository-pulse/)

これはまだ`create-nasu-stack`の新しい雛型ではありません。packしたCLIから生成し、
公開shadcn registryを通して部品を導入しています。利用者と同じcopy-owned sourceの
経路を検証するためです。

## ローカルで起動する

以下は`package.json`があるこのディレクトリで実行します。

```bash
npm install
cp .env.example .env
npm run dev
```

Windowsのコマンドプロンプトでは`cp`の代わりに
`copy .env.example .env`を使います。

同梱例は`Nasu726/Nasu-Stack`を参照します。別の公開repositoryを見る場合は
`.env`の公開値を変更してください。

| 変数 | 必須 | 用途 |
|---|---:|---|
| `VITE_GITHUB_OWNER` | はい | GitHubのownerまたはorganization |
| `VITE_GITHUB_REPO` | はい | 公開repository名 |
| `VITE_GITHUB_API_URL` | いいえ | APIの基点。既定は`https://api.github.com/` |

必須値が無い、または安全でない場合は、空白画面にせず、直すべき変数名を画面に
表示します。

## コマンド

```bash
npm run dev       # 開発server
npm run build     # 型検査とproduction build
npm run preview   # production buildを配信
npm run verify    # 固定fixture APIと実browserによる回帰検査
```

実装の地図、責任境界、deploy時の注意は
[HowToUse.ja.md](./HowToUse.ja.md)を参照してください。

## セキュリティ境界

`VITE_*`の値はbrowser JavaScriptへ埋め込まれ、誰でも読めます。GitHub tokenや
その他のsecretを置かないでください。未認証のGitHub APIはrate limitが低いことを
受け入れています。private repositoryや高い上限が必要なら、認証・認可・rate limit・
log・secret保管を引き受けるserver-side proxyを別途用意します。
