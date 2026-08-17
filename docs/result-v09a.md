# v0.9a の結果

計画は [plan-v09.md](plan-v09.md)。

---

## Phase 0 — Windows の実機で緑にした

handoff §6 に「未検証」として残っていた 1 つ目です。
**コードを読んで書いた Windows 対応のうち、2 つは実際には間違っていました。**

`pnpm verify` **19 / 19**、`pnpm verify:create` **29 / 29**
（Windows 11 / Node 24.13.1 / pnpm 10.28.0 / Playwright 同梱 Chromium）。

### 見つけて直したもの

#### 1. `spawn("pnpm.cmd")` は動かない — しかも**黙って**動かない

`verify.mjs` には「Windows の pnpm は `pnpm.cmd` なので拡張子を補う」と
書いてありました。**その対応では足りませんでした。**

```
Error: spawn EINVAL
    at serve (scripts/verify.mjs:98:13)
```

Node 20.12 以降、バッチファイル（`.cmd` / `.bat`）を `shell` 無しで spawn すると
EINVAL で拒否されます（CVE-2024-27980 への対策で塞がれました）。

**本当に厄介だったのは、こちらではありません。**

`spawn` は例外を投げるので気づけます。しかし `spawnSync` は投げず、
`{ error }` を返して `status` が `null` になります。`step()` は
`r.status === 0` しか見ていなかったので、**型検査もビルドも「出力が空の ✗」**
として通り過ぎていました。

```
── ビルド (カタログ)          ← vite の出力が 1 行も無いのに、次へ進む
```

判定が落ちたのではなく、**プロセスが起動すらしていない**のに、
一覧の見た目は同じ「✗」です。`step()` に `r.error` の印字を足しました。

直し方は `shell: true` ではありません。それだと引数が cmd.exe に再解釈され、
エスケープの責任がこちらに移ります（Node も DEP0190 で警告します）。
pnpm が `pnpm run` の中で `npm_execpath` に**自分自身の JS** を入れてくれるので、
それを node で直接動かします。バッチを経由しないので shell が要らず、
おまけに「今このリポジトリを動かしているのと同じ pnpm」になります。

#### 2. `child.kill()` は孫を殺さない

`verify-create.mjs` は Windows で `server.kill()` を呼んでいました。
`verify.mjs` は `taskkill /T /F` を使っていました。
**同じ概念が 2 実装あって、片方だけ間違っている**——このリポジトリの
バグの型そのものです。

`pnpm exec vite preview` は 2 段（pnpm → vite）なので、
`kill()` で死ぬのは直下だけです。生き残った孫がこうなりました。

```
Error: EPERM, Permission denied: ...\Temp\wt-create-Ce6ClG
    at scripts/verify-create.mjs:236
```

Windows は開いているファイルを掴むので、後片付けの `rmSync` が落ちます。
**判定は 29 件すべて緑なのに、終了コードだけ 1 になります。**
一覧のどこにも原因が出ないので、いちばん分かりにくい落ち方でした。

さらに、生き残ったサーバは次の実行まで残ります。実際、次に走らせたとき
`11. vite: 配信して画面が出る` が失敗しました。ポート 4599 を掴んでいたのは
**前回の実行の孫**で、既に消えた作業ディレクトリを配信していたためです。

起動と停止を [`scripts/_proc.mjs`](../scripts/_proc.mjs) の 1 か所に寄せ、
`stopTree()` に統一しました。後片付けは失敗しても検査を落とさず、
理由を印字します（`_browser.mjs` の `shot()` と同じ考え方）。

#### 3. タップ領域の保証が**縦だけ**だった（本物の欠陥）

```
✗ タップ領域が 24px 未満: 1 件 (a 23x44 "RSS")
```

7 ページ × 5 幅 = 35 件。原因は 1 つで、フッタの `RSS` リンクです。

部品は `min-h-11`（44px）で高さを保証していましたが、**幅は中身のまま**でした。
`RSS` は 3 文字なので 23px にしかならず、WCAG 2.1 AA の 24px を下回ります。

**これはフォント次第で出たり出なかったりします。** Linux の CI では同じ
`RSS` が 24px を超えていて、ずっと緑のまま通っていました。
「文字が入れば足りるだろう」ではなく、寸法で床を敷く必要があります。

