# 配るときの守り

このリポジトリは、公開した時点で **他人のマシンでコードを実行する側** になります。

```bash
npx shadcn@latest add https://…/r/action-button.json   # 利用者の src/ にファイルが書かれる
npx https://…/create-nasu-stack-0.1.0.tgz my-site     # 利用者の手元でコードが動く
```

だから「作ったものが正しいか」だけでなく、**「配っているものが、こちらの
作ったものと同じか」** を守る必要があります。この文書はその一覧です。

**書いてあることの半分は、私（コード側）では実行できません。**
リポジトリの設定は GitHub の画面か API でしかできないので、
手順とコマンドをそのまま置いてあります。

---

## 1. 何を守るのか

守る対象は 3 つあり、**壊れ方がそれぞれ違います。**

| 守るもの | 壊れると何が起きるか |
|---|---|
| **履歴** | force push でタグや main の中身をすり替えられる。「検査を通った版」と「配られた版」が別物になる |
| **CI** | ワークフローは他人のコードを、書き込み権限のあるトークンの隣で実行する場所。アクションが 1 つ乗っ取られれば十分 |
| **依存** | npm への攻撃はここを狙う。乗っ取ったアカウントから版を publish し、誰かの更新に紛れ込むのを待つ |

---

## 2. 済んでいること（コード側）

### 2-1. ワークフローの権限を落とした

`.github/workflows/*.yml` の先頭に `permissions:` を書きました。
**書かないとリポジトリの既定を継承します。** 既定が read-write のままだと、
ワークフローの中で動く何かが `GITHUB_TOKEN` でリポジトリ自体を書き換えられます。

- `verify.yml` … `contents: read` だけ
- `pages.yml` … トップは `contents: read`。公開する 1 ジョブだけ `pages: write` / `id-token: write`

### 2-2. アクションを commit SHA で固定した

```yaml
- uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
```

`@v4` はタグで、**タグは動きます。** 上流が乗っ取られてタグを付け替えられたら、
こちらは何も変えていないのに次の CI から別のコードが走ります。
読めなくなるので、対応する版をコメントに残しています。

### 2-3. 公開直後の依存を掴まないようにした

`pnpm-workspace.yaml` に `minimumReleaseAge: 4320`（3 日）。

`--frozen-lockfile` が守るのは「lockfile の通りに入れる」ところだけで、
**lockfile を書き換える瞬間**——依存を更新する PR——は守りません。そこを埋めます。

### 2-4. 依存のインストール時スクリプトを許可制にした

`allowBuilds` で `esbuild` / `sharp` を明示的に `false`。
**postinstall は「依存を入れただけ」で任意のコードが動く場所です。**
ここに書いていないものが新しくスクリプトを要求してきたら、pnpm が知らせてきます。

### 2-5. 配るものを、検査を通ったものだけにした

`pages.yml` は `verify.yml` を呼んでから公開します。
配る JSON は利用者のプロジェクトに書き込まれるものなので、
検査を通っていない中身は出しません。PR からは公開しません
（fork の PR で任意のコードが公開ホストに載る経路を作らないため）。

---

## 3. あなたにお願いすること（GitHub の設定）

**上から順にやってください。** 3-1 が終わるまで公開は始まりません。

### 3-1. Pages を有効にする

`Settings` → `Pages` → `Build and deployment` → `Source` を
**`GitHub Actions`** にします。

`Deploy from a branch` を選ぶと、ワークフローを通らずに
ブランチの中身がそのまま出ます。**検査を通っていないものが配られる**ので、
必ず `GitHub Actions` にしてください。

### 3-2. ワークフローの既定権限を read-only にする

`Settings` → `Actions` → `General` → `Workflow permissions` を
**`Read repository contents and packages permissions`** にします。

2-1 で各ワークフローに `permissions:` を書いてありますが、
**書き忘れた 1 本が事故になります。** 既定側も締めておくと、
書き忘れても read だけで済みます。

同じ画面の `Allow GitHub Actions to create and approve pull requests` は
**外して**ください。

### 3-3. main を守る（force push の防御）

`gh` にログインしていれば、次をそのまま貼れます。

```bash
gh api -X POST repos/Nasu726/Nasu-Stack/rulesets \
  -H "Accept: application/vnd.github+json" \
  -f name='main を守る' \
  -f target='branch' \
  -f enforcement='active' \
  -F 'conditions[ref_name][include][]=~DEFAULT_BRANCH' \
  -F 'rules[][type]=deletion' \
  -F 'rules[][type]=non_fast_forward' \
  -F 'rules[][type]=required_linear_history' \
  -F 'rules[][type]=pull_request'
```

画面からやる場合は `Settings` → `Rules` → `Rulesets` → `New branch ruleset` で、
対象を `Default branch`、`Enforcement` を `Active` にして次を入れます。

| 入れるもの | なぜ |
|---|---|
| **Block force pushes**（`non_fast_forward`） | **これが本命です。** force push を許すと、検査を通った履歴を後から別物に差し替えられます |
| Restrict deletions | ブランチごと消して作り直せば、上の防御を回れます |
| Require a pull request before merging | 直接 push を塞ぎます |
| Require linear history | merge commit で経緯を分からなくさせないため |
| Require status checks to pass → `verify` | **検査が緑でないものを main に入れない。** ここが 2-5 と繋がります |

`Require status checks` は、一度 `verify` が走った後でないと選択肢に出てきません。
PR を 1 本通してから設定してください。

