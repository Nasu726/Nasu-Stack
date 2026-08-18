# v0.9e — 外部レビューの P1 を潰し、改名して Public Beta として名乗る

## Context

外部レビュー 2 本（本体 + v0.9d 差分）と、設計思想への助言 1 本を受け取りました。
判定は **Stable = HOLD / Public beta = 条件付き GO** です。

残っている問題は、たどると 1 つの形に集まります。

```
説明には正しいことが書いてある
  ↓
しかし API と既定値は危険な使い方を許す
  ↓
初心者は説明より既定値を使う
```

そして **P1 の 2 件は、私が v0.9d で入れたもの**です。コードで確認しました。

| | 実際のコード |
|---|---|
| P1-01 | `localStorage.getItem("__WT_STORAGE_KEY__")` — **引用符の中**に `replaceAll` |
| P1-02 | `await opts.guard(input)` の**後**に `new AbortController()` |

さらに **`SECURITY.md` に事実でないことが書いてあります。**
「shadcn のレジストリのディレクトリには載っています」——載っていません。
**公開中の偽の信頼表示**なので、これだけ先に出します。

あわせて**改名**します。`WebTemplate` は一般名詞すぎて、
巨大なフレームワークだと誤解されるか、将来の大きなプロジェクトの名前を塞ぎます。
**Beta で利用者が増えるほど改名の代償が上がる**ので、名乗る前のいまが最後の機会です。

---

## Phase 0 — 事実と違う記述（先に単独で出す）

`SECURITY.md` と `docs/shadcn-directory.md` の shadcn の記述を現在の状態へ。

```diff
- **shadcn のレジストリのディレクトリには載っていますが、npm には publish していません。**
+ **npm には publish していません。**
+ shadcn のディレクトリには、**掲載を申請する準備をしています**（まだ載っていません）。
```

**「公式のディレクトリにある」は信頼の合図です。確認前に現在形で書かない。**

---

## Phase A — 私が入れた欠陥と、部品の中核

### A-1. テーマ初期化スクリプトの差し込み（P1-01）

`registry/nasu/components/ui/theme-provider.tsx`。置き換え先が**引用符の中**にあります。

```js
var s=localStorage.getItem("__WT_STORAGE_KEY__");   // ← ここ
```

`storageKey` に `x");globalThis.x=1;//` を渡すと**データが実行コードになります。**
既定の雛型は固定値なので今すぐの危険はありませんが、公開している API として不正です。

直し方: **置き換え先を引用符の外へ出し、値のほうを JS リテラルへ直列化**します。

```js
var s=localStorage.getItem(__WT_STORAGE_KEY_JS__);
```

`JSON.stringify` だけでは足りません（`</script>` で閉じられる）。`<` と U+2028/2029 も逃がします。
**同じ関数を `registry/nasu/lib/seo.ts` の JSON-LD と共有**します（定義を 2 か所にしない）。

### A-2. guard 中の中断が効かない（P1-02 / P2-02 / P3-01）

`registry/nasu/hooks/use-action.ts`。`AbortController` を guard の**後**に作っています。

```
run() → guard を await → abort() → guard が true で解決 → controller を作る → action 開始
```

**中断したはずの削除・決済・送信が、画面を離れた後に始まります。**
`abort()` が `inFlightRef` を false に戻すので、2 回目の run も始められます。

- controller と**世代番号**を guard の前に作る
- `guard` に `ctx`（`signal`）を渡す — `action` と契約を揃える
- guard の後に「中断された / 世代が古い / unmount 済み」を確認して抜ける
- **guard が throw したら `ActionError` の経路へ**（いまは `run()` が reject し、
  `ActionButton` は `void state.run(...)` なので unhandled rejection）
- **guard 中も pending に**（いまは見た目 idle のまま押せず、壊れて見えます）

### A-3. `callSafely` が非同期の失敗を拾わない（P2-01）

`registry/nasu/lib/action.ts`。`onSuccess: async () => { … throw }` は `try/catch` を素通り。
`callSafely` を `async` にし、コールバックの型を `void | Promise<void>` へ。
**await するのは retry の外**です。

### A-4. 検査（判定を足すだけで終わらせない）

`scripts/verify-action-unit.mjs` を伸ばします。

