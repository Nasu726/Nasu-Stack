/**
 * **本物の shadcn CLI** で入れて、通ることを確かめます。
 *
 *   node scripts/verify-install-real.mjs
 *
 * ----------------------------------------------------------------
 * verify-install.mjs と何が違うのか
 * ----------------------------------------------------------------
 * あちらは CLI と**同じ解決規則を再現**します。オフラインで回るので速く、
 * CI でも確実に走ります。ただし再現である以上、**こちらの思い込みが
 * そのまま検査に入ります。**
 *
 * 実際そうでした。v0.9a で本物を通したら、いきなり止まりました。
 *
 *     Unknown registry "@nasu". Make sure it is defined under "registries"
 *
 * `registryDependencies` に `@nasu/action` と書く形は、利用者の
 * `components.json` に `registries` の宣言があって初めて解決されます。
 * 再現側はその一手を知らないので、**ずっと緑のままでした。**
 * だから両方置きます。役割が違います。
 *
 * ----------------------------------------------------------------
 * 公開を待たずに回せます
 * ----------------------------------------------------------------
 * `public/` を手元で配って、そこへ CLI を向けます。
 * 公開先が生きているかに検査を依存させません
 * （公開先そのものの確認は verify-published.mjs の仕事です）。
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { makeFixture } from "./_fixture.mjs";
import { stopTree } from "./_proc.mjs";
import { fetchWithRetry } from "./fetch-with-retry.mjs";
import { createCheckHarness, log } from "./_check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5077;
const BASE = `http://127.0.0.1:${PORT}`;

const { must, exit } = createCheckHarness();

function finish(code) {
  exit({ code });
}

/* --- 0. 配るものがあるか ------------------------------------------- */
const pub = path.join(root, "public");
if (!fs.existsSync(path.join(pub, "r", "index.json"))) {
  console.error("public/r が空です。先に `pnpm pages:build` を走らせてください。");
  process.exit(2);
}

/* --- 1. 手元でネットワークが無いなら、理由を出して飛ばす ------------ */
/* **黙って通してはいけません。** 「通った」と「試していない」が
   同じ緑に見えると、検査そのものが信用できなくなります。
   CIでは公開前の証拠なので、到達できない場合も赤にします。 */
const online = await fetchWithRetry("https://registry.npmjs.org/shadcn", {}, {
  fetchImpl: (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
}).then(
  (r) => r.ok,
  () => false,
);
if (!online) {
  console.log("· registry.npmjs.org に届きません。本物の CLI の検査は飛ばします。");
  console.log("·（再現側の検査は scripts/verify-install.mjs が受け持ちます）");
  if (process.env.CI) {
    console.error("✗ CIでは本物の shadcn CLI 検査を必須にします");
    process.exit(1);
  }
  process.exit(0);
}

/* --- 2. public/ を配る ---------------------------------------------- */
const server = spawn(
  process.execPath,
  [path.join(root, "scripts/serve-registry.mjs"), String(PORT)],
  { stdio: "ignore", detached: process.platform !== "win32" },
);
let up = false;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  up = await fetch(`${BASE}/r/index.json`).then((r) => r.ok, () => false);
  if (up) break;
}
must("レジストリを配れた", up, BASE);
if (!up) {
  stopTree(server);
  finish(1);
}

/* --- 3. まっさらなプロジェクトを作る -------------------------------- */
/* **置き場はリポジトリの中です。** os.tmpdir() ではありません。
   展開されたものは react も clsx も import します。ここに置けば、
   モジュール解決が親へ登ってこのリポジトリの node_modules に当たるので、
   検査のためだけに依存を入れ直さずに済みます
   （verify-install.mjs が `.verify-install/` でやっているのと同じ手です）。 */
const work = path.join(root, ".verify-install-real");
makeFixture(work, { project: true });

const index = JSON.parse(fs.readFileSync(path.join(pub, "r", "index.json"), "utf8"));
/* **一覧は生成物から取ります。** 手で並べると、部品を足したときに
   「入れてみる対象」から漏れます（カタログのタブで一度やった失敗です）。 */
const all = index.items.map((i) => `@nasu/${i.name}`);