`tokens.css` に `@utility wt-tap`（高さ 44px / 幅 24px）を 1 つ定義し、
配布部品の `min-h-11` 13 か所を置き換えました。
`@media (pointer: coarse)` 側では直せません。この指摘は 1024px 幅
（指ではない端末）でも出るからです。

#### 4. tokens.css への依存が 7 項目で宣言漏れ（波及して見つかった）

`wt-tap` は `tokens.css` が配っている class です。ところが
`site-footer` / `dropdown-menu` / `data-table` / `form-fields` は
`@nasu/tokens` を宣言していませんでした。

**利用者のプロジェクトでは、class が「何も定義されていない文字列」になります。**
エラーも警告も出ません。余白が詰まるだけなら気づけますが、
`wt-tap` が消えても見た目はほとんど変わりません。気づくのは
「指で押せない」と言われたときです。

`gap-sm` や `p-md` も同じ穴で、**v0.9a より前から漏れていました**
（`toast` / `dialog` / `tabs` を含めて 7 項目）。
import 文からは辿れない依存なので、人の目では見つかりません。

`check-registry-deps.mjs` に検出を足しました。`tokens.css` から class 名を
読み出して（**一覧を書き写さない**）、ソースに現れるかを突き合わせます。
足す前に走らせて 7 件の赤を確認してから、宣言を直しています。

### 確かめたが、直す必要が無かったもの

- `pack.mjs` の `tar` — Windows 11 同梱の bsdtar 3.8.4 で動作。`--exclude` も効きます
  （Windows 10 1803 より前には同梱されていないので、そこでは動きません）
- `verify-create.mjs` の `pnpm.cmd` 分岐 — `_proc.mjs` に寄せて解決

### 数字

| | v0.8b | v0.9a Phase 0 |
|---|---|---|
| 検査対象 OS | Linux / macOS | + **Windows 11** |
| `⚠️ 要確認` | 6 か所 | **0** |
| `check-registry-deps` が見る依存 | import 文だけ | + **CSS の class** |

**工程数の記録が 1 か所ずれていました。** 実際に走るのは **19 工程**で、
`handoff.md` も 19 と書いています。`overview.md` だけ 18 のままでした
（`環境に張り付いた絶対パス` を足したときに数えなおしていません）。直しました。
過去の `result-*.md` と `ROADMAP.md` の記述は**その時点の記録**なので触りません。

---

## Phase 1 — 配布経路の防御

公開より先に打ちました。**順番を逆にすると、開けてから塞ぐことになります。**

詳細と、GitHub の設定側で必要な手順は [security.md](security.md) にまとめました。
ここには「何を決めたか」だけ書きます。

### 入口を npm に置かない

`npx create-webtemplate my-site` と案内するには npm への publish が要ります。
**publish しません**（個人的なプロジェクトとして続けるので、継続的な保守を
約束できないため）。代わりに tarball の URL を配ります。

```bash
npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
```

npm が URL の tarball をそのまま受け取れることを実測しました
（ローカルに配って `npx` し、`my-site` が生成されるところまで確認）。

pip の `git+https://…` に相当する形も検討しましたが、**この構成では使えません。**

| 形 | 可否 |
|---|---|
| `npx github:Nasu726/WebTemplate` | ✗ リポジトリ直下に `bin` が無い（CLI は `packages/` の下） |
| 〃（`template/` を含む） | ✗ `template/` は生成物で commit していない。空のまま配られる |
| `npx https://…/create-webtemplate.tgz` | **✓ 実測で成功** |

この選び方は面倒を避ける以上の意味があります。**npm アカウントという
攻撃面が増えません。** ただし `create-webtemplate` という名前は npm で
空いたままです。第三者が取れば、その名前を打った人には他人のコードが動きます。
こちらから防ぐ手は無く、**README にその形を書かないこと**だけが対処です。

### CI

- ワークフローの `permissions` を明示（`verify.yml` は `contents: read` だけ）
- アクションを commit SHA で固定。**タグは動きます**
- **固定は対で必要です。** 追随する仕組み（Renovate）が無いと、
  「勝手に変わらない」代わりに「勝手に直らない」状態になります（v0.9b）

