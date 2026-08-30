# Dogfooding計画 — 実アプリから責任境界を検証する

## 目的

Nasu Stackを使う実アプリを作り、静的なAPI候補ではなく、実際に繰り返した判断を
次の改善候補として集める。成果物は環境変数を設定すれば動く品質の見本にするが、
検証前から`create-nasu-stack`の選択肢にはしない。

この工程で優先するのは部品数ではない。

- 利用者が毎回同じ安全策や状態同期を書いていないか
- componentの既定値が邪魔でhook / contractへ降りた場所はどこか
- 生のCSS / Tailwindへ降りることが、アプリ固有の表現なのか共通責任なのか
- 文書だけでは責任の所在を判断できなかった場所はどこか
- browserへ置いてよい公開設定と、serverだけが持つsecretを混同していないか

## 先に直す境界bug — v2.0.2候補

dogfood側に回避策を埋め込む前に、外部reviewで再現条件が明確になった既存契約の
不整合を独立したPRで修正する。

1. `AsyncForm`は「field errorの一部」ではなく「すべて」に表示先がある場合だけ
   一般errorを抑止する。DOM探索ではなく、`Field` / `FieldArray`等が表示可能な
   field nameをform contextへ登録する。
2. `AsyncSelect`を`useFieldState()`へ接続し、pending disabled、field error、ARIA、
   first-error focus、変更時clear、選択値に対する`required`を他のfieldと揃える。
3. `createSubmit`と`EndpointSpec`のJSON serializationを共通化し、BigInt / cycleを
   network errorではなく`SERIALIZATION`として扱う。
4. `CheckboxGroup`のraw `FormValues`が0件=`""`、1件=`string`、複数=`string[]`
   であることを文書と型の説明へ正確に残す。
5. `createSubmit.timeout`は有限な0以上の数だけを受け付け、誤設定を通信前に失敗させる。

各修正には、以前の実装なら失敗するunitまたは実browser回帰検査を追加する。

## incubationの配置

最初はworkspace内の`apps/dogfood-*`へ置く。公開demo、通常scaffold、dogfoodの原本を
手で複製しない。dogfoodはNasu Stackのregistry sourceをworkspace aliasで直接使い、
採用すると決めた時点で`create-nasu-stack`の生成経路を別途設計する。

CLIへ追加する条件は次のすべてを満たすこととする。

- 実際の利用手順を少なくとも1回、空の環境から完走した
- 外部サービスが落ちても偽の成功を表示せず、失敗と再試行が分かる
- install / typecheck / build / serve / browser検査を自動化できる
- 320 / 375 / 414 / 768 / 1024 / 1920pxで主要経路が潰れない
- keyboardだけで主要操作を完了でき、loading / empty / error / successが読める
- `.env.example`、設定手順、責任外の運用要件が英語と日本語で分かる
- registry sourceやtemplate sourceの第二の手コピーを作らない

## 作る3種類の実アプリ

### 1. Repository Pulse — read-heavyなViteアプリ

GitHubの公開repository情報を一覧・検索・共有する。`useResource`、Search recipe、
DataTable / LoadMoreList、CopyButton、ErrorBoundaryの実戦を確認する。

- 例: `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO`
- browserへ渡すのは公開repository名と公開API URLだけ
- tokenを要求する構成はserver proxyを別責任として明示し、browserへ置かない
- CIはHTTPを固定fixtureへ差し替え、外部APIの可用性をrelease判定に混ぜない

### 2. Weather Planner — state-heavyなViteアプリ

公開APIから場所と予報を取得し、候補選択、保存中表示、復旧、responsive compositionを
検証する。`AsyncSelect`、`useAutosave`、Popover、ErrorBoundaryを中心に使う。

- 例: `VITE_DEFAULT_LATITUDE`、`VITE_DEFAULT_LONGITUDE`、`VITE_DEFAULT_LOCALE`
- 公開APIだけを使い、secretなしで起動できる
- autosave対象はlocal draftとし、version conflictやoffline同期をserver実装済みと偽らない

### 3. Service Intake — write-heavyなAstro + Reactアプリ

問い合わせ・依頼受付を題材に、`AsyncForm`、`FieldArray`、validation、action、server
receiverとの分界を確認する。

- 例: `PUBLIC_INTAKE_ENDPOINT`
- 公開してよい送信先URLだけをbrowserへ置く
- mail provider key、rate limit、bot対策、idempotencyはreceiver / platform側の責任
- 既存`examples/receivers`を再利用し、secretを設定したreceiverへ接続すれば実送信できる

## 環境変数の品質基準

`PUBLIC_*`と`VITE_*`はbuild後のJavaScriptから誰でも読める。ここにsecret、private token、
mail provider keyを置かない。各appは起動時に必要な公開値をruntimeで検査し、欠落や不正値を
具体的な変数名と修正手順付きで失敗させる。`.env.example`には架空のsecretを置いて
「これを埋めれば安全」と誤解させない。

## 記録する観測

各appのPRに次を表で残す。

| 観測 | 記録する内容 |
|---|---|
| 生CSS / Tailwind | アプリ固有の表現か、毎回繰り返すlayout判断か |
| 足りないprimitive | 既存component / hook / contractの組み合わせで本当に解けないか |
| 邪魔なdefault | escape hatchで降りた理由と、変更時の既存利用者への影響 |
| 文書の不足 | 迷った責任境界と、必要だった具体例 |
| 反復実装 | 2本以上のappで同じ安全策を実装したか |
| escape hatch | componentからhook / contractへ降りて解決できたか |

同じ実装が1本で現れただけではpublic APIを増やさない。2本以上で繰り返し、かつ
Nasu Stackが引き受ける責任境界内だと説明できるものだけを次の検討対象にする。

## PRの分割

1. v2.0.2候補のform / transport境界修正
2. Repository Pulse
3. Weather Planner
4. Service Intake
5. 横断結果と、採用・文書化・非採用の判断

各PRで`pnpm verify`を完走する。CLIへ昇格させるPRだけは`pnpm verify:create`にも
dogfood由来の生成・install・build・browser判定を追加する。
