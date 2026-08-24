# 引き継ぎ — 新しいセッションはここから読む

このリポジトリの作業を別のセッションに引き継ぐための入口です。

**ここには要約しか書きません。** 中身を書き写すと、片方を直してもう片方が
古いまま残ります（このリポジトリで何度も踏んだ失敗です）。詳しい話は
各ファイルへのリンク先を読んでください。

---

## 1. まず読む順番

| 順 | ファイル | 何が書いてあるか |
|----|----------|------------------|
| 1 | `docs/overview.md` | 目的・対象・4 つの層・設計を決めている 6 つの考え・検査の哲学 |
| 2 | `docs/boundaries.md` | **Nasu Stack・アプリ・サーバの責任分界と escape hatch** |
| 3 | `ROADMAP.md` | 版ごとに作ったものと、**踏んだ罠の記録** |
| 4 | `docs/astro-and-react.md` | Astro と React が 1 つのプロジェクトで共存する理由 |
| 5 | `registry/nasu/lib/action.ts` | 利用者が覚えるただ 1 つの契約 |

`docs/plan-*.md` と `docs/result-*.md` は各版の計画と結果です。過去の判断の
理由を知りたいときだけ読めば足ります。

**いま動いている作業は v2.0.0 へ向けた機能整理と拡張です。** 計画と候補の採否は
[`plan-v2.md`](plan-v2.md)、実施結果は [`result-v2.md`](result-v2.md) を正とします。
v1.0.0 の release engineering は [`plan-v1.md`](plan-v1.md) と
[`result-v1.md`](result-v1.md) に残しています。
直前のreview対応は [`plan-v09f-review.md`](plan-v09f-review.md) と
[`result-v09f-review.md`](result-v09f-review.md) です。

**v0.9f で、外から来た人が読む面を英語にしました。**
`README.md` / `SECURITY.md` / `docs/boundaries|overview|security|astro-and-react.md`
は英語で、日本語版は `*.ja.md` です。カタログは英語が既定で `?lang=ja`。
**この引き継ぎと `plan-*` / `result-*` は日本語のままです**（読むのはこちらだけなので）。
**v0.9e で `WebTemplate` から `Nasu Stack` へ改名しました**
（経緯は [`rename.md`](rename.md)。過去の記録は当時の名前のままです）。
この 2 つで直したものは、ほぼ全部「検査が緑のまま壊れていた」ものでした。
同じ間違いを繰り返さないための材料として、先に読むことを勧めます。

---

## 2. 作者からの決まりごと

コードより先にこれを守ってください。

1. **`main` で作業しない。** ブランチを切って PR にする
2. **手を動かす前に計画を書く。** 規模が大きく、1 つの変更が広範囲を壊す
3. **慎重に進める。** 直したら必ず `pnpm verify` を通してから次へ行く
4. 説明は日本語。コメントは「何をしているか」ではなく **「なぜそうしたか」** を書く
5. **配布に関わる設定を触るときは [`docs/security.md`](security.md) を読む。**
   公開した時点で、このリポジトリは他人のマシンでコードを実行する側になります

---

## 3. いまどこまで来ているか

- `main` … v1.0.0 Stable と、次回 release の tag 引数修正まで merge 済み
- `v1.0.0` … 検査済み `6e44cfb` を指す immutable tag。GitHub Release 公開済み
- v2 … worklist をそのまま足さず、既存 item への吸収・hook・recipe・非採用まで
  [`plan-v2.md`](plan-v2.md) の複雑さ予算で判断する

**公開済みです。** https://nasu726.github.io/Nasu-Stack/
（`/catalog/` に部品のカタログ、`/demo/` にデモサイト、`/r/*.json` にレジストリ）

### 配っている雛型は 3 つです

| `--template` | 中身 | 原本 |
|---|---|---|
| `astro` | 1 ページだけ。自分で組み立てたい人向け | `packages/create-nasu-stack/scaffold/astro/` |
| `blog` | ブログ・LP・会社概要・問い合わせ・RSS・sitemap・404 | **`apps/site` から生成します**（下記） |
| `vite` | React のアプリ | `packages/create-nasu-stack/scaffold/vite/` |

対話では最初に English / 日本語、次に「まっさらな状態から / 雛型を使う」を
選びます。非対話では `--lang en|ja --template astro|blog|vite --yes` です。
選んだ言語はターミナルだけでなく、生成する `README.md`、`HowToUse.md`、
`.env.example` にも使います。