### 依存

- `minimumReleaseAge: 4320`（3 日）。`--frozen-lockfile` が守らない
  「lockfile を書き換える瞬間」を埋めます
- `allowBuilds` で postinstall を名指しの許可制に

`allowBuilds` は**効いているかを確かめました**（`true` にすると esbuild の
postinstall が実際に走り、`false` で走らない）。設定は書いただけでは
効いているか分かりません。なお旧来の `onlyBuiltDependencies` /
`ignoredBuiltDependencies` は **pnpm 11 で削除されます**。
依存更新で pnpm が上がった日に黙って効かなくなるので、新しい名前で書いています。

---

## Phase 2 — 公開の組み立て

### 手順を YAML に書かない

`public/` の組み立ては [`scripts/build-pages.mjs`](../scripts/build-pages.mjs) に、
公開後の確認は [`scripts/verify-published.mjs`](../scripts/verify-published.mjs) に
置きました。ワークフローはそれを呼ぶだけです。

YAML に `run: |` で並べると、**手元で同じものを試せません。**
「CI でだけ落ちる」ものを push を繰り返して直すことになります。
実際この 2 本は、`serve-registry.mjs` で配って手元で 9 判定を通してあります。

### 出しているもの

```
public/r/<name>.json            レジストリ（38 項目）
public/r/index.json             一覧
public/create-webtemplate.tgz   入口の CLI
public/create-webtemplate.tgz.sha256
public/index.html               入口の案内（v0.9b でドキュメントサイトに）
public/404.html
```

`.gitignore` を `public/r/` から **`public/` 全体**に広げました。
生成物を commit すると「原本と配布物の 2 か所」になります。

### 途中で踏んだもの

**1. `npm.cmd` を shell 経由で呼びかけました。** Phase 0 で自分が直した穴を
そのまま持ち込んでいます。`_proc.mjs` の `pnpm()` に寄せて解決しました。

**2. 引数にパスを載せていました。** `--pack-destination <path>` は、
退路（shell 経由）ではエスケープされません。**リポジトリの置き場に空白が
入っているだけで壊れます**（`C:\Users\John Doe\…` は珍しくありません）。
出た場所から移す形に変え、渡す文字列を 1 つも増やさないようにしました。
あわせて `_proc.mjs` の退路に番人を置き、危ない引数が来たら例外にします。

**3. `pnpm pack` は絶対パスを印字します**（npm はファイル名だけ）。
`path.join` で連結すると `public\C:\Users\…` になります。

---

## Phase 3 — 本物の `npx shadcn add` を通した

handoff §6 の「未検証」2 つ目。**計画で予想した地雷が、そのまま出ました。**

```
Unknown registry "@nasu". Make sure it is defined under "registries"
```

`registryDependencies` に `@nasu/action` と書く形は、利用者の
`components.json` に `registries` の宣言があって初めて解決されます。

```jsonc
{ "registries": { "@nasu": "https://…/r/{name}.json" } }
```

これを入れたら通りました。`@nasu/action-button` 1 つで **10 ファイル**が
依存ごと展開されます（`tokens.css` が付いてくるのは、Phase 0 で足した
宣言が効いているからです）。

**URL を直に指定する形は使えません。** その部品 1 つは入りますが、
依存を辿るところで同じ理由で止まります。README を書き換えました。

### 再現側の検査は残します

[`verify-install.mjs`](../scripts/verify-install.mjs)（CLI と同じ解決規則の再現）は
消していません。オフラインで回るので速く、確実に走ります。

**ただし再現である以上、こちらの思い込みがそのまま検査に入ります。**
`registries` の一手を知らなかったので、**ずっと緑のままでした。**
役割が違うので両方置きます。

### [`verify-install-real.mjs`](../scripts/verify-install-real.mjs)

`public/` を手元で配り、**本物の CLI** で 38 項目すべてを入れて型検査します。
公開先が生きているかに依存させません（公開先そのものの確認は
`verify-published.mjs` の仕事です）。

`shadcn` は devDependency に固定しました。`npx shadcn@latest` だと
**毎回「その時点で publish されているもの」を実行する**ことになり、
`minimumReleaseAge` と lockfile を素通りします。

