# WebTemplate Release Readiness Review

- Repository: `Nasu726/WebTemplate`
- Reviewed commit: `a1e1c36a4a13710a7db06465eb224e92e9801cbc`
- Review date: 2026-08-17
- Reviewer target: public release, from first-time web developers to experienced developers
- Decision: **HOLD / リリース停止推奨**
- Main reason: **default Astro scaffold is currently not reliably installable, and several core async / form safety contracts can cause real side effects despite green CI.**

> このレビューは「コードがきれいか」ではなく、**公開したときに利用者へどの程度の実害が出るか**を優先して評価しています。
>
> また、依頼された「低性能なサブエージェント」そのものを別モデルとして起動する機能は使用できなかったため、代わりに **Web開発知識を仮定しない利用者としてREADME/生成後HowToUseを文字通り順番に辿る擬似ユーザーテスト**を行いました。開発者側の補完知識を使わず、「書かれていないことは知らない」前提で評価しています。

---

## 0. Executive summary

WebTemplate は、一般的な個人製テンプレートより明らかに検証への意識が高いです。

特に以下は強いです。

- GitHub Actions を commit SHA で固定している
- Workflow 権限を原則 `contents: read` まで落としている
- `minimumReleaseAge` を設定し、公開直後の依存を即座に取り込まない
- 上書き事故を避ける create CLI のチェックがある
- 実ブラウザを使った responsive / accessibility / form / SEO 検査が厚い
- shadcn registry を「設定ファイルの形」だけでなく本物の CLI で追加する検査まで用意している
- 公開後の GitHub Pages を外部から再検査している
- MIT License が明示されている
- `eval(` / `innerHTML` の直接使用は今回のコード検索では見つからなかった
- 現在の main HEAD では GitHub Actions の `verify`, `build`, `deploy`, `smoke` が成功している
- 公開後 smoke は registry 38項目、tarball、SHA-256、404 など 9項目を通過している

しかし、**緑のCIが実利用経路を完全には表していません**。

最大の構造的問題は次の通りです。

1. 生成物の本当の `install -> build -> browser` 検査は `pnpm verify:create` (`--full`) にある
2. ところが release gate の `.github/workflows/verify.yml` は `pnpm verify` しか実行しない
3. `verify-create --full` 自体も利用者向けドキュメントの `npm install` ではなく `pnpm install` を使う
4. そのため、**実際の初心者が最初に踏む npm 経路がCIの盲点になる**
5. 現在その盲点に、default Astro scaffold の依存バージョン問題が実際に存在する

これは単なる「テストをもう少し増やそう」ではなく、**リリース判定に使うテストの境界がずれている**という問題です。

### 推奨リリース判定

**現状のまま v1 / stable 相当として公開するのは推奨しません。**

最低でも以下を直してから beta/public release に進むべきです。

- P0-01: Astro scaffold の依存バージョンを修正し、`npm install` を CI で実行
- P1-01/P1-02: `useAction` の callback retry と async guard race を修正
- P1-03: receiver の「配送していないのに 200 success」を廃止
- P1-04: `.env` を generated `.gitignore` で保護
- P1-05: Node.js 対応バージョン表示・preflight・`engines` を一致させる
- P1-06: `verify:create --full` 相当を Pages release gate に入れる
- P1-07: bare `npx create-webtemplate` をコード・エラー案内から完全排除

これらが終われば、基礎品質はかなり強いため、**「注意深く作られた beta」から「公開して勧められるテンプレート」へ一段上がる**と評価します。

---

# 1. Severity model

| Severity | 意味 |
|---|---|
| **P0 / Blocker** | 公開を止めるべき。主要導線が動かない、または多数ユーザーへ重大事故が出る |
| **P1 / High** | リリース前修正推奨。データ損失、重複副作用、秘密漏洩、任意コード実行誘導など実害が大きい |
| **P2 / Medium** | betaなら既知問題として許容可能だが、初心者の離脱・誤設定・保守事故につながる |
| **P3 / Low** | UX、保守性、説明の整合性。低コストならリリース前に直したい |

Confidence:

- **Confirmed**: コードから決定的に確認
- **Current-state confirmed**: GitHub/npm等の現在状態と組み合わせて確認
- **Likely**: 実環境依存だが発生条件が明確

---

# 2. Release blockers / High-impact findings

## P0-01 — Default Astro scaffold が現在の npm と整合していない

**Severity:** P0 / Blocker  
**Confidence:** Current-state confirmed  
**Affected:** 初回利用者のデフォルト導線

### Evidence

`packages/create-webtemplate/scaffold/astro/package.json`

```json
"dependencies": {
  "@astrojs/react": "^6.0.2",
  "astro": "^7.2.2"
}
```

2026-08-17 のレビュー時点で npm registry の `astro/latest` は **7.2.0** を返していました。

また、npm 検索では `@astrojs/markdown-remark@7.2.2` は確認できましたが、`astro@7.2.2` は確認できませんでした。

これは、Astro monorepo 内の別 package の `7.2.2` と `astro` 本体のバージョンを混同した可能性があります。

### Impact

CLI の default template は Astro です。

したがって初心者が最も自然に、

```bash
npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
cd my-site
npm install
```

と進んだ直後、dependency resolution で停止する可能性が非常に高いです。

**「WebTemplateが壊れている」と判断される最悪の離脱点です。**

さらに現在の release CI が generated project の `npm install` を必須化していないため、main が緑でも公開できます。

### Fix

1. `astro` を実在する検証済みバージョンへ修正
2. scaffold の依存バージョン存在確認を machine check 化
3. Pages 公開前に **生成物へ `npm install` を実際に実行**
4. Astro と Vite の両方を default user path で build
5. 可能なら dependency version を一元管理し、手入力で scaffold に転記しない

最低限:

```yaml
# release gate
- run: node packages/create-webtemplate/index.mjs smoke-astro --yes --template astro
- run: npm install
  working-directory: smoke-astro
- run: npm run build
  working-directory: smoke-astro
```

Vite も同様に実行してください。

### Regression test

- package.json に書かれた direct dependency の requested range が registry 上で resolve 可能か
- generated Astro: `npm install && npm run build`
- generated Vite: `npm install && npm run build`

---

## P1-01 — `useAction`: `onSuccess` / `onSettled` の例外で成功済み action が再実行される

**Severity:** P1 / High  
**Confidence:** Confirmed  
**Affected:** 保存、登録、決済、メール送信、削除など non-idempotent action

### Evidence

`registry/nasu/hooks/use-action.ts`

action 本体の実行と lifecycle callback が同じ `try/catch` の中にあります。

概念的に現在の流れは:

```ts
try {
  const result = await action(...)
  setSuccess(...)
  onSuccess?.(...)
  onSettled?.(...)
} catch (error) {
  // retry
}
```

この構造では、

1. action 本体は成功
2. DB保存/メール/決済などの副作用は完了
3. `onSuccess` がバグで throw
4. catch が「action失敗」と解釈
5. `retry > 0` なら action 本体を再実行

となります。

### Real impact

- 二重決済
- 二重メール送信
- 二重レコード登録
- 二重通知
- 二重削除要求
- サーバ側が idempotent でなければデータ破損

retry が 0 でも、**サーバ上は成功しているのにUIはエラー**という不整合になります。

### Fix

**action retry boundary と callback boundary を分離してください。**

```ts
let result

// ここだけ retry 対象
result = await runActionWithRetry(...)

// action が最終的に成功した後
setSuccess(result)

// callback の例外は action の retry 条件にしない
try {
  await onSuccess?.(result)
} catch (callbackError) {
  reportCallbackError(callbackError)
}

try {
  await onSettled?.(...)
} catch (callbackError) {
  reportCallbackError(callbackError)
}
```

`onSettled` をどう扱うかは API contract として明文化した方が良いです。

### Required regression tests

```text
action succeeds
onSuccess throws
retry = 1
=> action call count === 1
```

```text
action succeeds
onSettled throws
retry = 3
=> action call count === 1
```

---

## P1-02 — `useAction`: async guard 中は lock が取られず、連打で二重実行できる

**Severity:** P1 / High  
**Confidence:** Confirmed

### Evidence

`useAction` は最初に `inFlightRef.current` を見ますが、`guard` を await した**後**に in-flight lock を取得します。

概念的に:

```ts
if (inFlightRef.current) return

await guard(input)

// この後で初めて
inFlightRef.current = true
```

guard が async なら、

```text
click A -> guard await
click B -> guard await
click C -> guard await
```

と複数 invocation が lock 前へ進めます。

現在の「5回連打しても action は1回」のテストは通常 action path を検査しており、**遅い async guard を含む race は検査していません。**

### Real impact

「連打防止」をコンポーネント契約として信用した利用者が、non-idempotent API で重複副作用を起こせます。

AbortController で後の request を止めても、最初の request がすでにサーバへ届いた後なら副作用は取り消せません。

### Fix options

#### Option A: guardを含めて operation lock

```ts
if (busyRef.current) return
busyRef.current = true

try {
  if (!(await guard(input))) return
  await action(input)
} finally {
  busyRef.current = false
}
```

#### Option B: separate state

`guarding | running | success | error`

を明示し、guarding 中も UI を disabled にする。

初心者向けAPIなら B の方が状態が説明しやすいです。

### Regression test

- guard が Promise を返し 100ms 待つ
- 同フレーム〜数ms間に5回 invoke
- guard/action とも必要回数だけ実行
- action count `=== 1`

---

## P1-03 — Cloudflare receiver が配送設定不足でも `200 {ok:true}` を返す

**Severity:** P1 / High  
**Confidence:** Confirmed  
**Affected:** 問い合わせフォームを production にコピーした利用者

### Evidence

`examples/receivers/cloudflare-worker.ts`

```ts
if (!env.MAIL_API_KEY || !env.MAIL_TO) {
  console.log("[contact] 未設定のため転送しません", input);
  return json({ ok: true, forwarded: false }, 200, env);
}
```

### Impact

訪問者:

> 「送信しました」

サイト運営者:

> 何も受け取っていない

という**silent data loss**になります。

問い合わせ、採用応募、サポート、商談などではかなり重大です。

さらに `console.log(..., input)` に氏名・メール・本文が含まれ得るため、Cloudflare logs に PII を残します。

### Fix

production default は fail closed:

```ts
if (!env.MAIL_API_KEY || !env.MAIL_TO) {
  console.error("[contact] mail forwarding is not configured");
  return json(
    { ok: false, message: "現在送信できません。時間をおいて再度お試しください。" },
    503,
    env
  );
}
```

demo mode が必要なら:

```text
DEV_ACCEPT_WITHOUT_FORWARDING=true
```

のような **explicit opt-in** にしてください。

また payload 自体はログ出力しない方が安全です。

### Regression tests

- API key missing => 503, `ok:false`
- destination missing => 503
- successful provider call => 2xx
- provider error => non-2xx
- logs に raw email/message が含まれない

---

## P1-04 — Generated `.gitignore` が `.env` を無視しない

**Severity:** P1 / High  
**Confidence:** Confirmed  
**Affected:** 特に初心者

### Evidence

`packages/create-webtemplate/index.mjs` が生成する `.gitignore`:

```text
node_modules/
dist/
.astro/
.DS_Store
*.local
```

`.env` / `.env.*` がありません。

一方、このプロジェクトはフォーム endpoint や worker secret など環境変数を扱う導線を提供しています。

### Impact

初心者が:

```bash
git add .
git commit
git push
```

すると、将来 `.env` に置いた API key / backend secret / token を public repository に漏らせます。

一度 Git history に入った secret は、ファイルを消すだけでは無効化できません。rotation が必要です。

### Fix

generated `.gitignore`:

```gitignore
.env
.env.*
!.env.example
```

加えて:

- `.env.example` を生成
- `PUBLIC_*` / `VITE_*` は browser bundle に入るため**secretを置かない**と明記
- server-only secret と public config を説明

任意で:

```gitignore
*.pem
*.key
```

も検討できます。

---

## P1-05 — Node.js 18 をサポートすると案内しているが、生成物はサポートしない

**Severity:** P1 / High  
**Confidence:** Current-state confirmed

### Evidence

generated `HowToUse.md` の troubleshooting:

```text
Node.js が 18 以上か（node -v）
```

しかし現在の scaffold:

- Astro 7 系: Node `>=22.12.0`
- Vite 8: Node `20.19+` または `22.12+`

Astro の current package metadata も Node `>=22.12.0` を要求しています。

### Impact

「Node 18以上ならOK」と読んだ初心者が Node 18 で開始し、engine error / install failure を踏みます。

エラーメッセージには npm/node/engine/EBADENGINE 等が出るため、Web未経験者には原因の切り分けが難しいです。

### Fix

WebTemplate 全体として **Node 22.12+ を最低ラインに統一**するのが最も単純です。

1. create CLI 起動直後に version preflight
2. generated package.json に:

```json
"engines": {
  "node": ">=22.12.0"
}
```

3. README/HowToUseも `22.12+`
4. `.nvmrc` または `.node-version` を生成
5. CIも supported minimum version で実行

CLI だけ Node 18 で動かせても、作ったものが動かなければ beginner UX として意味がありません。

---

## P1-06 — Release gate が最も強い create verification を実行していない

**Severity:** P1 / High  
**Confidence:** Confirmed

### Evidence

root `package.json`:

```json
"verify": "node scripts/verify.mjs",
"verify:create": "node scripts/verify-create.mjs --full"
```

`.github/workflows/verify.yml`:

```yaml
- name: verify
  run: pnpm verify
```

`verify-create.mjs` 自身も:

```text
install / build / 実ブラウザ の検査は --full を付けたときだけ走ります
```

と明記しています。

現在の CI log でも lightweight create checks の後に full install/build/browser が skipped であることを確認しました。

### Impact

まさに P0-01 のような、

- scaffold dependency が registry に存在しない
- npm install が壊れる
- generated project の build が壊れる
- shadcn add が実環境で壊れる

問題が **green CI のまま Pages へ公開可能**です。

### Fix

Pages の `build` へ進む前に、最低限:

```yaml
- run: pnpm verify
- run: pnpm verify:create
```

ただし次の P1-06b も同時に直す必要があります。

### P1-06b — full verifier も `pnpm` を使い、documented `npm` path を検査しない

`verify-create --full` 内の install/build は `pnpm` helper を利用します。

生成後 README と CLI output は:

```bash
npm install
npm run dev
```

です。

つまり強いテストを release gate に追加しても、そのままでは**ユーザーが使う package manager と違います。**

### Recommended test matrix

| Template | Package manager | OS | Required |
|---|---|---|---|
| Astro | npm | Ubuntu | yes |
| Vite | npm | Ubuntu | yes |
| Astro | npm | Windows | strongly recommended |
| Vite | npm | Windows | strongly recommended |
| Astro/Vite | pnpm | Ubuntu | optional compatibility |

まず documented path を最優先してください。

---

## P1-07 — CLI 自身が「使うな」とREADMEで警告している bare npm command を案内する

**Severity:** P1 / High  
**Confidence:** Confirmed  
**Type:** supply-chain footgun

### Evidence

README / security 方針では、npm package name を第三者に取得される可能性があるため bare:

```bash
npx create-webtemplate ...
```

を避け、GitHub Pages 上の tarball を指定する方針です。

しかし `packages/create-webtemplate/index.mjs` には:

```js
npx create-webtemplate my-site
```

が header comment と error example に残っています。

project name を省略した場合にも:

```text
例: npx create-webtemplate my-site
```

と表示します。

### Impact

現在 package が未公開でも、将来第三者が npm 上の `create-webtemplate` を取得した場合、ユーザーをその package の実行へ誘導します。

`npx` は package code を実行するため、最悪ケースは **arbitrary code execution on developer machine** です。

README が安全でも、**エラー時にCLIが危険なコマンドを教える**のは特にまずいです。

### Fix

bare command を repository 全体から禁止。

```text
npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
```

のみを表示するか、単に:

```text
プロジェクト名がありません。最初に使ったコマンドへ名前を追加してください。
```

として installer URL を重複保持しない設計も良いです。

### Regression test

repo-wide test:

```text
forbid exact string: "npx create-webtemplate"
```

ドキュメント内の「このコマンドは使わない」という説明だけ whitelist してください。

---

## P1-08 — Public contact receiver に abuse control がなく、CORS説明が防御として強く見えすぎる

**Severity:** P1 / High for production receiver usage  
**Confidence:** Confirmed

### Current protections

- client honeypot
- CORS header
- client-side timeout

### Missing production controls

- server-side rate limit
- request body size limit
- CAPTCHA / Turnstile 等
- server-side bot signal
- provider quota protection
- robust server-side schema validation
- origin を authentication と誤認しない説明

### Important distinction

CORS は**ブラウザの cross-origin JavaScript を制御する仕組み**であり、API authentication ではありません。

bot / curl / server-to-server client は CORS を無視して endpoint へ直接 POST できます。

client honeypot も attacker が直接APIを叩けば省略できます。

### Real impact

