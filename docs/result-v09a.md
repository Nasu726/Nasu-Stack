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