### 3-4. タグを守る

リリースを tarball で配るなら（§4）、**タグが動くと配布物が変わります。**

```bash
gh api -X POST repos/Nasu726/Nasu-Stack/rulesets \
  -H "Accept: application/vnd.github+json" \
  -f name='タグを守る' \
  -f target='tag' \
  -f enforcement='active' \
  -F 'conditions[ref_name][include][]=refs/tags/v*' \
  -F 'rules[][type]=deletion' \
  -F 'rules[][type]=non_fast_forward' \
  -F 'rules[][type]=update'
```

### 3-5. あなた自身のアカウント

リポジトリをいくら固めても、**アカウントが取られたら全部やり直しです。**

- 2 要素認証を有効にする（できればパスキーかセキュリティキー。SMS は最後の手段）
- `Settings` → `Developer settings` → `Personal access tokens` を見て、
  **使っていないトークンを消す。** 期限の無い古いトークンが一番危険です

---

## 4. 入口を npm に置かない、という判断

`npx create-nasu-stack my-site` と案内するには npm への publish が要ります。
**このリポジトリは publish しません。** 個人的なプロジェクトとして続けるので、
継続的な保守を約束できないためです。

代わりに **tarball の URL** を配ります。

```bash
npx https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz my-site
```

npm は URL の tarball をそのまま受け取れます（v0.9a で実測）。

この選び方には、面倒を避ける以上の意味があります。

- **npm アカウントという攻撃面が増えない。** 取られると誰でも publish できます
- **名前の取り合いに巻き込まれない。** 配布物は自分のドメイン配下にしかありません

### 残る危険と、その扱い

**`create-nasu-stack` という名前は npm で空いています。**
第三者がその名前で publish すると、`npx create-nasu-stack` と打った人には
**その第三者のコードが動きます。**

こちらから防ぐ手はありません（名前を取ることが唯一の防御で、それはしない判断です）。
できるのは **README にその形を書かないこと** だけです。
tarball の URL だけを案内しています。

もし将来 npm に置くなら、次を先に済ませてください。

1. アカウントに 2 要素認証（必須）
2. **trusted publishing (OIDC)** を使う。長生きするトークンを CI に置かない
3. `npm publish --provenance`。どのワークフローのどの commit から出たかが残ります

---

## 5. 利用者の側から見た守り

こちらが固めても、**利用者は「本物の URL を打った」ことしか確かめられません。**
できることは 2 つです。

- **配布物の SHA-256 を一緒に出す**（`create-nasu-stack.tgz.sha256`）。
  打つ前に照合できます
- **URL を https に限る。** レジストリの JSON も tarball も同じです

```bash
# 1 度落として、それを確かめて、**その同じファイルを実行**します。
curl -fsSL -O https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz
curl -fsSL -O https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz.sha256
sha256sum -c create-nasu-stack.tgz.sha256
npx ./create-nasu-stack.tgz my-site
```

**URL を直接 npx する形では確かめられません。** 取り直して実行するので、
確かめたものと実行したものが同じとは限りません。

---

## 6. まだ埋まっていない穴

**書いておかないと「全部やったつもり」になります。**

- **Renovate をまだ動かしていません**（v0.9b）。SHA で固定したアクションは、
  追随する仕組みが無いと**古いまま放置されます。**
  固定は「勝手に変わらない」代わりに「勝手に直らない」ので、対で必要です
- **配布物への署名はしていません。** SHA-256 は「壊れていないこと」を示しますが、
  「誰が作ったか」は示しません。sigstore などは、利用者が確かめる手順まで
  用意できないと意味がないので、今は入れていません
- **依存の脆弱性を CI で見ていません。** `pnpm audit` を足すかは v0.9b で判断します


---

## 依存の更新と脆弱性、どちらが何を見るか

**両方を同じものに向けると、同じ更新で PR が 2 本出ます。** 片方をマージした
あとに残ったほうが競合し、閉じるべきかどうかも分かりません。役割を分けます。

| | 担当 | 設定 |
|---|---|---|
| Dependabot alerts | **脆弱性の通知と、その修正 PR** | GitHub 側で有効化済み |
| Renovate | **ふだんの更新**（patch / minor / major、lockfile の手入れ） | `renovate.json` |

そのため `renovate.json` では脆弱性の担当を明示的に切っています。

```json
"vulnerabilityAlerts": { "enabled": false },
"osvVulnerabilityAlerts": false
```

### なぜ `minimumReleaseAge` を入れているのか

**publish された直後が、いちばん危ない時間です。** npm へのサプライチェーン
攻撃は、乗っ取ったアカウントから新しい版を出す形が多く、気づかれて取り下げ
られるまでの数時間〜数日が勝負になります。

7 日置くと、その窓をほぼ避けられます。**代償は、正当な修正も 7 日遅れる**
ことです（脆弱性の修正は Dependabot alerts 側が担当するので、そちらは遅れません）。

GitHub Actions は 3 日にしています。数が少なく、影響範囲が CI に閉じるためです。

### なぜアクションを SHA で固定するのか

タグは**動かせます。** `@v4` を指していると、ある日中身が入れ替わっていても
こちらは何も気づけません。SHA なら中身が変われば別の値になります。

**固定した以上、追随する仕組みと対で持つ必要があります。**
無いと「勝手に変わらない」代わりに「勝手に直らない」状態になります。
`helpers:pinGitHubActionDigests` がその担当です。