- spam
- Resend/provider quota consumption
- paid quota/cost
- worker resource abuse
- mail reputation degradation
- inbox flooding

### Fix

最低限:

1. request body upper bound
2. server-side validation
3. Cloudflare rate limiting / Turnstile 等
4. Origin allowlist は browser control として残す
5. docs に「CORSは認証ではない」
6. client honeypot は補助防御と明記

初心者向けテンプレートでは、**「安全そうに見えるが実はbotには効かない」状態が一番危険**です。

---

# 3. Medium findings

## P2-01 — Generated docs が `npx shadcn@latest` を推奨する一方、テストは意図的に latest を避けている

**Severity:** P2 / Medium-High  
**Confidence:** Confirmed

`HowToUse.md`:

```bash
npx shadcn@latest add @nasu/data-table
```

しかし `scripts/verify-create.mjs` には、`@latest` は lockfile と `minimumReleaseAge` を迂回するため使わず、repository に固定した shadcn を直接実行する、という非常に正しいコメントがあります。

**テスト側が避けている supply-chain / compatibility risk を利用者側へそのまま渡しています。**

### Fix

generated scaffold に exact version の shadcn を devDependency として持たせるなど:

```bash
npm exec shadcn -- add @nasu/data-table
```

あるいは exact version:

```bash
npx shadcn@4.17.0 add ...
```

version source は一元化してください。

---

## P2-02 — Stable installer URL が mutable

**Severity:** P2 / Medium-High  
**Confidence:** Confirmed

Pages は常に:

```text
/create-webtemplate.tgz
/create-webtemplate.tgz.sha256
```

を main から再生成します。

### Problem

同じコマンドが来週は別コードを実行します。

SHA sidecar が同じ mutable origin にあるだけでは、

- どの release か
- 過去と同じ bytes か
- 誰が署名したか

の固定にはなりません。

### Fix

versioned immutable artifact:

```text
/releases/v0.10.0/create-webtemplate-0.10.0.tgz
```

を protected tag からのみ生成。

`latest` alias は convenience として別に持つ。

より強くするなら GitHub Release + provenance/Sigstore も検討できます。

---

## P2-03 — `uploadWithProgress` の timeout handler はあるが timeout が設定されていない

**Severity:** P2 / Medium  
**Confidence:** Confirmed

`registry/nasu/lib/upload.ts` は:

```ts
xhr.addEventListener("timeout", ...)
```

を持ちますが、`xhr.timeout = ...` がありません。

XHR default timeout は実質無制限なので、network が半端に止まると Promise が長時間 pending のままになり得ます。

### Fix

```ts
type UploadOptions = {
  timeoutMs?: number
}

xhr.timeout = timeoutMs ?? 30_000
```

timeout test も追加。

---

## P2-04 — FileDrop の `accept` は drag & drop で enforcement されない

**Severity:** P2 / Medium  
**Confidence:** Confirmed

`<input accept={accept}>` は picker 側へのヒントですが、drop 後の `enqueue()` は主に file size を確認しており、MIME/extension を自前検証していません。

### Impact

ユーザーが `accept="image/*"` を security boundary と誤解しやすいです。

### Fix

- drop / picker の両方を同じ accept matcher に通す
- mismatch を UI error として表示
- docs に **server must revalidate size/type/signature** と明記

client-side file type check は security boundary ではありません。

---

## P2-05 — `EndpointSpec.body` の「固定値」を caller input が上書きできる

**Severity:** P2 / Medium  
**Confidence:** Confirmed

`registry/nasu/lib/action.ts` の merge が:

```ts
{ ...body, ...input }
```

なら、same key は input が勝ちます。

しかしコメント上は `body` を「必ず混ぜる固定値」のように説明しています。

### Fix

もし本当に固定値なら:

```ts
{ ...input, ...body }
```

ただし、より重要なのは:

> client が送る role / tenantId / userId / permission 等を security-sensitive な固定値として信用してはいけない

と明記することです。

認可に使う値は server-side identity から決めてください。

もし overrideable が設計意図なら `body` ではなく `defaults` と命名した方が安全です。

---

## P2-06 — Backend の `Error.message` を user-facing message に流しやすい

**Severity:** P2 / Medium  
**Confidence:** Confirmed

`toActionError(Error)` や JSON error handling が server/error message を display message に使います。

React が escape するため直ちに XSS ではありませんが、

- DB error
- internal endpoint
- provider detail
- implementation detail

をユーザーへ出す information disclosure になり得ます。

### Fix

error contract を分ける:

```ts
{
  code: "CONTACT_FAILED",
  userMessage: "送信できませんでした",
  requestId: "..."
}
```

internal `message` / stack は server log のみ。

---

## P2-07 — CLI project-name validation が Windows / npm name rules を十分にカバーしない

**Severity:** P2 / Medium  
**Confidence:** Confirmed

現在の validation は一部記号・大文字・空白等を弾きますが、Windows reserved names や forbidden characters が残ります。

例:

```text
CON
AUX
NUL
COM1
LPT1
foo:bar
foo?bar
```

### Impact

「validationを通ったのに fs operation で意味不明なエラー」が初心者に出ます。

### Fix

- `validate-npm-package-name`
- cross-platform safe directory name rule

を組み合わせる。

Windows CI test cases も追加。

---

## P2-08 — HowToUse の spacing token 説明が実装と一致しない

**Severity:** P2 / Medium  
**Confidence:** Confirmed

HowToUse:

```text
3xs 2xs xs sm md lg xl 2xl 3xl
```

実際の `tokens.css`:

```text
none 2xs xs sm md lg xl 2xl 3xl
```

`3xs` はなく、`none` が抜けています。

### Impact

初心者は documentation を正とみなすため、最初の styling で「書いたのに効かない」を踏みます。

### Fix

docs に token 名を手書きしない。

