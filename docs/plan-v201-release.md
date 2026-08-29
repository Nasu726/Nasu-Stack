# v2.0.1 — patch release engineering

## 目的

PR #40で修正し、main Pagesの公開smokeまで通った互換bug fixを`v2.0.1`として配る。
新機能やpublic contract変更を混ぜず、v2.0.0以降の内部refactoringと検査強化も含めて
patch releaseとして記録する。

## 変更するもの

1. rootと`create-nasu-stack` packageのversionを`2.0.1`へ揃える
2. README、SECURITY、migration、directory guide、CLI commentのStable URLを
   `v2.0.1/create-nasu-stack-2.0.1.tgz`へ揃える
3. CHANGELOGにFieldArray bug fix、public contract不変、内部refactoring、
   immutable release保護を記録する
4. release asset、SHA-256、manifestをtag workflowと同じ経路で事前検査する

## 変更しないもの

- registry item名、公開export、semantic token、component / hook contract
- playground / siteと、生成される利用者application自身のversion
- v2.0.0が`immutable: false`だったという履歴
- 新しいprimitive、recipe、server側の責任境界

## 順序

1. release PRで`verify` / `verify:create` / `release:build v2.0.1`を成功させる
2. PRをmainへmergeする
3. main Pagesのbuild / deploy / 公開smokeを確認する
4. その検査済みmain commitへ注釈付き`v2.0.1` tagをpushする
5. tag workflowのverify / verify-create / releaseを確認する
6. 公開した3 assetを再取得し、version、checksum、manifest、source commitを照合する
7. GitHub APIでReleaseが`immutable: true`であることを確認する

PR headやmain公開smoke前のcommitにはtagを打たない。

## 完了条件

- `2.0.1`のversion、Stable URL、CHANGELOG、asset名が一致する
- `pnpm verify` / `pnpm verify:create`が成功する
- tag不一致の`release:build`がexit 1になる
- PRとmain Pagesがgreenになる
- `v2.0.1` tagがmain公開smoke済みcommitを指す
- immutable GitHub Releaseとtarball / checksum / manifestが公開され、再照合できる
