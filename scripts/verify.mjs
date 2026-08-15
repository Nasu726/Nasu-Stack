/**
 * 全部の検証を 1 コマンドで走らせます。
 *
 *   pnpm verify
 *
 * やること:
 *   1. 型検査（カタログ + レジストリ / Astro サイト）
 *   2. ビルド（両アプリ）
 *   3. レジストリ生成 → 利用者プロジェクトへ展開して型検査
 *   4. プレビューサーバを立てて、実ブラウザで検証
 *        - 非同期の状態（pending / success / error / 空 / 中断 / 二重送信）
 *        - レイアウトと通知
 *        - 壊しにくる中身を入れたときのはみ出し
 *        - 端末幅の崩れ
 *
 * どれか 1 つでも落ちたら終了コード 1。CI にそのまま載せられます。
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROMIUM = process.env.CHROMIUM_PATH || "";

/* ------------------------------------------------------------------
 * Windows 対応（**未検証**）
 * ------------------------------------------------------------------
 * ⚠️ 要確認: Windows の実機で動かしていません。コードを読んだ限りの対応です。
 *
 * 1. pnpm は Windows では `pnpm.cmd` という実体です。
 *    `spawn("pnpm")` は拡張子を補ってくれないので ENOENT になります。
 * 2. `process.kill(-pid)` の負の値は「プロセスグループ」の意味で、
 *    POSIX にしかありません。Windows では taskkill を使います。
 *
 * 配布物（利用者が受け取る 33 ファイル）には OS 依存はありません。
 * ここは開発用スクリプトの話です。
 * ---------------------------------------------------------------- */
const isWindows = process.platform === "win32";
const PNPM = isWindows ? "pnpm.cmd" : "pnpm";

const results = [];
let failed = false;

function step(name, cmd, args, opts = {}) {
  process.stdout.write(`\n── ${name}\n`);
  const r = spawnSync(cmd === "pnpm" ? PNPM : cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
    ...opts,
  });
  const ok = r.status === 0;
  if (!ok) failed = true;
  results.push({ name, ok });
  return ok;
}

/* ---- 1〜3: 型検査・ビルド・配布物 ---------------------------------- */

step("型検査 (カタログ + レジストリ)", "pnpm", [
  "--filter",
  "playground",
  "exec",
  "tsc",
  "--noEmit",
]);
step("型検査 (Astro サイト)", "pnpm", [
  "--filter",
  "site",
  "exec",
  "astro",
  "check",
]);
step("ビルド (カタログ)", "pnpm", ["--filter", "playground", "build"]);
step("ビルド (Astro サイト)", "pnpm", ["--filter", "site", "build"]);
step("レジストリ生成", "node", ["scripts/build-registry.mjs"]);
step("配布の依存漏れ", "node", ["scripts/check-registry-deps.mjs"]);
// 純粋な関数の単体検査。ブラウザを立てないので速く、
// `&` ひとつでフィードが壊れる類の間違いはここでしか捕まえられません。
step("単体: SEO / フィードの組み立て", "node", ["scripts/verify-seo-unit.mjs"]);
step("利用者プロジェクトへ展開して型検査", "node", [
  "scripts/verify-install.mjs",
]);

/* ---- 4: 実ブラウザ検証 -------------------------------------------- */

const servers = [];
function serve(filter, cmd, args, port) {
  const p = spawn(PNPM, ["--filter", filter, "exec", cmd, ...args], {
    cwd: root,
    stdio: "ignore",
    // detached は POSIX でプロセスグループを作るためのものです。
    // Windows では意味が違うので付けません（下の停止処理も分岐します）。
    detached: !isWindows,
  });
  servers.push(p);
  return port;
}

serve("playground", "vite", ["preview", "--port", "4173", "--host", "127.0.0.1"], 4173);
serve("site", "astro", ["preview", "--port", "4321", "--host", "127.0.0.1"], 4321);