判定 5 件。うち 1 つは **わざと壊す側**です。`registries` を消した
プロジェクトで同じことをして、ちゃんと失敗することを確かめています。
ここが通ってしまうなら、他の 4 つは何も見ていません。

---

## いまの数字

| | v0.8b | v0.9a |
|---|---|---|
| `pnpm verify` の工程 | 19 | **20** |
| `pnpm verify:create` | 29 判定 | 29 判定 |
| 公開物の検査 | 無し | **9 判定**（`verify-published.mjs`） |
| 本物の CLI | 未実施 | **5 判定** |
| 検査対象 OS | Linux / macOS | + **Windows 11** |

## まだ確かめていないこと

- **公開先での実測。** 404 のステータスも content-type も、
  出してからでないと分かりません。`verify-published.mjs` が
  デプロイ直後に走るようにしてあります
- **利用者としての使い心地。** 作者自身が 1 つサイトを作って通すまで、
  公開はしません

---

## Phase 4 — 作者が利用者として触ってみた

**ここで 3 件見つかりました。部品側の検査は全部緑でした。**
生成物を実際に触るまで、どれも表に出ません。

### 1. 生成したプロジェクトでは、部品を足せなかった

生成される README は「部品が足りなくなったら足す」と書いています。
**その手段が入っていませんでした。**

`components.json` が無いので shadcn CLI は「作りますか？」と対話で聞いてきます。
作らせても `registries` が入らないので、次は `Unknown registry "@nasu"` で止まります。
**案内どおりに進んだ人が 2 回続けて詰まります。**

テンプレートに `components.json` を同梱しました。中身は生成時に組み立てます
（URL は [`scripts/_site.mjs`](../scripts/_site.mjs) が唯一の定義）。

これで生成直後から `npx shadcn@latest add @nasu/data-table` が通ります。

### 2. 生成される README が、通らないコードを教えていた

```tsx
<Button action={async () => api.save(値)}>保存する</Button>
```

`Button` は実在しますが、**`action` を受け取りません**（受け取るのは
`ActionButton` です）。v0.8b で足場のコードは直しましたが、
**README の例が取り残されていました。**
初心者が最初にコピーする行がこれです。

import 文も無く、そのままでは動きませんでした。両方直しました。

### 3. 上書きの確認で、非対話だと無言で終わる

生成物には `action.ts` などが既にあります。新しい部品の依存にもそれが入るので、
CLI が 1 つずつ「上書きしますか？」と聞いてきます。

**`--yes` はこの確認を覆いません。** 非対話で走らせると
**終了コード 0 のまま何も書かずに終わります。**
検査で `before=false after=false` になって気づきました。

利用者は N（既定）のままで構いません——自分が書き換えたコードを守るための
確認です。そのことを生成 README に書きました。

### 足した検査

| 判定 | 何を見るか |
|---|---|
| 7.5 | `components.json` があり、`registries` が宣言され、alias が tsconfig と揃っている |
| 7.6 | README の例が実在する名前だけを使っている（**props は見ません**） |
| 8.5 | **本物の CLI で、生成物に部品を足せる**（手元に配ったレジストリを使う） |

**8.5 がいちばん強い判定です。** 7.5 は設定の「形」しか見ないので、
通ることは確かめられません。8.5 の後に 9（型検査）と 10（ビルド）が走るので、
**足した部品が入った状態で通ること**まで見ています。

7.5 は `registries` を消して赤くなることを確認済みです。

### 7.6 の限界を残しておきます

この判定は**名前の存在しか見ません。** 上の 2 番（`Button` に `action`）は
捕まえられません。props まで見るには README のコード例を型検査に掛ける必要が
ありますが、例には `…` のような省略が入っていてそのままではコンパイルできません。
**できないことを、できるつもりで書かない**ために、限界をコードのコメントにも残しました。

### `npx` にローカルの tarball を渡すときの落とし穴

公開前に手元で試すとき、これは**無言で何もしません**（終了コード 0）。

```bash
npx ./public/create-webtemplate.tgz my-site    # 何も起きない
```

`--package` を明示すれば通ります。URL 経由なら素直に動きます。

```bash
npx --package=./public/create-webtemplate.tgz -- create-webtemplate my-site
```
