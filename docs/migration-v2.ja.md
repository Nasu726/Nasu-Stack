# v1 から v2 への移行

*[English](migration-v2.md)*

## 先に結論

強制される移行作業はありません。Nasu Stack は source を利用者の application へ
copyするため、v2 がその source を裏で差し替えることはありません。v1 application は
現在の file のまま使い続けられます。v1 の registry item 名、public export、semantic
token は1つも削除していません。

v2をmajor releaseにした理由はStable contractの拡張と、1つの意図的な挙動変更です。
`useAction`は、codeが`VALIDATION`またはHTTP `422`のerrorを自動retryしません。
同じ不正な入力の再送はfeedbackを遅らせるだけです。正規のvalidationがserver側の責任
であることは変わりません。

## 新しいprojectを作る

version付きで、release workflowが上書きしないv2のassetを使います。

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v2.0.0/create-nasu-stack-2.0.0.tgz my-site
```

言語、始め方、雛型を選ぶ流れは変わりません。既存の`--lang`、`--template`、
`--yes`を使うcommandもそのまま動きます。

## v1 itemをcopy済みのapplicationを更新する

copy済みのfileは利用者のapplicationが所有します。v2の挙動が必要なitemだけを、
1つずつ更新してください。

1. applicationの現在の変更をcommitします。
2. fileを書かずに、入ってくるitemをpreviewします。
3. fileごとの差分を確認します。
4. 未変更のcopyだけを上書きするか、必要な変更をcustomize済みのcopyへ自分でmergeします。
5. application側のtypecheck、test、buildを実行します。

たとえば次の順です。

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --dry-run
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --diff
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --overwrite
```

最後のcommandは既存fileを置き換えます。applicationにとって安全な差分だと確認するまで
実行しないでください。Nasu Stackには、見えない場所で更新する仕組みを意図的に
用意していません。

## v2で変更した既存item

| item | 変わったこと | 必要な対応 |
|---|---|---|
| `use-action` | `VALIDATION`とHTTP `422`を自動retry候補ではなくterminal failureにした | 422を意図的にretryしていたcodeだけ見直す。それ以外は変更不要 |
| `async-form` | library非依存の任意validation、変換済みaction input、最初のerrorへのfocus、nested field errorのclearを追加 | 既存の呼び方は変わらない。必要な挙動がある場合だけitemを更新する |
| `use-popover` | 実寸によるviewport配置、`floatingRef`、`floatingStyle`、align、明示的な再計測を追加 | 既存の`anchorRef` / `placement`利用は有効なまま |
| `async-boundary` | 任意の`retryLabel`を追加 | source変更は不要 |
| `layout` | registry itemを増やさず`Switcher`と`SidebarLayout`を追加 | exportが必要な場合だけ`layout`を更新する |

文書化したretry policy以外は追加です。機械的な書き換えが必要になるrenameやprop削除は
ありません。

## v2で増えたregistry item

新しいitem名は次のとおりです。

`validation`、`use-interaction-guard`、`use-autosave`、`use-copy`、
`copy-button`、`error-boundary`、`field-array`、`paginator`、`popover`、
`load-more-list`、`search-list`。

必要な責任だけを追加してください。`CursorPage`、`CursorLoader`、`useCursorList`は
`load-more-list`と一緒に入る下位exportであり、別のitem名として覚える必要はありません。
component → hook → contractの降り方はcatalogと[overview](overview.ja.md)にあります。

## 責任境界

v2でも、認証、認可、server側validation、rate limit、idempotency、transaction、
永続draft、database cursorの正しさは引き受けません。所有者の完全な表は
[boundaries.ja.md](boundaries.ja.md)にあります。