process.stdout.write("\nプレビューサーバの起動を待っています…\n");
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const ok = await Promise.all(
    ["http://127.0.0.1:4173/", "http://127.0.0.1:4321/"].map((u) =>
      fetch(u).then(
        (r) => r.ok,
        () => false,
      ),
    ),
  );
  if (ok.every(Boolean)) break;
}

step("実ブラウザ: 非同期の状態", "node", ["scripts/verify-states.mjs"]);
step("実ブラウザ: レイアウトと通知", "node", ["scripts/verify-layout.mjs"]);
step("実ブラウザ: 壊しにくる中身", "node", ["scripts/audit-stress.mjs"]);
step("実ブラウザ: 部品 (v0.4)", "node", ["scripts/verify-parts.mjs"]);
step("実ブラウザ: 入力/選択/楽観更新 (v0.5)", "node", ["scripts/verify-forms.mjs"]);
step("実ブラウザ: ナビ/開閉/本文/画像 (v0.6)", "node", ["scripts/verify-nav.mjs"]);
step("実ブラウザ: SEO / ブログ / フィード (v0.7)", "node", ["scripts/verify-seo.mjs"]);
// 受け口サーバを立てて、本物の HTTP を飛ばして測ります
step("実ブラウザ: フォームの送信先 (v0.8)", "node", ["scripts/verify-submit.mjs"]);
// カタログはタブで中身が入れ替わるので、既定タブだけを見ても
// 後から足した部品は一度も検査されません。全タブを URL で指定して回します。
// 一覧はカタログ側の 1 か所から読みます（書き写すと必ずずれます）。
const { TAB_KEYS: PLAYGROUND_TABS } = await import(
  "../apps/playground/src/tabs.mjs"
);
/* Astro サイト側のページ一覧は **sitemap.xml から取ります。**
   ここに手で書き並べると、ページを足したときに検査から漏れます
   （カタログのタブで一度やった失敗です）。
   sitemap は下書きを外した公開ページの一覧そのものなので、
   これを使えば「新しいページが自動で検査に入る」状態になります。 */
async function sitePages() {
  const fallback = ["http://127.0.0.1:4321/"];
  try {
    const xml = await (await fetch("http://127.0.0.1:4321/sitemap.xml")).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""))
      .filter(Boolean);
    if (paths.length === 0) {
      console.error("⚠️ sitemap.xml に URL がありませんでした。トップだけ検査します");
      return fallback;
    }
    return paths.map((p) => `http://127.0.0.1:4321${p}`);
  } catch (e) {
    // 黙って 1 ページに落とすと「全部見たつもり」になります。理由を必ず出します。
    console.error("⚠️ sitemap.xml を取得できませんでした:", String(e).slice(0, 120));
    return fallback;
  }
}
const SITE_PAGES = await sitePages();
process.stdout.write(`\n（Astro サイトの検査対象: ${SITE_PAGES.length} ページ）\n`);

step("実ブラウザ: 端末幅の崩れ", "node", [
  "registry/nasu/scripts/check-responsive.mjs",
  ...PLAYGROUND_TABS.map((t) => `http://127.0.0.1:4173/?tab=${t}`),
  ...SITE_PAGES,
]);

for (const p of servers) {
  try {
    if (isWindows) {
      // ⚠️ 要確認: Windows 実機で未検証。
      // /T で子プロセスごと、/F で強制終了します。
      spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      // 負の PID は「このプロセスグループ全体」。POSIX のみ。
      process.kill(-p.pid);
    }
  } catch {
    /* すでに落ちている */
  }
}

/* ---- まとめ -------------------------------------------------------- */

console.log("\n" + "─".repeat(52));
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}`);
}
console.log("─".repeat(52));
console.log(
  failed
    ? `\n❌ ${results.filter((r) => !r.ok).length} / ${results.length} が失敗しました`
    : `\n✅ ${results.length} / ${results.length} すべて成功しました`,
);
if (CHROMIUM) console.log(`   (CHROMIUM_PATH=${CHROMIUM})`);

process.exit(failed ? 1 : 0);