```
storageKey に " \ 改行 </script> U+2028/U+2029 → 余計な global が 0
guard 待機中に abort   → action 0 回
guard 待機中に unmount → action 0 回
古い run を abort → 新しい run のみ 1 回
guard が throw   → state.error に入り、unhandledrejection 0
async な onSuccess / onError / onSettled が reject → unhandledrejection 0
```

unmount と unhandledrejection は実ブラウザが要るので、`scripts/verify-parts.mjs` 側で。
カタログには既に「呼ばれた回数」を出す `CallCounted` があります。

---

## Phase B — 初心者が秘密を漏らさないための手すり

- **B-1** `EndpointSpec.headers` / `SubmitOptions.headers` / `uploadWithProgress` の `headers`。
  3 か所とも「ここに service key を入れても秘密になりません」を JSDoc に。
  **API の説明を読む場所に書きます**（別の文書では読まれません）
- **B-2** `useAction` の `retry?: number` に**いま何の注意も書いていません。**
  決済・注文作成に付けると二重に走ります。「同じ操作を 2 回やっても
  結果が変わらないものにだけ」を型の説明に
- **B-3** `docs/boundaries.md` — 両方のレビューが共通して求めているもの。**表 1 枚**

| 引き受ける | あなた（サーバ）が必ず書く |
|---|---|
| 画面の状態・二重送信・中断・時間切れ | 認証・認可 |
| 読み上げ・キーボード・端末幅 | サーバ側の検証 |
| ブラウザ側の入力チェック（**助言であって守りではない**） | CSRF・レート制限 |
| 秘密を置く場所の案内 | アップロードの検証（大きさ・種類・中身の署名） |

`FileDrop` の `accept` / `maxSize`、`HoneypotField`、`PUBLIC_*` を
**「何を守らないか」と一緒に**並べ、README と HowToUse から辿れるように。

---

## Phase C — 問い合わせの受け口（v0.* の範囲）

**特定サービスとの連携を作り込むのは v1.x**（作者の判断）。この版は**穴だけ塞ぎます。**
どれも外部アカウント無しで単体検査できるものです。

| | いま | 直す |
|---|---|---|
| P1-03 | 応答に CORS を付けているだけ。`text/plain` の単純 POST は**素通りして副作用が起きる** | body を読む前に**サーバ側で Origin を確認**。`application/json` 以外は 415 |
| P2-04 | `ALLOWED_ORIGIN ?? "*"` に**逃げている** | 未設定は 503（メールの設定と同じ扱い） |
| P1-04 | `from: "form@example.com"` 固定。**書いてある通りに進めても Resend が 403** | `MAIL_FROM` を必須に。README も verify 済みドメインの手順へ |
| P1-06 | 全部 parse してから 5000 文字を確認 | 宣言サイズで早期 413 + 読みながら 64KB で打ち切り |
| P2-06 | 外部サービスのエラー本文を丸ごとログ | status と要求 ID だけに |
| P2-07 | README が `npm create cloudflare@latest` | 検証した版を書く（本体の方針と揃える） |

**v1.x へ回すもの**（README に明記）: Turnstile、レート制限、`Idempotency-Key`。
「本番へ出す前に足すもの」として **Cloudflare の画面での設定手順**は書き残します。

`scripts/verify-receiver-unit.mjs`（新設、`fetch` を偽物に差し替え）:

```
MAIL_API_KEY / MAIL_TO / MAIL_FROM / ALLOWED_ORIGIN 未設定 → いずれも 503
違う Origin + JSON        → メール送信 0
違う Origin + text/plain  → メール送信 0
Content-Type が JSON でない → 415
宣言サイズ超過 → parse 前に 413
Resend に渡る from == MAIL_FROM
外部サービスの本文がログに出ない
```

---

## Phase D — 供給網と、v0.9d 差分の指摘

- **D-1 lockfile 同梱（P2-08、作者の判断）**
  `packages/create-webtemplate/scaffold/<種類>/package-lock.json` を commit。
  **古いものを配るのが新しいリスク**なので、`verify-create.mjs` が
  同梱分と `npm install` の結果の一致を見ます。更新は Renovate の `lockFileMaintenance`
- **D-2 Actions を Node 24 対応版へ（P2-10）**
  `actions/checkout@v5` と `actions/setup-node@v5` が Node 24 です。
  **SHA での固定はやめません。変えるのは固定する先だけ。**
  `pnpm/action-setup` / `upload-artifact` / `configure-pages` / `deploy-pages` /
  `upload-pages-artifact` も同時に見ます