function shadcn(args, cwd) {
  return execFileSync(
    process.execPath,
    // npx を挟むと Windows で .cmd を踏みます。npm の JS を直に動かします。
    [path.join(root, "node_modules", "shadcn", "dist", "index.js"), ...args],
    { cwd, encoding: "utf8", stdio: "pipe" },
  );
}

/* --- 3.5 案内しているとおりに registries を足す ---------------------- */
/* **README が書いているのはこの 1 コマンドです。**
   ここで `components.json` を直接書いてしまうと、案内している手順そのものは
   一度も動かないまま緑になります。CLI 側がこの機能をやめても気づけません。 */
const REGISTRY_ARG = `@nasu=${BASE}/r/{name}.json`;
try {
  shadcn(["registry", "add", REGISTRY_ARG], work);
} catch (e) {
  must("shadcn registry add で名前空間を足せる", false, String(e.stdout ?? e).slice(-400));
  stopTree(server);
  finish(1);
}
must(
  "shadcn registry add で名前空間を足せる",
  JSON.parse(fs.readFileSync(path.join(work, "components.json"), "utf8"))
    .registries?.["@nasu"] === `${BASE}/r/{name}.json`,
);

/* --- 4. 本物の CLI で全部入れる -------------------------------------- */
let added = "";
try {
  added = shadcn(["add", ...all, "--yes"], work);
  must(`本物の shadcn CLI で ${all.length} 項目が入る`, true);
} catch (e) {
  const out = (String(e.stdout ?? "") + String(e.stderr ?? "")).slice(-600);
  must(`本物の shadcn CLI で ${all.length} 項目が入る`, false, out);
  stopTree(server);
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  finish(1);
}

const written = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else written.push(path.relative(work, p));
  }
})(path.join(work, "src"));

/* 配っているファイル数と、実際に書かれた数を突き合わせます。
   **「コマンドが成功した」と「中身が届いた」は別のこと**です。 */
const expectedFiles = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
).items.flatMap((i) => i.files ?? []).filter((f) => f.target).length;
must(
  "配っているファイルが全部書かれた",
  written.length === expectedFiles,
  `書かれた ${written.length} / 配っている ${expectedFiles}`,
);
log(`展開先: ${work}`);

/* --- 5. 展開されたものが型検査に通る -------------------------------- */
try {
  execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", work],
    { stdio: "pipe", encoding: "utf8" },
  );
  must("展開されたものが型検査に通る", true);
} catch (e) {
  must("展開されたものが型検査に通る", false, String(e.stdout ?? "").slice(-600));
}

/* --- 6. わざと壊して、赤くなることを確かめる ------------------------ */
/* **判定を足しただけでは、落ちるかどうか分かりません。**
   `registries` を外したプロジェクトで同じことをして、
   ちゃんと失敗することを確認します。ここが通ってしまうなら、
   上の 4 は何も見ていません。 */
const broken = path.join(root, ".verify-install-real-broken");
makeFixture(broken, { project: true });

let failedAsExpected = false;
let why = "";
try {
  shadcn(["add", "@nasu/action-button", "--yes"], broken);
} catch (e) {
  failedAsExpected = true;
  why = (String(e.stdout ?? "") + String(e.stderr ?? "")).match(/Unknown registry[^\n]*/)?.[0] ?? "";
}
must("registries が無いプロジェクトでは、ちゃんと失敗する", failedAsExpected, why);

/* URL を直に指定すれば名前空間を宣言せずに済む、と誤解されがちです。
   **依存に `@nasu/…` がある部品は 1 ファイルも入りません。**
   README にはそう書いてあるので、実際にそうであることを見ておきます。 */
let urlFormFailed = false;
try {
  shadcn(["add", `${BASE}/r/action-button.json`, "--yes"], broken);
} catch {
  urlFormFailed = true;
}
const leftover = fs.existsSync(path.join(broken, "src"))
  ? fs.readdirSync(path.join(broken, "src")).length
  : 0;
must(
  "URL 直指定でも、依存が辿れないなら 1 ファイルも書かれない",
  urlFormFailed && leftover === 0,
  `書かれた ${leftover} 件`,
);

/* --- 後片付け -------------------------------------------------------- */
stopTree(server);
for (const d of [work, broken]) {
  try {
    fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (e) {
    log(`⚠️ 作業ディレクトリを消せませんでした (${d}): ${String(e).slice(0, 120)}`);
  }
}
finish();