- TS/shared JSON token source
- docs generator
- CSS parser test

などで single source of truth にしてください。

Regression:

```text
documented spacing tokens === declared spacing tokens
```

---

## P2-09 — Theme 数の説明も source-of-truth が分裂している

**Severity:** P2 / Medium  
**Confidence:** Confirmed

HowToUse は `themes.css` に4種類あるように読めますが、neutral の基礎値は `tokens.css` 側、追加 theme が `themes.css` 側です。

大事故ではありませんが、初心者が「neutral を themes.css で探して見つからない」導線になります。

P2-08 と同じく自動生成推奨です。

---

## P2-10 — GitHub Pages の案内が「置くだけ」に近すぎ、project site の base を説明していない

**Severity:** P2 / Medium-High  
**Confidence:** Confirmed against current Vite/Astro docs

HowToUse は GitHub Pages を一般的な deploy option として挙げます。

しかし generated config:

### Vite

`vite.config.ts` に repository project site 用 `base` がありません。

Vite の official docs では:

```text
https://<username>.github.io/<repo>/
```

なら:

```ts
base: "/<repo>/"
```

が必要です。

### Astro

Astro official GitHub Pages docs でも通常 project site では `site` に加え `base: "/<repo>"` が必要です。

### Impact

deploy 自体は成功しても:

- JS/CSS assets 404
- internal link が root を指す
- blank/broken page

となり得ます。

### Fix

初心者向けならどちらかに振り切る方が良いです。

#### A. dedicated deploy preset

```bash
create-webtemplate my-site --deploy github-pages
```

で workflow/base を生成。

#### B. generic docs から GitHub Pages を外し、専用ページへ誘導

Cloudflare Pages / Netlify / Vercel の root deploy と GitHub project Pages は同じ説明にまとめない方が安全です。

Official references:

- Vite: `vite.dev/guide/static-deploy`
- Astro: `docs.astro.build/.../guides/deploy/github/`

---

## P2-11 — Public receiver の `ALLOWED_ORIGIN` を「設定しろ」と書くが実コマンド導線が弱い

**Severity:** P2 / Medium  
**Confidence:** Confirmed

receiver README は `ALLOWED_ORIGIN` の重要性を説明していますが、secret setup の具体的な command flow では `MAIL_API_KEY`, `MAIL_TO` と比べて導線が弱く、初心者が default `*` のまま deploy する可能性があります。

### Fix

copy-paste 可能な1本の setup sequence にしてください。

例:

```bash
wrangler secret put MAIL_API_KEY
wrangler secret put MAIL_TO
wrangler secret put ALLOWED_ORIGIN
```

または `wrangler.toml/jsonc` の `[vars]` に public config として明示。

---

## P2-12 — Dependabot security alerts が repository で disabled

**Severity:** P2 / Medium  
**Confidence:** Current-state confirmed

GitHub API で Dependabot alerts を確認したところ:

```text
Dependabot alerts are disabled for this repository.
```

でした。

Renovate が weekly dependency update を担当しているのは良いですが、**version update と vulnerability alert は役割が違います。**

### Fix

GitHub Security settings で少なくとも:

- Dependency graph
- Dependabot alerts
- Dependabot security updates（運用方針に応じて）

を検討。

Renovate はそのままで構いません。

---

## P2-13 — GitHub Actions が現在 Node runtime deprecation warning を出している

**Severity:** P2 / Medium  
**Confidence:** Current-state confirmed

current workflow log では pinned:

- `actions/checkout` v4.4.0 commit
- `actions/setup-node` v4.4.0 commit

等について、action 側の Node 20 runtime deprecated / runner が Node 24 へ force している warning が出ています。

SHA pin 自体は非常に良いので、**pin をやめる必要はありません。**

### Fix

current major の trusted action commit SHA へ更新。

Vite の現行 GitHub Pages example でもより新しい action major が使われています。

更新後も:

```yaml
uses: actions/checkout@<full SHA> # v7.x.x
```

のように SHA pin 継続を推奨します。

---

## P2-14 — Required status check が strict ではない

**Severity:** P2 / Medium-Low  
**Confidence:** Current-state confirmed

main ruleset では `verify` が required ですが、`strict_required_status_checks_policy` は false でした。

### Impact

PR が古い main に対して green のまま merge され、他の merge と組み合わさった結果 main が壊れる余地があります。

Pages 側でも再度 verify するため即座に危険な配布物を出しにくい設計なのは良いですが、main stability としては strict の方が強いです。

### Fix

solo development の merge velocity と相談しつつ:

- strict required status checks
- update branch before merge
- merge queue

のどれかを検討。

---

## P2-15 — Generated project に lockfile がなく、初回installの再現性が弱い

**Severity:** P2 / Medium  
**Confidence:** Confirmed

scaffold package.json は `^` range を多数持ち、generated project に lockfile はありません。

つまり同じ WebTemplate release から生成しても、生成した日によって実際に入る dependency が変わります。

### Impact

初心者:

> 昨日は記事通り動いたのに今日は動かない

maintainer:

> そのユーザーの dependency graph を再現できない

### Fix options

1. generator release 時点の lockfile を template に含める
2. direct dependency を exact pin し、ユーザーが生成後に lockfile を作る
3. package manager/version を固定
4. CI で「fresh install」を定期実行する

初心者テンプレートとしては lockfile 同梱が最も分かりやすいです。

---

# 4. Lower-severity / quality findings

## P3-01 — Unknown CLI flags を黙って無視する

**Severity:** P3 / Low-Medium

`parseArgs()` は知らない `--foo` を error にしません。

例:

```bash
--templat vite
```

の typo で意図せず default Astro を生成する可能性があります。

### Fix

- unknown option => error
- `--template` value missing => error
- extra positional arg => error
- `--help`
- `--version`

