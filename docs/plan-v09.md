# v0.9a — 配布経路を、先に固めてから開ける

## Context

`docs/handoff.md` §7 が v0.9 に 4 項目を挙げている。

1. レジストリの静的ホスティング
2. カタログをドキュメントサイトにする
3. CI で `npx shadcn add` の実インストール検証（1 が前提）
4. Renovate を動かす

これを **v0.9a（配布）** と **v0.9b（ドキュメント + Renovate）** に分ける。
本計画は v0.9a のみ。

v0.9a の本質は「**このリポジトリが、他人のマシンでコードを実行する側になる**」こと。
`public/r/*.json` を公開した瞬間、利用者は `npx shadcn add https://…` で
その中身を自分のプロジェクトへ書き込む。README は既に
`npx create-webtemplate my-site` と案内している。
つまり配布を開ける前に、**配るものが差し替えられない状態**を作る必要がある。
順番を逆にすると、開けてから塞ぐことになる。

もう一つ、この環境固有の事情がある。作業機は **Windows 実機**で、
handoff §6 の「未検証 #1」がまさにこれ。`pnpm verify` は Windows で
一度も走っていない。handoff §2 の決まりごと 3「直したら必ず `pnpm verify` を
通してから次へ行く」を守るには、**まず緑にする**ところから始まる。

### 事前確認の結果（実施済み）

| 項目 | 結果 |
|---|---|
| プロキシ / 疎通 | `git fetch` ✓ / registry.npmjs.org ✓ / ui.shadcn.com 200 ✓ / api.github.com 200 ✓ / cdn.playwright.dev ✓ |
| リポジトリ | clone 済み。`claude/build-v0.1-v0.8` = origin と同一 (`bdbc7d6`) |
| `docs/handoff.md` | 存在 ✓ |
| node | v24.13.1 ✓ |
| pnpm | **PATH に無い。** corepack から 10.28.0 は取れる（`packageManager` 指定と一致） |
| Playwright のブラウザ | **未インストール。** Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) と Edge は実機にある |
| gh CLI | 2.97.0 あり、**未ログイン** |
| `create-webtemplate` の npm 登録 | **404 — 未登録** |

ブランチは `claude/build-v0.1-v0.8` から **`claude/v0.9`** を切る。`main` では作業しない。

---

## Phase 0 — Windows で `pnpm verify` を緑にする

**これが通るまで他のファイルに触らない。** 赤い土台の上に足すと、
新しい失敗と元からの失敗の区別が付かなくなる。

### 手順

```bash
corepack enable pnpm          # 失敗するなら npm i -g pnpm@10.28.0
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify
```

`playwright install` が通らない場合の退路は handoff §4 の方式。

```bash
CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" pnpm verify
```

ただし**退路は最後の手段**にする。CI は Playwright 同梱の Chromium で回るので、
別のブラウザで緑にしても「CI と同じものを見た」ことにならない。

### 落ちそうな場所（コードを読んで見当を付けた 4 箇所）

| 場所 | 何が起きるか |
|---|---|
| [scripts/verify.mjs:41](scripts/verify.mjs) | `PNPM = "pnpm.cmd"` を `spawnSync` する。corepack の shim が PATH に無いと ENOENT。**Phase 0 の最初の手順がこれを解く** |
| [scripts/verify.mjs:176](scripts/verify.mjs) | `taskkill /pid /T /F` でプレビューサーバを止める。⚠️ 要確認のまま |
| [scripts/pack.mjs:4](scripts/pack.mjs) | `tar` を外部コマンドで呼ぶ。Windows 10 以降は `tar.exe` (bsdtar) があるはずだが未確認 |
| [scripts/verify-create.mjs:153](scripts/verify-create.mjs) | 生成物の中で `pnpm.cmd install` を実行。分岐は既に入っている |

**直し方の方針**: Windows のためだけの分岐を増やさない。
`spawnSync` に渡すコマンド名の解決を 1 箇所に寄せる（既に `PNPM` 定数がある）。
分岐が 2 箇所以上に増えるなら、それは「同じ値を 2 か所に置かない」に反する。