- **D-3 確かめたものと実行するものを同じに（P2-09）**
  いまは「URL のハッシュを確かめる → `npx <URL>` でもう一度取って実行」。
  「1 回落とす → 落としたものを確かめる → **その同じファイルを実行**」へ。
  手順そのものを `verify-create.mjs` で 1 回通します
- **D-4 Δ-P2-01** `SiteFooter` の `shrink-0` は、グループが増えるとはみ出し得ます。
  **先に fixture**（`width="narrow"` × 6 グループ × 長いラベル）をカタログに置き、
  768 / 1024 / 1280 ではみ出し 0 と各列が潰れていないことを見てから調整
- **D-5 Δ-P3-01** `collapseBelow` の 3 ボタンに `aria-pressed`。
  **アクセシビリティを売りにしているので、デモ自身が手本であるべき**
- **D-6** Astro の `z is deprecated` を消す。`ActionError` の古いコメントを揃える

---

## Phase E — 改名 → **Nasu Stack**

名前が決まりました。**リポジトリ名の変更は作者が済ませています。**

| | |
|---|---|
| 表示名 | **Nasu Stack** |
| リポジトリ | `Nasu726/Nasu-Stack` |
| 公開先 | `https://nasu726.github.io/Nasu-Stack/` |
| 入口の CLI | `create-nasu-stack` |
| 関連する名前 | `webtemplate-*` → `nasu-stack-*` |

`Stack` は、**この先バックエンドまで広げる**という作者の意図に合っています。
`docs/direction.md` にその根拠を書き残します（名前が実態より広いのではなく、
実態が名前に追いつく順番だ、という記録）。

### 最初にやること

1. `git remote set-url origin https://github.com/Nasu726/Nasu-Stack.git`
   （旧 URL からも転送されますが、繋ぎ直しておきます）
2. **npm に `create-nasu-stack` が空いているか確認**
   → 空いているなら `scripts/check-forbidden.mjs` の禁止ルールを
     `npx create-webtemplate` から `npx create-nasu-stack` へ差し替えます。
     **名前が変わっても穴は残ります**（打った人に他人のコードが動く）

### 置き換える場所の全部

**① 唯一の定義（ここだけで URL が全部連動します）**

| 場所 | いま | 後 |
|---|---|---|
| `scripts/_site.mjs:20` | `PUBLIC_BASE = ".../WebTemplate"` | `.../Nasu-Stack` |
| `scripts/_site.mjs:26` | `create-webtemplate.tgz` | `create-nasu-stack.tgz` |

`REGISTRY_URL` は `PUBLIC_BASE` から作られるので触りません。

**② ファイル名・ディレクトリ名**

| いま | 後 |
|---|---|
| `packages/create-webtemplate/` | `packages/create-nasu-stack/`（`package.json` の `name` も） |
| `public/create-webtemplate.tgz` (+`.sha256`) | `create-nasu-stack.tgz`（`scripts/build-pages.mjs:83,97`） |
| 生成物の `.vscode/webtemplate.code-snippets` | `nasu-stack.code-snippets`（`scripts/build-snippets.mjs:201`） |

**③ 生成物に焼き込まれる識別子（利用者のプロジェクトに残る）**

| 場所 | いま | 後 |
|---|---|---|
| `theme-provider.tsx:41` | `"webtemplate.theme"` | `"nasu-stack.theme"` |
| `lib/action.ts:87` | `Symbol("webtemplate.aborted")` | `Symbol("nasu-stack.aborted")` |
| `apps/site/src/site.config.ts` | `"webtemplate.site.theme"` | `"nasu-stack.site.theme"` |
| 生成物の `package.json` の印 | `webtemplate: { shadcn }` | `nasuStack: { shadcn }`（読むのは `index.mjs:254`） |

`scaffold/astro/src/site.config.ts` の `"__PROJECT_NAME__.theme"` は
**既に利用者のプロジェクト名**なので触りません。

**④ 文書（`WebTemplate` の出現）**

| 場所 | 件数 |
|---|---|
| `docs/*` | 41 |
| `scripts/*` | 14 |
| `packages/create-webtemplate/*` | 13 |
| `apps/*/src` | 6 |
| `README.md` / `SECURITY.md` | 各 5 |
| `registry/nasu/*`（doc コメント） | 4 |
| `ROADMAP.md` | 2 |

**過去の `docs/plan-*.md` と `docs/result-*.md` は書き換えません。**
当時の記録なので、当時の名前のままが正しい。README に
「v0.9e より前の記録には旧名で出てきます」と 1 行足します。