初心者CLIは permissive より fail-fast の方が親切です。

---

## P3-02 — GitHubが認識する root `SECURITY.md` がない

**Severity:** P3 / Low

`docs/security.md` は supply-chain 設計資料として良いですが、外部利用者が脆弱性を見つけた時の disclosure policy とは別物です。

### Fix

root または `.github/SECURITY.md`:

- supported versions
- report method
- public issue に secret / exploit detail を貼らない
- response expectation（厳密SLAでなくてよい）

を短く用意。

---

## P3-03 — CI に deprecation hints / unused import が残っている

current verify log では Astro の deprecated `z` import や unused `Divider` など hints が出ています。

現在 fail ではありませんが、初心者向け project は **「warning/hint が常に出る状態」を放置しない**方が良いです。

理由は、新しい本物の warning がノイズに埋もれるからです。

---

## P3-04 — Tag ruleset と security doc の対象範囲に差がある

security 文書では `refs/tags/v*` を守る意図が書かれている一方、現在の tag ruleset は事実上すべての tag を保護する設定に見えました。

これは security bug ではありません。

ただし release procedure と GitHub settings を同じ source of truth にしないと、将来「文書ではできるはずの操作がGitHub上で拒否される」運用事故になります。

---

# 5. `useResource` にも同系統の callback boundary 問題がある

**Severity:** P2 / Medium-High  
**Confidence:** Confirmed

`registry/nasu/hooks/use-resource.ts` でも loader と `onSuccess` が同じ retry boundary に入る構造があります。

loader が成功した後 `onSuccess` が throw すると:

- loader 再実行
- network read が重複
- 最終的に error state へ移る

可能性があります。

GET/read なら `useAction` より実害は小さいですが、API契約として不自然です。

`useAction` 修正時に同じ lifecycle policy を共通化してください。

---

# 6. Beginner-path simulation

ここでは「知識のある開発者なら補完できる」を禁止し、**書かれている通りにしか動けない利用者**として追跡しました。

---

## Persona A — Web開発未経験、CLIは使える、Node 18 を持っている

### Step 1: README の installer をコピー

安全な GitHub Pages tarball URL を使う。

**評価:** 良い。  
current smoke test でも tarball と SHA endpoint の配信は成功。

### Step 2: template を聞かれる

説明:

- Astro = サイト
- Vite + React = アプリ

**評価:** 良い。初心者でもかなり選びやすい。

default は Astro。

### Step 3: `npm install`

**STOP #1 — 現在の Astro version requirement が npm と整合しない。**

初心者はここで終了します。

エラー原因が WebTemplate 側の version typo なのか npm/node 側なのか判断できません。

### Step 4: 仮に version を直したとして Node 18

HowToUse は「Node 18以上」を troubleshooting として案内。

しかし current Astro は Node 22.12+。

**STOP #2 — ドキュメントが「あなたのNodeはOK」と誤診する。**

これは初心者に非常に厳しいです。

---

## Persona B — Node 22を持っている初心者、Astro install問題を修正済みと仮定

### Step 1: 色を変更

theme guidance は概ね理解可能。

### Step 2: spacing を変更

HowToUse の最小 token:

```text
3xs
```

をコピー。

実装には存在しない。

**STOP/CONFUSION #3 — 「コードはエラーにならないが見た目が変」系。**

これは初心者が最も切り分けにくい種類です。

### Step 3: DataTable を追加

```bash
npx shadcn@latest add @nasu/data-table
```

と書いてあるので実行。

**CONFUSION #4**

- WebTemplate 本体は supply-chain hardening をしているのに、この command だけ最新版を即実行
- repository で検証された shadcn と利用者が実行する shadcn が一致しない
- upstream change で突然 onboarding が壊れ得る

初心者には「WebTemplateのバグ」か「shadcnの変更」か判別不能。

---

## Persona C — 問い合わせフォームを本番公開したい初心者

### Step 1: receiver example をコピー

Cloudflare Worker を作る。

### Step 2: secrets を設定

`MAIL_API_KEY`, `MAIL_TO` は理解しやすい。

`ALLOWED_ORIGIN` は重要性の説明に比べ、copy-paste setup sequence が弱い。

**CONFUSION #5 — 何をどこへ設定するかが揃っていない。**

### Step 3: 一つ secret を設定し忘れる

form submit。

frontend は success。

Worker は `ok:true`, `forwarded:false`, HTTP 200。

**DATA LOSS #6 — 問い合わせが消えるのに、利用者には成功表示。**

しかも payload が log に出る。

この挙動は beginner-targeted production example としては許容しづらいです。

### Step 4: 公開後 spam が来る

CORS/honeypot があるため「bot対策済み」と考える可能性がある。

しかし direct POST は可能。

**SECURITY CONFUSION #7 — browser policy と API abuse protection の区別を初心者に要求している。**

---

## Persona D — Vite app を GitHub Pages に公開

### Step 1: HowToUse の公開先例から GitHub Pages を選択

「GitHub repo と繋いで push」と理解。

### Step 2: project Pages URL

```text
https://user.github.io/my-app/
```

に deploy。

generated Vite config は root `base`。

**STOP #8 — assets/path が repo subpath と一致しない可能性。**

Web開発初心者には `base path` という概念自体がありません。

GitHub Pages を候補として出すなら、ここまで generator が面倒を見るべきです。

---

# 7. What the current CI proves — and what it does not

## 現在確認できたこと

Current main HEAD:

`a1e1c36a4a13710a7db06465eb224e92e9801cbc`

GitHub Actions:

- verify: success
- build: success
- deploy: success
- smoke: success

Published smoke:

- registry index HTTP 200
- JSON content-type
- registry item count = 38
- 38 items fetchable
- create tarball HTTP 200
- SHA endpoint HTTP 200
- hash match
- gzip header valid
- nonexistent URL => 404