### 緑になったら

`⚠️ 要確認` を消す。**印は 6 箇所にある**（消し漏らすと、次に読む人が
「まだ未検証」と誤解する）。

- [scripts/verify.mjs:30](scripts/verify.mjs), [scripts/verify.mjs:176](scripts/verify.mjs)
- [scripts/pack.mjs:4](scripts/pack.mjs)
- [README.md:474](README.md), [ROADMAP.md:381](ROADMAP.md), [docs/overview.md:286](docs/overview.md)
- [docs/handoff.md:95](docs/handoff.md) の §6 からも該当項目を落とす

消すのではなく「Windows 11 / node 24 / pnpm 10.28 で確認済み」と**確認した条件を書く**。
条件の無い「確認済み」は、次の環境で嘘になる。

---

## Phase 1 — 配布経路の防御（公開より先）

利用者の指示: 「force push の防御など、こちらに責任がある範囲は先に打つ」。
**責任範囲を「自分で直せるもの」と「GitHub の設定でしか直せないもの」に分ける。**
後者は私からは触れないので、コマンドを用意して渡す。

### 1-A. 名前の確保 — `create-webtemplate` が npm で空いている

[README.md:6](README.md) が `npx create-webtemplate my-site` と案内しているのに、
npm に `create-webtemplate` は**存在しない**（registry が 404 を返す）。
このまま公開を進めると、第三者がその名前を取った時点で、
**README に従った人が他人のコードを実行する**。
リポジトリを固めても、入口の名前が他人のものなら意味が無い。

取れる道は 2 つ。**どちらを取るかは利用者の判断**（npm アカウントが要るため）。

| | やること | 代償 |
|---|---|---|
| a. 名前を取る | `npm publish` でプレースホルダ（0.0.1）を先に置く。2FA 必須・trusted publishing (OIDC) にする | npm アカウントと 2FA の設定 |
| b. 案内を変える | README を `npx github:Nasu726/WebTemplate` など**実在する経路**に直す | `npx` の体験が少し落ちる |

**先に b を入れる。** a を待つ間も README が嘘を指さない状態になり、
a をやったら README を戻せばいい。順序として b → a が安全。

### 1-B. GitHub Actions の締め方（私が直せる範囲）

現状の [.github/workflows/verify.yml](.github/workflows/verify.yml) の穴。

**1. `permissions:` が無い。** リポジトリ既定を継承するので、
既定が read-write ならワークフローが `GITHUB_TOKEN` で書ける。
トップに `permissions: contents: read` を置き、必要なジョブにだけ足す。

**2. アクションがタグ参照。** `actions/checkout@v4` / `pnpm/action-setup@v4` /
`actions/setup-node@v4` / `actions/upload-artifact@v4`。
**タグは動く。** 上流が乗っ取られてタグを付け替えれば、こちらは何もしていないのに
次の CI から別のコードが走る。40 桁の commit SHA に固定し、
`# v4.2.2` とタグをコメントで残す（Renovate が SHA を追随する。v0.9b で配線）。

**3. 週次スケジュールと `workflow_dispatch` は残す。**
外部要因の破損に気づくための仕組みなので消さない。

### 1-C. 依存を掴むときの待機 — pnpm の cooldown

`pnpm-workspace.yaml` に 1 行足す。

```yaml
minimumReleaseAge: 4320   # 分。= 3 日
```

公開直後の版を掴まない設定。近年の npm への攻撃は、公開から取り下げまでが
数時間〜1 日に収まっている例が多く、**3 日待つだけで大半をやり過ごせる**。
`--frozen-lockfile` は「lockfile の通りに入れる」だけで、
lockfile を更新する瞬間（Renovate の PR）は守らない。そこを埋める。

同じファイルに `onlyBuiltDependencies: []` を明示する。
pnpm 10 は既定で依存の postinstall を実行しないが、**既定は変わりうる**。
書いておけば意図が固定され、必要になった依存だけを名指しで足す形になる。

