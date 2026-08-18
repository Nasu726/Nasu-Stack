# セキュリティについて

## 見つけたときの連絡先

**公開の Issue に書かないでください。** 直る前に読まれます。

GitHub の [Security Advisories](https://github.com/Nasu726/WebTemplate/security/advisories/new)
から非公開で報告してください。

返事は**確約できません。** 個人が趣味で続けているもので、
対応の期限も約束していません（下の「約束していないこと」を読んでください）。
急ぎで確実な対応が要る用途には向きません。

## このリポジトリが何であるか

Web サイトの部品を配る**雛型**です。

**npm には publish していません。**

shadcn のレジストリのディレクトリには、**掲載を申請する準備をしています**
（この文を書いている時点では、まだ載っていません）。載ったとしても npm には
出しません（ディレクトリに載せるのに npm は要らないためです）。

配っているのは次の 3 つだけです。

| | |
|---|---|
| `https://nasu726.github.io/WebTemplate/r/*.json` | shadcn CLI が読むレジストリ |
| `https://nasu726.github.io/WebTemplate/create-webtemplate.tgz` | 入口の CLI |
| 同 `.sha256` | 上の tarball のハッシュ |

**npm に `create-webtemplate` という名前では出していません。**
その名前は空いているので、`npx create-webtemplate` と打つと
**他人のコードが動きます。** 必ず上の tarball の URL を指してください。
（この間違いは `scripts/check-forbidden.mjs` が機械で見張っています。）

tarball は打つ前に照合できます。

1 度落として、それを確かめて、**その同じファイルを実行**します。

```bash
curl -fsSL -O https://nasu726.github.io/WebTemplate/create-webtemplate.tgz
curl -fsSL -O https://nasu726.github.io/WebTemplate/create-webtemplate.tgz.sha256
sha256sum -c create-webtemplate.tgz.sha256   # OK と出たら
npx ./create-webtemplate.tgz my-site
```

（Windows の PowerShell なら
`Get-FileHash create-webtemplate.tgz -Algorithm SHA256` で出した値を、
`.sha256` の中身と見比べてください。）

**README の 1 行（URL を直接 npx する形）では確かめられません。**
あの形は URL からもう一度取り直して実行するので、
**確かめたものと実行したものが同じとは限りません。**

**これは「誰が作ったか」を示しません。** 示せるのは
「取れたものが、こちらが出したものと同じか」だけです。

## 約束していないこと

- **継続的な保守を約束していません。** 個人のプロジェクトです
- 脆弱性への**対応期限を約束していません**
- 古い版へのバックポートはしません。直すのは最新だけです

こうした条件が受け入れられない用途では、使わないでください。
理由と代償は [`docs/security.md`](docs/security.md) に書いてあります。

## 配っているコードについて、先に言っておくこと

部品はブラウザで動きます。**ブラウザ側の確認は守りではありません。**

| 部品 | 誤解しやすいところ |
|---|---|
| `FileDrop` の `accept` / `maxSize` | 名前とブラウザの推測を見ているだけです。**サーバ側で大きさ・種類・中身の署名を必ず確かめてください** |
| `HoneypotField` | 単純な bot を減らすだけです。狙って来る相手には効きません |
| `EndpointSpec.defaults` | クライアントが送る値なので、**入力で上書きできます。** 認可に使う値をここに置かないでください |
| `ActionError.displayMessage` | サーバの `message` は画面に出しません（内部の事情が漏れるため）。出したい文言は `userMessage` で返してください |
| `PUBLIC_` / `VITE_` で始まる環境変数 | **ブラウザに配られます。** 誰でも読めるので、鍵を置かないでください |

## 依存について

- GitHub Actions は**すべて SHA で固定**しています。タグは動かせるためです
- ワークフローには最小の `permissions:` を明示しています
- 生成物は `npm audit` を毎回通しています（high 以上があると CI が落ちます）
- 依存の更新は Renovate、脆弱性の通知は Dependabot alerts が担当します
  （役割は `renovate.json` に書いてあります）
