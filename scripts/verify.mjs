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
import { pnpm, stopTree } from "./_proc.mjs";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROMIUM = process.env.CHROMIUM_PATH || "";

/* ------------------------------------------------------------------
 * Windows 対応
 * ------------------------------------------------------------------
 * Windows 11 / node 24.13 / pnpm 10.28 の実機で確認しました（v0.9a）。
 *
 * 1. pnpm の起動は `scripts/_proc.mjs` に寄せてあります。
 *    **なぜ 1 行で済まないのかは、あちらのコメントに書きました。**
 *    ここに書き写すと、片方だけ直してもう片方が古いまま残ります。
 * 2. 検査用のサーバは **自分で立てます**（scripts/_static.mjs）。
 *    道具の preview はデーモンになったり子を切り離したりするので、
 *    止め方が OS ごとに違う問題を丸ごと避けられます。
 *
 * 配布物（利用者が受け取る 38 ファイル）には OS 依存はありません。
 * ここは開発用スクリプトの話です。
 * ---------------------------------------------------------------- */

const results = [];
let failed = false;

function step(name, cmd, args, opts = {}) {
  process.stdout.write(`\n── ${name}\n`);
  const p = cmd === "pnpm" ? pnpm(args) : { cmd, args, options: {} };
  const r = spawnSync(p.cmd, p.args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
    ...p.options,
    ...opts,
  });
  /* 起動そのものに失敗したときは status が null になります。
     **理由を印字しないと ✗ の一行しか残りません。**
     実際 Windows で全 4 工程が EINVAL で起動できておらず、
     出力が空なだけの「失敗」に見えていました。黙って落とさないこと。 */
  if (r.error) console.error(`  起動できませんでした: ${r.error.message}`);
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
// 手元でしか通らない絶対パスを探します。ブラウザを立てる前に置いてあるのは、
// この種の間違いが「判定は全部通っているのにスクリプトが死ぬ」という
// 分かりにくい落ち方をするからです。先に名指しで落とします。
step("環境に張り付いた絶対パス", "node", ["scripts/check-portability.mjs"]);
// 純粋な関数の単体検査。ブラウザを立てないので速く、
// `&` ひとつでフィードが壊れる類の間違いはここでしか捕まえられません。
step("単体: SEO / フィードの組み立て", "node", ["scripts/verify-seo-unit.mjs"]);
// 入口。生成物を install / build するところまでは重いので
// `pnpm verify:create` に分けています（ここは生成と検証だけ）。
step("入口: create-webtemplate", "node", ["scripts/verify-create.mjs"]);
step("利用者プロジェクトへ展開して型検査", "node", [
  "scripts/verify-install.mjs",
]);
// 上は「CLI と同じ解決規則の再現」です。再現である以上、こちらの
// 思い込みがそのまま検査に入ります。**本物の CLI も通します。**
// ネットワークが無い環境では、理由を印字して明示的に飛ばします。
step("本物の shadcn CLI で入れる", "node", [
  "scripts/verify-install-real.mjs",
]);

/* ---- 4: 実ブラウザ検証 -------------------------------------------- */

/* ビルド済みの中身は**自分で、別プロセスとして配ります。**
   - 道具の preview を使わない理由 … scripts/_static.mjs
   - 同じプロセスに置けない理由 … scripts/serve-static.mjs
     （step() は spawnSync なので、子が走る間は応答できません）
   相手は自分で書いた素の node なので、kill() で確実に止まります。 */
function serve(dir, port, ...flags) {
  return spawn(
    process.execPath,
    [path.join(root, "scripts/serve-static.mjs"), path.join(root, dir), String(port), ...flags],
    { cwd: root, stdio: "ignore", detached: process.platform !== "win32" },
  );
}
const servers = [
  serve("apps/playground/dist", 4173, "--spa"),
  serve("apps/site/dist", 4321),
];

process.stdout.write("\nプレビューサーバの起動を待っています…\n");
const PREVIEWS = ["http://127.0.0.1:4173/", "http://127.0.0.1:4321/"];
let ready = [];
for (let i = 0; i < 20; i++) {
  await sleep(500);
  ready = await Promise.all(
    PREVIEWS.map((u) => fetch(u).then((r) => r.ok, () => false)),
  );
  if (ready.every(Boolean)) break;
}

/* **立たなかったら、そこで落とします。**
   以前はそのまま先へ進んでいました。すると実ブラウザの工程が
   8 つまとめて「接続できません」で赤くなり、**一覧のどこにも
   「サーバが立たなかった」とは出ません。** 原因を探して 8 本の
   スタックを読むことになります。名指しで 1 行落とすほうが速い。

   実際 astro 7 で preview がデーモンになったとき、この形で 8 工程が
   まとめて赤くなり、原因の切り分けに時間を取られました。 */
if (!ready.every(Boolean)) {
  const dead = PREVIEWS.filter((_, i) => !ready[i]);
  console.error(`\n✗ プレビューサーバが立ちませんでした: ${dead.join(" / ")}`);
  console.error("  ポートが埋まっていないか、ビルドが済んでいるかを見てください。");
  results.push({ name: "プレビューサーバの起動", ok: false });
  failed = true;
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

// 素の node なので、これで確実に止まります（デーモン化も再起動もしません）。
for (const s of servers) stopTree(s);

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