### 1-D. GitHub の設定（利用者にしか実行できない）

gh が未ログインで、リポジトリ設定は外向きの変更なので、
**コマンドを用意して渡す。私は実行しない。**

- `main` の ruleset — force push 禁止 / 削除禁止 / PR 必須 / `verify` を必須チェック / linear history
- タグの ruleset — `v*` の作成後の移動・削除を禁止（リリースタグの差し替え防止）
- Settings → Pages → Source: **GitHub Actions**（Phase 2 の前提）
- Actions → Workflow permissions を **read-only** 既定に

`docs/security.md`（新規・短く）に「何を、なぜ」を書き、
コマンドは実行可能な形でそこに置く。README からリンクする。

---

## Phase 2 — GitHub Pages で `public/` を配る

### 何を出すか

`pnpm registry:build` が吐く `public/r/*.json`（39 項目 + `index.json`）。
公開後の URL は **`https://nasu726.github.io/WebTemplate/r/<name>.json`**
（project site なのでリポジトリ名がパスに入る）。

### `.github/workflows/pages.yml`（新規）

```
on: push (branches: [main]) / workflow_dispatch
permissions: contents: read           ← トップは read だけ
jobs:
  build:  pnpm install --frozen-lockfile → pnpm registry:build → 404.html を置く
          → upload-pages-artifact
  deploy: permissions: pages: write, id-token: write   ← ここだけ昇格
          environment: github-pages
          needs: build
```

**PR からは deploy しない。** fork からの PR で任意のコードが
公開ホストに載る経路を作らないため。`push: [main]` と `workflow_dispatch` だけ。

**deploy は verify が緑のときだけ。** 配る JSON は利用者のプロジェクトに
書き込まれるものなので、検査を通っていない中身を出さない。
`verify.yml` を再利用する形（`workflow_call` 化、または pages.yml 内で `pnpm verify` を呼ぶ）に
するかは、実装時に**ジョブの重複が出ない方**を取る。

### 404 の扱い（handoff §6 の未検証 #3）

`public/404.html` を置く。GitHub Pages の project site は
`404.html` を **HTTP 404 のステータスで**返す（と言われている）が、
**確かめずに書かない**。デプロイ後に実測して結果を記録する。

```bash
curl -o /dev/null -w "%{http_code}\n" https://nasu726.github.io/WebTemplate/r/does-not-exist.json
```

404 が返らないホスティングだった場合は、その事実を
`docs/overview.md` の「未検証」欄に**残す**（消さない）。

---

## Phase 3 — 本物の `npx shadcn add` を通す

handoff §6 の未検証 #2。これまで
[scripts/verify-install.mjs](scripts/verify-install.mjs) が
**CLI と同じ依存解決を再現して**代替していた。今回は本物を使う。

### 先に潰すべき技術的な穴

`registry.json` の `registryDependencies` は **`@nasu/action` 形式**（30 箇所超）。
shadcn CLI がこの名前空間を解決するには、利用者の `components.json` に

```json
{ "registries": { "@nasu": "https://nasu726.github.io/WebTemplate/r/{name}.json" } }
```

が要る。**つまり `npx shadcn add https://…/r/action-button.json` を
まっさらなプロジェクトでいきなり叩くと、依存の解決で落ちる可能性が高い。**

これは推測なので、**まず実測する**。
[scripts/serve-registry.mjs](scripts/serve-registry.mjs)（既にある）で
`public/` を 127.0.0.1:5055 に配り、本物の CLI を当てて挙動を見る。
公開を待つ必要が無く、CI でも同じことができる。

観測してから、どちらかを選ぶ。

| | やること |
|---|---|
| a. `registries` を案内する | README に `components.json` へ 1 行足す手順を書く。`@nasu/...` はそのまま。shadcn 3.x の正式な形 |
| b. build 時に URL を焼く | `build-registry.mjs` が `registryDependencies` を絶対 URL に展開。利用者の設定は不要だが、**ホスト名が生成物に埋まる** |

