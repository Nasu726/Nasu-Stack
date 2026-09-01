# セキュリティについて

*[English](SECURITY.md)*

## 見つけたときの連絡先

**公開の Issue に書かないでください。** 直る前に読まれます。

GitHub の [Security Advisories](https://github.com/Nasu726/Nasu-Stack/security/advisories/new)
から非公開で報告してください。

返事は**確約できません。** 個人が趣味で続けているもので、
対応の期限も約束していません（下の「約束していないこと」を読んでください）。
急ぎで確実な対応が要る用途には向きません。

## このリポジトリが何であるか

Web サイトの部品を配る**雛型**です。

**npm には publish していません。**

**shadcn のレジストリのディレクトリにも載っていません。**
そして、載る必要がありません。`npx shadcn add Nasu726/Nasu-Stack/<名前>` は
掲載無しで動きます。将来載せたとしても npm には出しません
（ディレクトリに載せるのに npm は要らないためです）。

配っているのは、次のプロジェクト管理下のものだけです。

| | |
|---|---|
| `https://nasu726.github.io/Nasu-Stack/r/*.json` | shadcn CLI が読むレジストリ |
| `https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz` | version付きStable入口。workflowは上書きしない |
| `https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz` | 内容が変わる最新 main の確認用 |
| 同 `.sha256` | それぞれの tarball のハッシュ |

**npm に `create-nasu-stack` という名前では出していません。**
その名前は空いているので、`npx create-nasu-stack` と打つと
**他人のコードが動きます。** 必ず上の tarball の URL を指してください。
（この間違いは `scripts/check-forbidden.mjs` が機械で見張っています。）

tarball は打つ前に照合できます。

1 度落として、それを確かめて、**その同じファイルを実行**します。

```bash
curl -fsSL -O https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz
curl -fsSL -O https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz.sha256
sha256sum -c create-nasu-stack-2.1.0.tgz.sha256   # OK と出たら
npx ./create-nasu-stack-2.1.0.tgz my-site
```

（Windows の PowerShell なら
`Get-FileHash create-nasu-stack-2.1.0.tgz -Algorithm SHA256` で出した値を、
`.sha256` の中身と見比べてください。）

**README の 1 行では checksum を検証しません。** 実行前に同じファイルを
確かめる必要があるときは、上の 4 行を使ってください。

**これは「誰が作ったか」を示しません。** 示せるのは
「取れたものが、こちらが出したものと同じか」だけです。

GitHubのrepository-level release immutabilityは2026-08-30以降に公開するreleaseへ
有効です。過去へは適用されないため、`v2.0.0`は保護済みtag、上書きしないworkflow、
checksum、manifestで守っており、GitHub Immutable Releaseではありません。

## 約束していないこと

**文書化した公開範囲は Stable です。** 引き受けている範囲と、あなたが書く
必要があるものの一覧は [`docs/boundaries.ja.md`](docs/boundaries.ja.md) にあります。

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