これは良いリリース検査です。

## しかし証明していないこと

- default user が `npm install` できる
- generated Astro が fresh npm で build できる
- generated Vite が fresh npm で build できる
- Node 18 の説明が正しい
- Windows name/path が安全
- `npx shadcn@latest` の現在版が tested version と同じ
- async guard が race しない
- lifecycle callback exception が action を retry しない
- receiver が misconfiguration を fail closed する
- GitHub Pages project path deploy が動く

### Core lesson

**Green CI is not the problem.  
Green CI の意味を広く解釈しすぎることが問題です。**

現在の test suite 自体はかなり良いです。

必要なのは「利用者が辿る外周」を release gate に足すことです。

---

# 8. Security posture review

## Strong points

### 8.1 GitHub Actions SHA pinning

良いです。

`@v4` のような mutable tag ではなく commit SHA 固定を選んでいるのは supply-chain security として妥当。

### 8.2 Workflow permissions

verify workflow:

```yaml
permissions:
  contents: read
```

Pages deploy のみ:

```yaml
pages: write
id-token: write
```

へ昇格。

least privilege の考え方は良いです。

### 8.3 Minimum release age

`pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 4320
```

3日待つ方針。

新規 dependency hijack の短期 window を避ける目的として合理的。

### 8.4 install scripts allowlist/deny posture

`allowBuilds` を明示している点も良いです。

### 8.5 Main/tag protection

- deletion protection
- non-fast-forward protection
- required `verify`

を確認。

solo repository としてはかなり意識されています。

---

## Weak points

- generated users の npm path には root pnpm hardening が適用されない
- bare `npx create-webtemplate` が内部案内に残る
- generated shadcn command は `@latest`
- installer tarball は mutable
- Dependabot security alerts disabled
- root SECURITY disclosure route 無し
- receiver は CORS/honeypot を越える abuse protection が弱い
- `.env` ignore 無し

### Important design principle

**repository maintainer の supply-chain policy と、generated user の supply-chain policy を分けないこと。**

現状は本体の方がかなり堅く、生成物へ出た瞬間に安全水準が落ちます。

---

# 9. Recommended release-gate architecture

Claude には、個別修正だけでなくこの構造変更を勧めます。

```text
PR
 |
 +-- static/type tests
 |
 +-- component browser tests
 |
 +-- registry tests
 |
 +-- create-light tests
 |
 +-- USER-PATH MATRIX
 |    |
 |    +-- generate Astro
 |    |    +-- npm install
 |    |    +-- npm run build
 |    |    +-- npm run preview
 |    |    +-- browser smoke
 |    |    +-- shadcn add
 |    |
 |    +-- generate Vite
 |         +-- npm install
 |         +-- npm run build
 |         +-- npm run preview
 |         +-- browser smoke
 |         +-- shadcn add
 |
 +-- dependency audit
 |
 +-- package installer
 |
 +-- deploy Pages
 |
 +-- public smoke
```

**`pages deploy` は USER-PATH MATRIX 成功後のみ。**

---

# 10. Recommended tests to add

## Release-critical

### 10.1 Fresh npm install

```text
generate Astro -> npm install -> build
generate Vite  -> npm install -> build
```

### 10.2 Dependency existence

scaffold direct dependency ranges が public registry で resolve できること。

### 10.3 Node minimum

minimum supported Node で generator/project build。

### 10.4 Unsafe command lint

forbid:

```text
npx create-webtemplate
npx shadcn@latest
```

approved explanatory locations 以外。

### 10.5 Generated `.gitignore`

assert:

```text
.env
.env.*
!.env.example
```

### 10.6 Docs-token consistency

```text
HowToUse tokens == CSS tokens
HowToUse themes == actual themes
```

---

## Async correctness

### 10.7 callback exception

```text
action success + onSuccess throw + retry=3
=> action called once
```

### 10.8 async guard race

```text
guard waits
5 rapid calls
=> action called once
```

### 10.9 abort after server receive

client abort を「副作用キャンセル」と誤認しない contract test/documentation。

---

## Receiver

### 10.10 Missing config

```text
missing MAIL_API_KEY => 503
missing MAIL_TO => 503
```

### 10.11 Provider failure

provider 4xx/5xx => frontend success にしない。

### 10.12 Body limit

large request => 413.

### 10.13 Validation

invalid email/oversize message => 400.

### 10.14 No PII log

test logger output does not include raw email/message.

---

# 11. Recommended patch order for Claude

以下の順なら、途中で別修正を無駄にしにくいです。

## Phase 0 — Stop broken releases

1. Fix `astro` version
2. Add fresh `npm install` Astro/Vite CI
3. Make that job required before Pages deploy
4. Add Node `>=22.12.0` everywhere
5. Fix generated `.gitignore`

## Phase 1 — Correct core async semantics

6. Refactor `useAction` retry boundary
7. Fix async guard locking
8. Apply same callback-boundary policy to `useResource`
9. Add race/callback tests

## Phase 2 — Production safety

10. Receiver misconfiguration => fail closed
11. Remove PII payload logging
12. Add rate/body/validation guidance or implementation
13. Make `ALLOWED_ORIGIN` setup explicit

## Phase 3 — Supply-chain consistency

14. Remove bare `npx create-webtemplate`
15. Stop recommending `shadcn@latest`
16. Consider immutable/versioned installer tarballs
17. Enable Dependabot security alerts
18. Update pinned GitHub Action SHAs to non-deprecated majors

## Phase 4 — Beginner UX

19. Fix spacing/theme docs
20. Fix Windows project-name validation
21. Reject unknown CLI flags
22. Add exact GitHub Pages guide/preset
23. Add root `SECURITY.md`
24. Clean CI hints

---

# 12. Suggested acceptance criteria before public stable release

I would personally require all of these:

- [ ] `create-webtemplate` default Astro works from an empty machine with Node 22 + npm
- [ ] Vite template works from an empty machine with Node 22 + npm
- [ ] both build successfully
- [ ] both preview successfully
- [ ] documented component-add command is exactly the command CI tests
- [ ] no use of unpinned `@latest` in the beginner path unless explicitly justified
- [ ] generated `.env` secrets cannot be committed by default
- [ ] `useAction` cannot duplicate a successful side effect because a callback threw
- [ ] async guard cannot permit concurrent action execution
- [ ] contact receiver never reports delivery success when forwarding was skipped
- [ ] contact receiver does not log raw PII by default
- [ ] public endpoint docs do not present CORS as authentication/bot protection
- [ ] current supported Node version is stated consistently
- [ ] spacing/theme docs are generated or mechanically checked against implementation
- [ ] GitHub Pages project-site path is either supported explicitly or removed from the one-line deployment claim
- [ ] Dependabot security alerts enabled or an equivalent vulnerability-alert mechanism documented
- [ ] release CI invokes the full user-path tests
- [ ] public smoke remains green

---

# 13. Overall assessment

## Engineering quality

**High for an individual/open-source template project.**

内部コメントが「なぜこのテストが必要なのか」を説明しており、過去に実際に踏んだ失敗を regression test に変えている点は非常に良いです。

`verify-create.mjs` のコメントを見る限り、開発姿勢そのものは release-quality を目指しています。

## Current release readiness

**Not yet stable-release ready.**

理由はコード量や polish ではなく、

> **ユーザー導線と検証導線の最後の1mが一致していない**

ためです。

そのズレが、

- 存在しない/不整合な Astro version
- npm vs pnpm
- `shadcn@latest`
- Node 18 表示
- unsafe bare npx
- callback retry
- async guard race
- false-success receiver

という形で実害へ繋がっています。

## Beginner experience

**設計思想は非常に良いが、現在は数個の「一度踏むと初心者には自力復帰が難しい穴」がある。**

特に、

1. install
2. Node version
3. spacing token
4. production form
5. GitHub Pages

は、ベテランなら数分で原因を見つけても、初学者は「Web開発は難しい」「自分が何か間違えた」と考えて離脱する箇所です。

初心者向け製品では、機能数を増やすより**この種の cliff をゼロに近づける方が価値が高い**です。

## Veteran experience

上級者から見ると、

- code copy ownership
- relatively unopinionated primitives
- testable action abstraction
- registry
- Astro/Vite options
- strict supply-chain awareness

は魅力があります。

一方で上級者ほど `useAction` の retry semantics、mutable installer、receiver security boundary を気にするので、この3点は API contract として明確に直した方が信頼されます。

---

# 14. Final verdict

### Current

**HOLD**

P0/P1 を残したまま stable release はしない方が良いです。

### After P0/P1 fixes

**Public beta: YES**

### Stable recommendation threshold

上記 acceptance criteria を満たし、少なくとも一度:

```text
fresh Node 22 machine
+ npm
+ Astro
+ Vite
+ Windows/Ubuntu
+ component add
+ build
+ preview
+ deploy
```

を release gate で通した後。

---

# 15. Evidence / sources consulted

## Repository

Reviewed at commit:

`a1e1c36a4a13710a7db06465eb224e92e9801cbc`

Important files:

- `README.md`
- `LICENSE`
- `docs/security.md`
- `package.json`
- `pnpm-workspace.yaml`
- `renovate.json`
- `.github/workflows/verify.yml`
- `.github/workflows/pages.yml`
- `packages/create-webtemplate/index.mjs`
- `packages/create-webtemplate/scaffold/astro/package.json`
- `packages/create-webtemplate/scaffold/vite/package.json`
- `packages/create-webtemplate/scaffold/astro/astro.config.mjs`
- `packages/create-webtemplate/scaffold/vite/vite.config.ts`
- `scripts/verify-create.mjs`
- `scripts/build-pages.mjs`
- `registry/nasu/hooks/use-action.ts`
- `registry/nasu/hooks/use-resource.ts`
- `registry/nasu/lib/action.ts`
- `registry/nasu/lib/submit.ts`
- `registry/nasu/lib/upload.ts`
- `registry/nasu/components/ui/file-drop.tsx`
- `registry/nasu/components/ui/async-form.tsx`
- `registry/nasu/lib/tokens.css`
- `registry/nasu/lib/themes.css`
- `examples/receivers/cloudflare-worker.ts`
- `examples/receivers/README.md`

Current GitHub Actions run inspected:

`https://github.com/Nasu726/WebTemplate/actions/runs/32015342821`

## Upstream/current references

- npm registry `astro/latest` metadata, reviewed 2026-08-17
- npm package metadata for Tailwind / Vite React plugin
- Vite official static deployment documentation:
  `https://vite.dev/guide/static-deploy`
- Vite v8 getting started / Node compatibility:
  `https://v8.vite.dev/guide/`
- Astro GitHub Pages documentation:
  `https://docs.astro.build/en/guides/deploy/github/`
- Astro package metadata / current Node engine:
  `https://github.com/withastro/astro/blob/main/packages/astro/package.json`

---

# 16. Review limitations

- Repository content and GitHub Actions logs were inspected through the connected GitHub integration.
- Current npm/framework facts were cross-checked against upstream/npm sources.
- The review environment's local container could not independently resolve GitHub/npm DNS, so I could not perform a second independent local clone + `npm install`.
- Therefore runtime statements are separated into:
  - behavior already evidenced by current GitHub Actions,
  - deterministic code-level findings,
  - current registry compatibility findings.
- The most important recommendation is consequently to make **fresh `npm install` itself a required CI release gate**, so future reviewers and maintainers do not need to trust an external manual reproduction.

