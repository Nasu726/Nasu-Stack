# v1.0.0 — Stable release engineering

外部レビューの最終判定は **GO**。この版では機能を増やさず、検査済みの
public contract を Stable として出すための release engineering だけを扱います。

## Stable として固定する範囲

- `registry.json` から配る item 名、公開 export、semantic color token
- `Action` / hooks / components が [`boundaries.md`](boundaries.md) の範囲で持つ契約
- `create-nasu-stack` の 3 種の template と既存の CLI option
- breaking change は次の major version まで入れない

Stable は無欠陥、永続的な保守、または Nasu Stack が責任を持たない server/domain
領域まで保証する宣言ではありません。認証・認可、server-side validation、rate limit、
bot 対策は引き続き利用者側の責任です。

## 変更するもの

1. root と `packages/create-nasu-stack` の version を `1.0.0` にする
2. README の Public Beta 表記を Stable contract の説明へ変える
3. `CHANGELOG.md` に Stable の範囲、対象外、検証結果を残す
4. Pages の mutable な入口とは別に、`v1.0.0` tag から
   `create-nasu-stack-1.0.0.tgz` と SHA-256 を GitHub Release へ出す
5. release workflow は tag と package version の一致を検査し、既存の
   `verify` / `verify-create` が成功した後だけ asset を作る
6. 日本語 README の catalog は `?lang=ja`、demo は `/demo/ja/` を指し、
   Astro demo 自体も英語版と同じ範囲を日本語で生成する

## version を変えないもの

- `apps/playground` / `apps/site`: 配布packageではないprivate workspace
- `scaffold/*/package.json`: 利用者が新しく作るアプリ自身の初期version

これらを Nasu Stack のrelease versionと一緒に上げると、利用者の新規アプリまで
最初から `1.0.0` になり、別の意味のversionを混同します。

## PRに含めないもの

- POST-01〜07、新機能、public contract の追加
- `v1.0.0` tag とGitHub Releaseそのもの
- npm publish

tag はrelease PRをmainへmergeし、Pages deployと公開先smokeが成功した
**そのmerge commit**へ打ちます。PR headへ先にtagを打ちません。

## 完了条件

- version、README、CHANGELOG、release asset名が `1.0.0` で一致する
- 日本語 README から日本語 catalog / demo へ到達でき、公開先 smoke でも検査する
- release assetを手元とPR CIで組み立てられる
- `pnpm verify` と `pnpm verify:create` が成功する
- PR CIの `verify` / `verify-create` が成功する
- merge後のPages deploy / smoke成功を確認してから `v1.0.0` をtagする
- tag workflowがGitHub Releaseとversioned tarball / checksumを作る
