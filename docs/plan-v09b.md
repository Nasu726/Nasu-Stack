# v0.9b — 実害を潰し、検査の境界を利用者に合わせる

## Context

v0.9a を main にマージし、GitHub Pages で公開しました。その状態に対して
**外部 AI から公開停止（HOLD）の判定を含むレビュー**が届き、
Copilot からも 1 件の指摘が入っています。作者自身の利用でも 5 件出ました。

事実確認した結果、**指摘の大半は実在します。** ただし最も重い判定だった
P0-01（astro のバージョンが npm に存在しない）は**誤りでした** —
`astro@7.2.2` は実在し latest でもあり、こちらで install → build まで
通っています。

しかし、**その誤りの背後にある構造の指摘は正しい**というのが重要な点です。

> Green CI is not the problem.
> Green CI の意味を広く解釈しすぎることが問題です。

- 生成物の本当の `install → build → 実ブラウザ` は `pnpm verify:create --full` にある
- ところがリリース判定の `verify.yml` は `pnpm verify` しか動かさない
- しかも `verify:create --full` は **pnpm** を使い、利用者が打つ **npm** を検査していない
- だから「利用者が最初に踏む経路」が丸ごと CI の盲点になっている

レビュアが存在しないと誤認した不具合を**こちらが否定できなかった**のは、
まさにその盲点があるからです。この版の主眼は、個別の修正だけでなく
**リリース判定の境界を利用者の経路に合わせること**にあります。

あわせて、`useAction` に**二重決済・二重送信を起こしうる欠陥が 2 件**
確認されました。「連打を防ぐ」を契約として売っている部品なので、
これは最優先です。

### この版でやらないこと（記録して次へ送る）

| | 内容 | 送り先 |
|---|---|---|
| エディタ補完・スニペット | `.vscode/*.code-snippets` を registry から生成。目印は接頭辞 `wt-` | v0.9c |
| 雛型を増やす | `apps/site`（ブログ/LP/会社概要/問い合わせ/RSS/sitemap）を 3 つ目の雛型に | v0.9c |
| GUI ナビゲータ | **localhost で開く web アプリ**（FastAPI の docs のような形）。ウィンドウを自前で作らない。別パッケージにして本体を汚さない | v0.10 |

**ライセンスは MIT のままにします。** このプロジェクトの核心は
「利用者のプロジェクトへコードをコピーする」ことで、Apache 2.0 §4 の
NOTICE 保持と変更明示は、コピーされた 1 ファイルごとに義務が付きます。
依存（shadcn/ui・Tailwind・Astro・React）も全部 MIT で揃っています。

---

## 検証済みの事実

自分で確かめた結果だけを書きます。

| 指摘 | 実物 | 判定 |
|---|---|---|
| P0-01 astro 版が存在しない | `astro@7.2.2` は実在、latest。install→build 済み | **誤り** |
| P1-01 callback で retry | `use-action.ts:158-160` が retry ループの try 内 | 実在 |
| P1-02 guard race | `:130` で `await guard` → `:138` でようやく lock | 実在 |
| P1-03 receiver | `:110-111` 未設定で `console.log(input)` + `{ok:true}` 200 | 実在 |
| P1-04 `.env` | 生成 `.gitignore` に無し | 実在 |
| P1-05 Node | astro7=`>=22.12.0` / vite8=`^20.19‖>=22.12`、文書は「18 以上」 | 実在 |
| P1-06 リリース判定 | `verify.yml` は `pnpm verify` のみ。`--full` は走らない | 実在 |
| P1-07 bare npx | `index.mjs:6,7,418` に残存 | 実在 |
| P2-08 余白トークン | 実体は `none 2xs xs sm md lg xl 2xl 3xl`。**`3xs` は存在しない** | 実在（v0.9a で私が書いた誤り） |
| Copilot | `_static.mjs:70` の `decodeURIComponent` が try の外 | 実在 |

---

## Phase A — 二重実行を止める（最優先）

`registry/nasu/hooks/use-action.ts` / `use-resource.ts`。
**配布物の欠陥なので、他の何より先に直します。**

### A-1. retry の境界と callback の境界を分ける

いまは action 本体と `onSuccess` / `onSettled` が同じ `try` にあります。
callback が投げると「action が失敗した」と解釈され、**サーバ側では成功済みの
処理が再実行されます。** 決済・メール・登録・削除で実害が出ます。

- retry の対象は action 本体だけにする
- callback の例外は捕まえて別経路で報告する（握り潰さない）
- `useResource` の loader / `onSuccess` にも同じ方針を適用する

