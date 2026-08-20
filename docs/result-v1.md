# v1.0.0 — Stable release result

## 判定

**Release PR を出せる状態です。** 機能追加はせず、Stable contract、日英の公開導線、
version 付き配布物の経路を整えました。`v1.0.0` tag はまだ打ちません。

## 変更結果

- root と `create-nasu-stack` の version を `1.0.0` に統一
- README の Beta 表記を Stable contract と責任境界の説明へ変更
- 日本語 README の catalog を `?lang=ja`、demo を `/demo/ja/` へ修正
- Astro demo と Blog 雛型に英語・日本語の page / article / RSS / sitemap を用意
- create CLI は最初に English / 日本語、次に始め方と種類を選び、生成する
  `README.md`・`HowToUse.md`・`.env.example` も選択言語に統一
- `HowToUse.md` のコマンドは `package.json` があるプロジェクトルートで
  実行することを明記
- Markdown の metadata 表が 320px で 3px はみ出す問題を修正
- Pages の最新版 tarball と同じ pack 処理から、GitHub Release 用の
  `create-nasu-stack-1.0.0.tgz`、SHA-256、manifest を生成
- Stable の正式な導入URLを上書きしない version 付き Release asset に限定し、
  Pages の固定URLは最新 main の preview / smoke 用に分離
- release workflow は tag と package version の一致、既存の全検査、
  既存 Release の非上書きを条件にする

## 検証結果

- `pnpm verify`: **29 / 29**
- `pnpm verify:create`: **112 / 112**
- catalog translation: **430 / 430**
- 公開デモ: 日英を含む **29 URL × 5 幅**で、はみ出し・潰れなし
- 生成 Blog: 日英 **12 page × 5 幅**で、はみ出し・潰れなし
- Astro check: error 0（既知の `astro:content` deprecation hint のみ）
- `pnpm release:build`: version / tag / CHANGELOG / Stable 表記 / pack / checksum 成功
- clean worktree の同じ入力から release asset を 2 回生成し、両方とも
  263,180 bytes、SHA-256
  `37f0101385f51cba9d3b530142233de275ca6fa9b9aad2fcfc67e2a0a5c6a39b`

検査中に Blog 雛型だけ `SITE_JA` が欠けて型検査に失敗する問題と、英語の
metadata 表が 320px で 3px はみ出す問題を検知しました。公開 demo だけを直して
生成物を見落とさないため、どちらも `verify:create` の失敗に従って修正しています。

## merge 後

1. `main` の Pages deploy と公開先 smoke が成功したことを確認する
2. その検査済み merge commit に `v1.0.0` tag を打つ
3. release workflow が version 付き tarball / checksum / manifest を公開したことを確認する

PR head や検査前の commit へ tag は打ちません。