`blog` の中身は `apps/site`（公開しているデモ）から
`scripts/build-create-template.mjs` が写します。**手でコピーして commit しません。**
2 か所に置くと「デモは直したが雛型は古いまま」が静かに起きます。

`scaffold/blog/` に置いてあるのは、astro の足場と**違うところだけ**です
（`package.json` と記事の `.md`）。記事だけは原本がどこにも無いので、
そこが唯一の定義になります。**`apps/site` の記事は写しません**——
「この記事は検査用です」と自己申告する文面が利用者全員のブログに配られるためです
（`verify-create.mjs` がファイル名の集合で見張っています）。

外部 AI から公開停止（HOLD）を含むレビューを受けました。全文は
[`docs/review-external-v09a.md`](review-external-v09a.md)、こちらの検証結果と
対応方針は [`docs/plan-v09b.md`](plan-v09b.md) にあります。
**最重要の P0 判定は誤報でした**が、その背後の指摘（利用者の経路が
リリース判定の外にある）は正しく、v0.9b で直しています。

### 過去の CI の失敗（記録）

1 回目は「開発コンテナは root だから通るが、CI の runner は root ではないので
`/home/claude/...` に書けない」でした。同じ間違いは
`scripts/check-portability.mjs` が機械で捕まえます。

---

## 4. 検査の走らせ方

```bash
pnpm install
pnpm verify           # 30 工程（独立したものは並列）。型・ビルド・配布物・実ブラウザ
pnpm verify:create    # 入口の検査 112 判定。**npm** で install / build します。生成物に本物の CLI で部品を足すところまで
pnpm pages:build      # 公開する public/ を組み立てる（レジストリ + 入口の tarball）
pnpm release:build    # package versionに対応するGitHub Release用tarball + SHA-256
```

v1.0.0 の release は完了しています。次回も release PR を merge し、Pages の deploy と
公開先 smoke が成功した commit だけへ tag を打ちます。tag workflow は同じ
`verify` / `verify-create` をもう一度通し、version 付き asset を GitHub Release へ出します。
PR head や検査前の commit へ先に tag を打たないでください。

実際の v1.0.0 tag workflow では、`pnpm` が引数区切りの `--` を script へ渡し、
最後の Release 作成 job だけが失敗しました。製品検査は成功し、同じ hash の asset を
既存 tag へ公開済みです。原因は PR #16 で直しました。次回は tag を打つ前に
`release:build` を引数なし・tag 直接・`-- tag` の 3 経路で実行し、同じ失敗を防ぎます。

公開したものを外から確かめる検査もあります。手元で試すときは
`public/` を配ってから同じものを回します。

```bash
BASE_PATH=/Nasu Stack node scripts/serve-registry.mjs 5055
node scripts/verify-published.mjs http://127.0.0.1:5055/Nasu Stack
```

**`BASE_PATH` を必ず渡してください。** 本番はサブパス配信です。
渡さないと `public/` が `/` に生え、**root を指したリンクが手元でだけ通ります**
（v0.9c で実際にこれに騙されました）。

**`pnpm verify` が緑でないまま次の作業に進まないでください。** この
リポジトリの価値の半分は、部品そのものではなく「壊れたら機械が気づく」
状態にあります。