**a を第一候補にする。** b はホスト名という「2 か所目」を作る
（このリポジトリのバグの原因そのもの）。ただし a が実測で通らなければ b に倒す。

### `scripts/verify-install-real.mjs`（新規）

既存の `verify-install.mjs` は**消さない**。あれはオフラインで回る速い検査で、
本物の CLI はネットワークに依存する。**役割が違うので両方置く**。

やること:

1. `serve-registry.mjs` で `public/` を配る
2. 作業ディレクトリにまっさらな TS プロジェクトを作る（`verify-install.mjs` の tsconfig 生成を**関数に切り出して共有**する。書き写さない）
3. 本物の `npx shadcn@latest add <URL>` を実行
4. 展開されたファイルを `tsc --noEmit` に通す
5. **わざと壊して赤くなることを確かめる**（handoff §5 の最後の項目。判定を足しただけでは落ちるか分からない）

`pnpm verify` の工程に足す（18 → 19 工程）。ネットワークが無い環境では
理由を印字して**明示的に飛ばす**（黙って縮退しない）。

### CI に載せる

`verify.yml` に上記の工程が乗る。加えて、Pages のデプロイ後に
**公開 URL に対する煙検査**を pages.yml の最後に置く
（ローカル配信で通っても、公開ホストの content-type や
リダイレクトで落ちることがあるため）。

---

## v0.9b（この計画の外）

- カタログ（`apps/playground`）をドキュメントサイトにする。
  各部品の `npx shadcn add` の行は **`registry.json` から生成**する（手で書かない）
- Renovate を動かす。`helpers:pinGitHubActionDigests` と
  `minimumReleaseAge` を Renovate 側にも設定
- Vite の `base` を `/WebTemplate/` にする件は v0.9b で扱う
  （Pages の project site はサブパス配信のため）

---

## 触るファイル

**新規**

- `.github/workflows/pages.yml`
- `scripts/verify-install-real.mjs`
- `public/404.html`
- `docs/security.md`
- `docs/plan-v09.md` / `docs/result-v09a.md`（このリポジトリの慣習）

**変更**

- `.github/workflows/verify.yml` — `permissions` / SHA ピン留め
- `pnpm-workspace.yaml` — `minimumReleaseAge` / `onlyBuiltDependencies`
- `scripts/verify.mjs` — 新工程の追加、Windows 対応の確定
- `scripts/verify-install.mjs` — tsconfig 生成を切り出して共有
- `README.md` / `ROADMAP.md` / `docs/overview.md` / `docs/handoff.md` — 入口の案内、`⚠️ 要確認` の解消、v0.9a の記録
- `packages/create-webtemplate/package.json` — publish するなら `repository` / `publishConfig`

---

## 検証

各 Phase の終わりで必ず `pnpm verify` を通す。**赤いまま次へ行かない。**

```bash
pnpm verify           # Phase 0 の後は 18 工程、Phase 3 の後は 19 工程
pnpm verify:create    # 入口 29 判定
```

Phase ごとの確かめ方。

| Phase | 何をもって完了とするか |
|---|---|
| 0 | Windows 実機で `pnpm verify` が 18/18。`⚠️ 要確認` が 6 箇所とも解消 |
| 1 | `pnpm-workspace.yaml` の設定後に `pnpm install` が通る。workflow の SHA が全て 40 桁。`docs/security.md` のコマンドがそのまま貼れる形 |
| 2 | 公開 URL から `curl` で JSON が取れる。存在しないパスの**実測ステータス**を記録 |
| 3 | まっさらなプロジェクトで本物の CLI が通り、`tsc --noEmit` が緑。**わざと壊して赤くなることを確認済み** |

### 利用者にしかできないこと（実装中に依頼する）

1. Settings → Pages → Source を **GitHub Actions** に
2. `main` とタグの ruleset を入れる（コマンドは `docs/security.md` に用意する）
3. `create-webtemplate` を npm で確保するかの判断（1-A）
4. `git push` の認証（gh 未ログイン。push とその後の PR 作成は指示を待つ）