### A-2. guard を含めて lock する

`await guard(input)` の**後**に `inFlightRef` を立てているので、
guard が非同期だと複数の呼び出しが lock 前を通り抜けます。
「5 回連打しても 1 回」の既存判定は、**遅い guard を含む race を見ていません。**

- lock を guard の前に取り、`finally` で解放する
- guard 中も `disabled` になるよう状態を持つ（初心者に説明しやすい形）

### A-3. わざと壊して確かめる判定を足す

```
action 成功 + onSuccess が throw + retry=3  →  action の呼び出しは 1 回
guard が 100ms 待つ + 5 回連打              →  action の呼び出しは 1 回
```

**この 2 つが赤くなることを先に確認してから直します。**

---

## Phase B — リリース判定を利用者の経路に合わせる

レビューの核心。ここを直さないと、同じ盲点が残り続けます。

### B-1. 生成物を **npm** で検査する

`scripts/verify-create.mjs` の `--full` は pnpm を使っています。
利用者が打つのは `npm install` です。**別の道具を検査しても、
利用者の経路を確かめたことになりません。**

- 生成物の install / build は npm に切り替える
- pnpm 経路は互換性確認として任意に残す（既定は npm）

### B-2. `pages.yml` の公開前に `verify:create` を通す

いまは `verify` だけが必須です。配るものは、**利用者が実際に踏む検査**を
通ったものだけにします。

```
verify → verify:create（npm 経路）→ build → deploy → smoke
```

### B-3. 宣言した依存が本当に取れるか見る

P0-01 は誤報でしたが、**こちらがそれを機械で否定できませんでした。**
scaffold の直接依存の範囲が registry で解決できるかを判定にします。

---

## Phase C — 検査を並列にし、肥大した部分を整理する

Phase B で検査が重くなるので、**同時にやらないと CI が持ちません。**

### C-1. 並列化

`scripts/verify.mjs` は 20 工程を `spawnSync` で直列に回しています。
依存関係で 3 群に分かれます。

| 群 | 中身 | 並列可否 |
|---|---|---|
| 1 | 型検査・ビルド | **並列可**（互いに独立） |
| 2 | レジストリ生成 → 依存漏れ・展開・本物の CLI | 生成の後、以降は**並列可** |
| 3 | 実ブラウザ 9 工程 | ビルド済みの配信の後、**並列可** |

- `step()` を非同期にし、群の中を `Promise.all` で回す
- **出力が混ざらないようにする。** 工程ごとに溜めて、終わった順ではなく
  定義順に出す（混ざった出力は読めないので、速くなっても意味が無い）
- 実ブラウザは Chromium を複数立てるので、**並列度に上限を設ける**
  （CI の runner は 2 コア。無制限に立てると遅くなる）

### C-2. 整理

肥大しているもの: `verify-create.mjs` 504 行 / `verify-nav.mjs` 491 行。

- 判定の共通形（`must` / `finish` / 集計）が各スクリプトに散っている →
  `scripts/_check.mjs` に寄せる
- `verify-create.mjs` を「生成の検査」「生成物の検査」に分ける
- v0.9a で足した `stopPort` は、自前サーバに移行して使わなくなった箇所がある。
  **使っていないものは消す**

**整理は機能を変えません。** 判定の数と結果が前後で一致することを、
リファクタの前後で突き合わせて確認します。

---

## Phase D — 公開されているものを、見えるようにする

いま公開されているのは `public/`（リンク一覧・レジストリ JSON・tarball）だけです。
**カタログもデモサイトも、一度も公開されていません。**
利用者は「何がもらえるのか」を打つ前に判断できません。

```
/                 いまの案内（入口）
/catalog/         apps/playground  … 38 部品を触って見られる
/demo/            apps/site        … 実際のサイトがどう見えるか
/r/<name>.json    レジストリ
```

**サブパス配信の問題を、ここで自分が先に踏みます。**
GitHub Pages の project site は `/WebTemplate/` の下なので、
Vite は `base`、Astro は `site` + `base` が要ります（preview.md P2-10）。
**利用者にも同じ問題が出る**ので、ここで実測した内容をそのまま
`HowToUse.md` の公開手順に書けます。

- `scripts/build-pages.mjs` が両方をビルドして `public/` に入れる
- `scripts/verify-published.mjs` に「カタログとデモが 200 で取れる」判定を足す
- `README.md` と `public/index.html` からリンクする

---

## Phase E — 残りの P1 と、私が入れた誤り

### E-1. `.env` を守る（P1-04）