実ブラウザの検査でブラウザが見つからないときは、環境に用意されている
Chromium を指してください。

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm verify
```

---

## 5. 触るときに知っておくと事故らないこと

`ROADMAP.md` の各版の「踏んだ罠」に全部書いてありますが、繰り返し出てくる
ものだけここに挙げます。

- **flex の子は既定で `min-width: auto`。** 中身より小さくなれないので、
  横一列に幅のあるものを渡された瞬間に画面からはみ出します。これで 3 回
  やられました。横に並べるときは `min-w-0` を疑ってください
- **Astro の island に渡せるのは JSON になる値だけ。** 関数も要素も渡せません。
  `.astro` で `brand={<a href="/">…</a>}` と書くとビルドが構文エラーになります。
  これが `Action`（関数）と `ActionSpec`（`{url, method, …}`）が二本立てで
  ある理由です
- **同じ値を 2 か所に置かない。** ヘッダ高さ、タブ一覧、下書きの判定、
  入力欄のクラス、依存の宣言 — このリポジトリのバグはほぼ全部これです。
  `packages/create-nasu-stack/template/` を commit していないのも同じ理由
- **測るときは、測りたい状態を作ってから測る。** 画像の場所取りは画像の
  読み込みを止めてから、はみ出しは実際にホイールを回してから測ります。
  推測で書いた検査は、**通っているように見えて何も見ていません**
- **判定を足しただけでは、落ちるかどうか分かりません。** わざと壊して
  赤くなることを確かめてください。実際それで検査側の穴が見つかりました。
  v0.9a では、判定を書いてわざと壊しても**緑のまま通りました**——
  カタログ側に「その不具合が出る条件のボタン」が無かったためです
- **狭い側だけ見ていると気づけません。** 端末幅の検査は 1024px までです。
  器を広くして中の本文にだけ幅を付けた画面は、**全部緑のまま通ります**
- **利用者として一度使ってみてください。** 部品側の検査が全部緑でも、
  生成物を触ると詰まります。v0.9a では 3 件 + 報告 12 件が出ました
- **利用者が打つ道具で検査してください。** 生成物の README は `npm install` と
  書いているのに、検査は pnpm で回していました。**別の道具を確かめても、
  利用者の経路を確かめたことになりません**（v0.9b で直しました）
- **手元の node_modules を見ないでください。** 宣言した依存が間違っていても
  手元では気づけません。registry へ実際に問い合わせます
- **検査に、色や文字の「表記」を書かないでください。** `/rgba?\(/` のような
  判定は、道具の版が上がった日に**部品は無事なのに赤くなります**。
  直すところが無いのに赤いのは、いちばん質の悪い赤です
- **道具の preview に検査を寄せないでください。** astro 7 の preview は
  デーモンになり、勝手に別ポートへ逃げ、親 PID が死ぬので止められません。
  ビルド済みの中身は `scripts/_static.mjs` で自分で配ります
- **「はみ出していない」は「崩れていない」ではありません。** 中へ潰れる
   壊れ方があります。実測でタブが 13px、段組の列が 48px、Frame が 24px に
   なっていましたが、**どれも判定は緑でした。**
   `check-responsive.mjs` が潰れも見るようになりました（v0.9d）
- **交差軸の指定は、畳んだ瞬間に別の軸の指定になります。** `Columns` の
   `items-start` は横並びなら「上端に揃える」ですが、縦積みになると
   「左端に揃える」です。幅を持たない子が中身の幅まで縮みます
- **`client:idle` は、タブが見えていないと発火しません。** 押される場所
   （テーマの切り替えなど）に使うと、開いた直後に無反応になります
- **同じことを 2 言語で書いたら、機械で突き合わせてください。**
   ずれるのは**英語版が古くなる方向**です（書いている人が日本語話者なので）。
   意味は見られないので、`check-translations.mjs` は**打てば動くものだけ**
   比べます。v0.9f では、その検査自身が CRLF のせいでコマンドを 1 つも
   見ていませんでした
- **日本語で見ている限り、訳し漏れには気づけません。**
   訳が無い文字列は日本語のまま出るので壊れて見えず、
   英語で開いた人にだけ混ざって見えます（`check-catalog-lang.mjs`）
- **和文は全角なので、行長の上限に当たりません。**
   v0.9f で訳したら、器いっぱいに伸びる段落が 8 件出てきました。
   端末幅の検査は**両方の言語で**回します
- **文字列を目で見て判断しないでください。** 逃がし処理が効いているかは、
   実際に走らせて「破れなかったか」で見ます。v0.9e では、書いたばかりの
   逃がし処理が**何もしない処理**になっていて、走らせる検査だけが気づきました
- **応答の CORS ヘッダは副作用を止めません。** `text/plain` の単純リクエストは
   プリフライト無しで届きます。攻撃者が応答を読めなくても、
   **目的が副作用そのものなら応答は要りません**
- **アクセシビリティは、見た目の改善より重い。** v0.9e で「guard 中も pending」を
   入れたら、確認ダイアログを閉じたあとフォーカスが戻らなくなりました
- **CSS のクラス名は、定義が無くてもエラーになりません。** 余白の段階は
   Tailwind 標準の名前空間を避けているので、`@utility` を書き忘れた形
   （`pt-2xl` など）は**静かに 0px になります。** 見た目が少し詰まるだけなので
   目では見つかりません。v0.9c の時点で 10 か所死んでいて、配っている
   `site-footer.tsx` の中にもありました。`scripts/check-space-utilities.mjs` が見張ります
- **手元の配信サーバを、本番と同じ形にしてください。** `BASE_PATH` の外は
   404 を返します。そうしないと `public/` が `/` にも生え、
   **root を指したリンクが手元でだけ通ります。** v0.9c で、端末プレビューの
   iframe が公開先で 404 を出しているのに判定は緑、という状態を作りました
- **`verify.mjs` の中でサーバを立ててはいけません。** `step()` は `spawnSync`
  なので、子が走る間はイベントループが止まり、**接続は受けるのに応答しません**。
  サーバは必ず別プロセス（`scripts/serve-static.mjs`）にしてください

---

## 6. まだ確認できていないこと

- ~~**Windows の実機。**~~ v0.9a で確認しました（いまは `pnpm verify` 25 工程 /
  `pnpm verify:create` 112 判定が緑です）。**コードを読んで書いた対応のうち
  2 つは実際には間違っていました**（詳細は `docs/result-v09a.md`）
- ~~**`npx shadcn add` の実インストール。**~~ v0.9a で本物の CLI を通しました。
  **利用者の `components.json` に `registries` の宣言が要ります**（無いと
  `Unknown registry "@nasu"` で止まります）。手で書かせる必要はありません。
  `shadcn registry add "@nasu=<URL>"` の 1 コマンドで足せます（v0.9e で実測）。
  `scripts/verify-install-real.mjs` が**その 1 コマンドごと**毎回動かします
- ~~**静的ホスティング上での 404 の扱い。**~~ 公開して実測しました。404 が返ります
  （`verify-published.mjs` が毎回測って印字します）
- **作者自身の使い心地。** 公開したカタログとデモを実機で見て、v0.9c で
  9 件 + 4 件の指摘が出ました（`docs/review-copy-v09c.md`）。
  **部品側の検査はその間ずっと全部緑でした。** 見て触るまで出てきません
- **`blog` の雛型を、実際にブログとして使い続けたときの具合。**
  生成 → install → build → 実ブラウザ（6 ページ × 5 幅）までは機械で見ていますが、
  記事を書き足していったときのことは分かりません

---

## 7. 次にやること

計画は [`docs/plan-v09c.md`](plan-v09c.md)、文言の採否は
[`docs/review-copy-v09c.md`](review-copy-v09c.md) にあります。

### v0.9c の残り

**v0.9c 〜 v0.9e は終わっています。** 残っているのは次です。

1. **`main` へマージ** → `pages.yml` が走って公開されます。
   マージするまで `verify-published` の「設定ゼロで入る」は赤いのが正しい
   状態です（GitHub は既定ブランチの `registry.json` を読むため）
2. **実際に何人かに使ってもらう。** コードだけでは見つからないものが
   毎回出ています（v0.9c〜e で、作者の実機指摘 13 件 + 外部レビュー 20 件以上）
3. shadcn のディレクトリは**急がなくてよくなりました。**
   `npx shadcn add Nasu726/Nasu-Stack/<名前>` が設定ゼロで動きます。
   出すときの要件と entry の形は [手順](shadcn-directory.md) に

### v1.x へ回したもの

- 受け口のレート制限・Turnstile・`Idempotency-Key`
- 目的別の Feature Kits（`@nasu/contact` に UI + 検証 + 送信まで）
- バックエンド（`Stack` という名前はここへ広げるためのものです）

### 作者にお願いすること

- required status check に **`verify-create`** を足すか判断してください。
  `verify.yml` の 2 つ目のジョブとして PR で走るようになっています
  （所要 15〜25 分。public リポジトリなので runner の費用はかかりません）

積み残し（急がないもの): ダッシュボードの雛型（React 側）、`Field` の
その場検証、`DataTable` の列の表示切り替え、一括操作の進捗表示。

---

## 8. 環境についての注意

このプロジェクトは Anthropic のクラウド環境で作られてきました。その環境から
GitHub へ push するには、**セッション起動時にリポジトリが「sources」に
入っている必要があります。** 起動後に追加しても、そのセッションのプロキシには
反映されません（`access denied by the git proxy` が出ます）。

push できないセッションから成果を持ち出すときは git bundle を使ってください。
履歴ごと 1 ファイルに入り、`git clone -b <branch> <file>.bundle` で復元できます。

```bash
git bundle create work.bundle <branch>
```
