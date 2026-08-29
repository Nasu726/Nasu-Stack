# v2.0.1候補 — 外部reviewの確定修正結果

## 結論

外部reviewで再現可能だった`FieldArray`のdynamic `min` + native resetを修正し、
v2で増えた契約とREADMEの説明、完了済みrefactoringとROADMAP、GitHub Releaseの
実際の保護状態を一致させた。新しいprimitive、public prop、public exportは追加していない。

version更新、tag、GitHub Releaseはこの変更に含めない。修正PRのmergeとmain公開smokeを
確認した後、release engineeringとして別に扱う。

## 1. FieldArray

### 再現

playgroundへ次の操作を追加した。

1. `min=0`、0行でmountする
2. 親から`min=2`へ変更し、effectが2行を補う
3. native reset buttonで`form.reset()`する
4. `notes.0` / `notes.1`が残り、2つのremove buttonがdisabledであることを測る

product codeを直す前に`node scripts/verify-forms.mjs`を実行すると、追加したreset判定だけが
`names: []`で失敗し、exit 1になった。既存判定を含む42件中、この1件だけが赤だった。

### 修正

reset時にmount時の`initialItems`を複製し、現在の`min`へ足りない行を新しいstable keyと
`createItem()`で補ってからstateへ戻す。mount時の初期値を変更せず、`max`低下時に入力済み
dataを捨てない既存契約も変えていない。

修正後の同じbrowser suiteは42 / 42、`pageerror` 0で成功した。stable key、追加・削除focus、
nested name、min-max、native resetの既存判定も同時に通っている。

## 2. public contractと説明

- README / overviewの日英両方で、`Action`を「覚えるただ1つの契約」ではなく
  「中心契約」と説明した
- validationとcursor paginationは、その機能を選んだ場合だけ個別の小さな契約を使うと明記した
- public registry contractは51 item / 53 file / 251 exportのまま
- ROADMAPとhandoffで、PR #32〜#39の内部refactoringを進行中ではなく完了として記録した

## 3. Releaseの保護状態

2026-08-30のGitHub API再確認結果は次のとおり。

```json
repository: { "enabled": true, "enforced_by_owner": false }
v2.0.0:    { "immutable": false, "draft": false, "prerelease": false }
```

repository-level Immutable Releasesは有効化したが、過去のreleaseへは適用されない。
したがって既存`v2.0.0`をimmutableとは呼ばず、保護済みtag、既存Releaseを上書きしないworkflow、
version付きURL、SHA-256、manifestで保護していると文書を訂正した。

将来releaseは`gh release create <tag> release/*`でdraft作成、asset添付、publishを順に行う。
checkerへこのasset付きcreate経路と、`gh release upload`を使わないことを追加した。workflowから
`release/*`を意図的に外すと狙ったassertionでexit 1になり、復元後は成功した。

## 4. ローカル検査

- `node scripts/check-translations.mjs`: 16 / 16対
- catalog translation: 570 / 570件
- registry contract: 51 item / 53 file / 251 export
- `pnpm verify`: 34 / 34
  - forms browser suite: 42 / 42、`pageerror` 0
  - responsive: 29ページ × 5幅、はみ出しなし
- `pnpm verify:create`: 113 / 113
  - Astro / blog / Viteを実際にinstall、audit、型検査、build、配信
  - 本物のshadcn CLIで部品を追加
  - blogは12ページ × 5幅、Astro / Viteは各1ページ × 5幅を検査

PRのrequired checksとmerge後のmain Pages / 公開smokeは、PR工程で確認する。
