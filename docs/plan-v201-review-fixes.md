# v2.0.1候補 — 外部reviewの確定修正

## 目的

v2.0.0を撤回せず、外部reviewで見つかった再現可能なedge caseと、現在の実装・公開状態に
一致しない文書を直す。新しいprimitiveや責任は増やさない。

## 対象

1. `FieldArray`で、mount後に`min`が増えた状態からnative `form.reset()`しても現在の`min`を守る
2. dynamic `min` → resetを実browserで再現し、修正前に赤・修正後にgreenになる回帰検査を置く
3. README / overviewの「覚える契約はActionだけ」を「中心契約はAction」へ正確化する
4. 完了済みの内部refactoringに合わせてROADMAP / handoffを更新する
5. GitHub Immutable Releasesを有効化し、既存v2.0.0と将来releaseの保護を文書上で区別する
6. release workflowがassetをdraft段階で添付してからpublishする`gh release create <assets>`経路を
   checker coordinationで維持する

## 事実として固定すること

- GitHub API上、既存`v2.0.0` Releaseは`immutable: false`
- repositoryのImmutable Releasesは2026-08-30に有効化したが、GitHubの仕様上future releaseだけに効く
- v2.0.0はversion付きURL、tag ruleset、既存Releaseを上書きしないworkflow、SHA-256、manifestで
  保護している。これをGitHub Immutable Releaseとは呼ばない
- `gh release create <tag> release/*`はdraft作成、asset upload、publishを内部で順に行うため、
  repository-level immutabilityと両立する

## 対象外

- versionを`2.0.1`へ上げる、tagを打つ、GitHub Releaseを作る
- FieldArrayのpublic prop / export追加、controlled化、reorder対応
- 新しいprimitive、recipe、server責任の追加
- 過去の外部review原文の書き換え

## 完了条件

- 修正前のFieldArrayでdynamic `min` → reset検査がexit 1になる
- 修正後に同検査と既存FieldArrayのstable key / focus / nested name / min-maxがすべて成功する
- public registry contract（item / file / export）を変えない
- 日英translation checkerとrelease checker coordinationが成功する
- `pnpm verify` / `pnpm verify:create`が成功する
- PR / main Pages / 公開smokeまで成功し、実施結果を記録する