**⑤ 変えないもの（決定として書き残す）**

| | なぜ |
|---|---|
| `@nasu` の名前空間 | **既に個人の名前**。改名の目的に合っています |
| `registry/nasu/` | 上と同じ |
| `wt-` / `--wt-`（40 以上のクラス名・変数名） | プロジェクト名を名乗っていないので誤解を生みません。変えると配布物の全部品と CSS、検査のセレクタに及びます |

### 作者の作業と、その代償

1. GitHub でリポジトリ名を変更
2. **Pages の URL は転送されません。** リポジトリの URL は転送されますが、
   `nasu726.github.io/WebTemplate/` は **404 になります**
   （[GitHub のドキュメント](https://docs.github.com/en/enterprise-cloud@latest/repositories/creating-and-managing-repositories/renaming-a-repository)）
3. こちらが `_site.mjs` を直して再公開

**旧 URL を生かす方法はありません**（レジストリは JSON なので meta refresh が効きません）。
利用者がまだ居ないいまが、いちばん安いタイミングです。

---

## Phase F — Public Beta として名乗る

README の冒頭。**「まだ引き受けていないこと」を先に**書きます。

```
これは Public Beta です。

部品と雛型は実ブラウザで検査していますが、次はまだこちらで引き受けていません。

  ・問い合わせの受け口のレート制限と bot 対策（v1.x）
  ・認証・認可
  ・サーバ側の検証（雛型にあるのは見本だけ）

詳しくは docs/boundaries.md に表で並べてあります。
```

`SECURITY.md` の「約束していないこと」からも辿れるように。

---

## この版でやらないこと（`docs/direction.md` に記録）

- **目的別の Feature Kits**（`@nasu/contact` に UI + 検証 + 送信 + spam 対策まで） — v1.x
- Turnstile / レート制限 / `Idempotency-Key` — Phase C のとおり v1.x

---

## 触るファイル

**配布物**
`registry/nasu/components/ui/theme-provider.tsx` / `hooks/use-action.ts` /
`lib/action.ts` / `lib/submit.ts` / `lib/upload.ts` / `lib/seo.ts` /
`components/ui/site-footer.tsx`

**受け口**
`examples/receivers/cloudflare-worker.ts` / `README.md`

**配布**
`packages/create-webtemplate/scaffold/*/package-lock.json`（新規・commit）/
`scripts/build-create-template.mjs` / `verify-create.mjs` / `_site.mjs` /
`.github/workflows/verify.yml` / `pages.yml`

**検査**
`scripts/verify-action-unit.mjs`（伸ばす）/ `verify-receiver-unit.mjs`（新規）/
`verify-parts.mjs`（unmount と unhandledrejection）

**文書**
`SECURITY.md` / `README.md` / `docs/boundaries.md`（新規）/ `docs/rename.md`（新規・Phase E の一覧）/
`docs/shadcn-directory.md` / `docs/direction.md` / `docs/plan-v09e.md` / `docs/result-v09e.md`

---

## 検証

| Phase | 何をもって完了とするか |
|---|---|
| 0 | `SECURITY.md` に事実でない現在形が無い |
| A | 上の 7 判定が緑。**先にわざと壊して全部赤くなることを確認** |
| B | `boundaries.md` が README と HowToUse から辿れる。3 つの `headers` に注意書き |
| C | 受け口の単体検査が緑。**違う Origin と `text/plain` でメール送信 0** |
| D | 3 種類とも同梱 lockfile で `npm install` が通る。Node 20 警告 0。footer が 6 グループでもはみ出さない |
| E | `grep -ri webtemplate` が、過去の記録以外で 0 件。公開先で `verify-published` が緑 |
| F | README の冒頭に Beta と「引き受けていないこと」がある |

各 Phase の終わりで `pnpm verify` と `pnpm verify:create`。
`docs/handoff.md` を現状へ更新します。

---

## お願いすること

1. **Phase 0 のマージ** — 事実でない記述が公開中なので、これだけ先に
2. **新しい名前を決める**（Phase A〜D を進めている間に）。
   決まったら Phase E を機械的に流します
3. **リポジトリ名の変更**（Phase E の直前に）。**旧 Pages URL は 404 になります**
4. Phase F のあと、**実際に何人かに使ってもらう**。
   今回もコードだけでは見つからないものが 11 件出ています