生成する `.gitignore` に追加し、`.env.example` も生成します。

```gitignore
.env
.env.*
!.env.example
```

`PUBLIC_*` / `VITE_*` は**ブラウザに入る**ので秘密を置かない、と明記します。

### E-2. Node のバージョンを揃える（P1-05）

astro 7 が `>=22.12.0` を要求するので、**22.12 に統一**します。

- CLI 起動直後に version を見て、足りなければ止める
- 生成する `package.json` に `engines`
- `HowToUse.md` / README を 22.12+ に直す
- `.nvmrc` を生成

「CLI だけ動いて、作ったものが動かない」は初心者には最悪の形です。

### E-3. receiver を fail closed に（P1-03）

`examples/receivers/cloudflare-worker.ts`。
未設定なら 503 と `ok:false` を返します。**送信者に「送れた」と嘘をつかない。**
デモ用途は明示的な opt-in（環境変数）にします。
`console.log(..., input)` は**氏名・メール・本文をログに残す**ので消します。

### E-4. bare `npx create-webtemplate` を消す（P1-07）

`packages/create-webtemplate/index.mjs` の 6・7・418 行。
**エラー時に CLI が危険なコマンドを教えている**のがとくにまずい。
リポジトリ全体を機械で見て、説明文脈（docs の「これは使わない」）だけ
whitelist します。

### E-5. 余白トークンの記述を直す（P2-08）

`HowToUse.md` に `3xs` と書きましたが**存在しません**（実体は `none`）。
v0.9a で私が入れた誤りです。

- 手書きをやめ、`tokens.css` から読んで生成する
- 「文書のトークン一覧 == 実装のトークン一覧」を判定にする

### E-6. `decodeURIComponent` で落ちる（Copilot）

`scripts/_static.mjs:70` が try の外にあります。壊れた percent-encoding が
1 回来ると**サーバプロセスごと落ちます。** try に入れて 400 を返します。

---

## 触るファイル

**配布物（利用者に届く）**

- `registry/nasu/hooks/use-action.ts` / `use-resource.ts` — Phase A
- `packages/create-webtemplate/index.mjs` — `.gitignore` / `.env.example` / preflight / bare npx / README 生成
- `packages/create-webtemplate/scaffold/*/package.json` — `engines`
- `examples/receivers/cloudflare-worker.ts` — fail closed / PII

**検査**

- `scripts/verify.mjs` — 並列化・群の分割
- `scripts/verify-create.mjs` — npm 経路・分割
- `scripts/_check.mjs`（新規）— 判定の共通形
- `scripts/_static.mjs` — decode の防御
- `scripts/verify-published.mjs` — カタログ/デモの判定
- `scripts/build-pages.mjs` — カタログ/デモの同梱

**設定・文書**

- `.github/workflows/pages.yml` — `verify:create` を公開前に
- `README.md` / `docs/handoff.md` / `docs/overview.md` / `ROADMAP.md`
- `docs/plan-v09b.md` / `docs/result-v09b.md`（この計画と結果をリポジトリに置く）

---

## 検証

各 Phase の終わりで `pnpm verify` と `pnpm verify:create` を通します。
**赤いまま次へ行きません。**

| Phase | 何をもって完了とするか |
|---|---|
| A | 新しい 2 判定が**わざと壊すと赤くなる**ことを確認済み。20 工程が緑 |
| B | CI で生成物の `npm install` → `build` が走っている。公開前に `verify:create` が通る |
| C | 判定の数と結果がリファクタ前後で一致。**実測で所要時間が短くなっている** |
| D | 公開先で `/catalog/` と `/demo/` が 200。資材（JS/CSS）が 404 にならない |
| E | `.env` が無視される / Node 22.12 未満で CLI が止まる / receiver が 503 / bare npx が 0 件 / 文書のトークンが実装と一致 |

### 引き継ぎ

作業のたびに `docs/handoff.md` を現状に合わせます。**入口が古いのが
いちばん害が大きい**ので、各 Phase の終わりに必ず直します。
この計画は `docs/plan-v09b.md` として、外部レビューは
`docs/review-external-v09a.md` としてリポジトリに置きます
（判断の根拠が残らないと、次のセッションが同じ議論をやり直します）。

### あなたにお願いすること（GitHub 設定）

1. **Dependabot alerts を有効化**（P2-12）。Renovate は版を上げる仕組みで、
   脆弱性を知らせる仕組みではありません。役割が違います
2. `verify` の required status check を **strict** にするか判断（P2-14）
3. Pages の公開後、`/catalog/` と `/demo/` が見えることの確認
