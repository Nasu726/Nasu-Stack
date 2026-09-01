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
import { spawn } from "node:child_process";
import os from "node:os";
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

/* ------------------------------------------------------------------
 * 工程の走らせ方
 * ------------------------------------------------------------------
 * 独立している工程は同時に走らせます。20 を超える工程を直列に回すと、
 * 手元でも CI でも待ち時間が長くなり、**「とりあえず push して CI で見る」
 * ようになります。** それは検査を書いた意味を薄めます。
 *
 * ただし速さのために読みやすさを捨てません。
 *
 *   - 出力は工程ごとに溜めて、**終わった順ではなく定義順に**出します。
 *     混ざった出力は読めないので、速くなっても意味がありません
 *   - 実ブラウザの工程は Chromium を 1 つずつ立てます。無制限に並べると
 *     CI の runner（2 コア）では**かえって遅くなります**。上限を設けます
 * ---------------------------------------------------------------- */

/** 同時に走らせる数。CI の runner は 2 コアなので、そこに合わせます。 */
const LANES = Math.max(2, Math.min(4, (os.availableParallelism?.() ?? 2)));

/** 1 工程を走らせて、出力を溜めて返します。印字はしません。 */
function runStep(name, cmd, args, opts = {}) {
  const p = cmd === "pnpm" ? pnpm(args) : { cmd, args, options: {} };
  return new Promise((resolve) => {
    const child = spawn(p.cmd, p.args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      ...p.options,
      ...opts,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => {
      /* 起動そのものに失敗したときは status が来ません。
         **理由を印字しないと ✗ の一行しか残りません。**
         Windows で全 4 工程が EINVAL で起動できておらず、出力が空なだけの
         「失敗」に見えていたことがあります。黙って落とさないこと。 */
      out += `\n  起動できませんでした: ${e.message}\n`;
      resolve({ name, ok: false, out });
    });
    child.on("close", (code) => resolve({ name, ok: code === 0, out }));
  });
}

/** 溜めた出力を、定義順に印字します。 */
function report(r) {
  process.stdout.write(`\n── ${r.name}\n`);
  if (r.out) {
    process.stdout.write(r.out.endsWith("\n") ? r.out : `${r.out}\n`);
  }
  if (!r.ok) failed = true;
  results.push({ name: r.name, ok: r.ok });
}

/**
 * 独立した工程をまとめて走らせます。
 * **順番は保ちます。** 渡した順に印字するので、読む側は直列と変わりません。
 */
async function group(steps) {
  const queue = [...steps.entries()];
  const done = new Array(steps.length);
  const lanes = Array.from({ length: Math.min(LANES, steps.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const [i, [name, cmd, args, opts]] = next;
      done[i] = await runStep(name, cmd, args, opts);
    }
  });
  await Promise.all(lanes);
  for (const r of done) report(r);
}

/** 1 つだけ走らせます（後続がその結果に依存するとき）。 */
async function step(name, cmd, args, opts = {}) {
  const r = await runStep(name, cmd, args, opts);
  report(r);
  return r.ok;
}

/* ---- 群 1: 互いに独立。まとめて回します ---------------------------- */

await group([
  ["型検査 (カタログ + レジストリ)", "pnpm", ["--filter", "playground", "exec", "tsc", "--noEmit"]],
  ["型検査 (Astro サイト)", "pnpm", ["--filter", "site", "exec", "astro", "check"]],
  ["ビルド (カタログ)", "pnpm", ["--filter", "playground", "build"]],
  ["ビルド (Astro サイト)", "pnpm", ["--filter", "site", "build"]],
  // 手元でしか通らない絶対パス。**ブラウザを立てる前に**名指しで落とします。
  // この種の間違いは「判定は全部通っているのにスクリプトが死ぬ」ので分かりにくい。
  ["環境に張り付いた絶対パス", "node", ["scripts/check-portability.mjs"]],
  // 危険なコマンドが復活していないか。**README を直してもコードに残ります。**
  // とくに CLI のエラーメッセージは、詰まっている人が一番信じる場所です。
  ["書いてはいけない文字列", "node", ["scripts/check-forbidden.mjs"]],
  /* 英語版と日本語版で、打てば動くもの（コマンド・URL）がずれていないか。
     **ずれるのは英語版が古くなる方向です。** 書いている人が日本語話者なので。
     そして英語版は、外から来た人が最初に読む面です。 */
  ["英語版と日本語版がずれていない", "node", ["scripts/check-translations.mjs"]],
  /* カタログの訳し漏れ。**訳が無い文字列は日本語のまま出ます。**
     壊れて見えないぶん、日本語で見ている限り永久に気づけません。 */
  ["カタログの訳し漏れ", "node", ["scripts/check-catalog-lang.mjs"]],
  /* 余白トークンのクラスが本当に定義されているか。**書き忘れると 0px になり、
     エラーは 1 つも出ません。** 目視では「少し詰まっている」としか見えず、
     v0.9c では配っている site-footer.tsx の中に 2 件残っていました。 */
  ["余白のクラスが定義されている", "node", ["scripts/check-space-utilities.mjs"]],
  /* 宣言した依存が本当に npm から取れるか。**手元の node_modules を見ません。**
     外部レビューで「astro の版が存在しない」と公開停止の判定を受けたとき、
     誤報だったにも関わらず**こちらは機械で否定できませんでした。**
     気づくのは、まっさらな環境の利用者が install で止まったときです。 */
  ["生成物の依存が registry で解決できる", "node", ["scripts/check-scaffold-deps.mjs"]],
  // 純粋な関数の単体検査。ブラウザを立てないので速く、
  // `&` ひとつでフィードが壊れる類の間違いはここでしか捕まえられません。
  ["単体: SEO / フィードの組み立て", "node", ["scripts/verify-seo-unit.mjs"]],
  /* 契約の単体検査。**画面を見ても分からないもの**を見ます。
     サーバの文言が漏れていても画面には何か出ますし、既定値が上書き
     されても送信そのものは成功します。実ブラウザでは出てきません。 */
  ["単体: エラー文言 / 既定値 / accept", "node", ["scripts/verify-action-unit.mjs"]],
  ["単体: validation 結果契約", "node", ["scripts/verify-validation-unit.mjs"]],
  ["単体: useResource の query key", "node", ["scripts/verify-resource-key-unit.mjs"]],
  /* 公開後 smoke は CDN の単発 503 を再試行しますが、404 や継続障害を
     成功にはしません。その境界を network に出ず単体で固定します。 */
  ["単体: 公開物取得の一時障害", "node", ["scripts/verify-fetch-with-retry.mjs"]],
  ["単体: checker / CI の協調", "node", ["scripts/verify-checker-coordination.mjs"]],
  ["単体: check harness", "node", ["scripts/verify-check-harness.mjs"]],
  ["単体: release ancestry / Pages smoke policy", "node", ["scripts/verify-release-policy.mjs"]],
  /* 受け口。**「403 が返った」ではなく「メールが 0 回だった」を見ます。**
     応答を読めなくても、副作用はサーバで起きているためです。 */
  ["単体: 受け口の入口", "node", ["scripts/verify-receiver-unit.mjs"]],
  // 入口。生成物を install / build するところまでは重いので
  // `pnpm verify:create` に分けています（ここは生成と検証だけ）。
  ["入口: create-nasu-stack", "node", ["scripts/verify-create.mjs"]],
]);

/* dogfoodは外部APIへ出ず、app自身の固定fixtureとChromiumで検査します。
   copy-owned source、独立package、公開設定の失敗画面まで実利用側で通します。 */
await step(
  "dogfood: Repository Pulse",
  "pnpm",
  ["--filter", "dogfood-repository-pulse", "verify"],
);
await step(
  "dogfood: Weather Planner",
  "pnpm",
  ["--filter", "dogfood-weather-planner", "verify"],
);

/* ---- 群 2: レジストリを作ってから ---------------------------------- */
// 下の 3 つは public/r を読むので、生成が先です。ここだけ直列。
await step("レジストリ生成", "node", ["scripts/build-registry.mjs"]);

await group([
  ["配布の依存漏れ", "node", ["scripts/check-registry-deps.mjs"]],
  ["利用者プロジェクトへ展開して型検査", "node", ["scripts/verify-install.mjs"]],
  // 上は「CLI と同じ解決規則の再現」です。再現である以上、こちらの
  // 思い込みがそのまま検査に入ります。**本物の CLI も通します。**
  // ネットワークが無い環境では、理由を印字して明示的に飛ばします。
  ["本物の shadcn CLI で入れる", "node", ["scripts/verify-install-real.mjs"]],
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

/* 実ブラウザの工程。**それぞれが独立して Chromium を立てます。**
   同時に走らせますが、上限は LANES（CI の runner は 2 コア）です。
   無制限に並べると、切り替えのほうが重くなって遅くなります。

   ここは配信済みのサーバを読むだけで、互いに書き換えません。
   verify-submit だけは自前の受け口を 4399 に立てますが、
   他はそのポートを使わないので衝突しません。 */
const browserSteps = [
  ["実ブラウザ: 非同期の状態", "node", ["scripts/verify-states.mjs"]],
  ["実ブラウザ: レイアウトと通知", "node", ["scripts/verify-layout.mjs"]],
  ["実ブラウザ: テーマの配色と選択操作", "node", ["scripts/verify-theme-accessibility.mjs"]],
  ["実ブラウザ: 壊しにくる中身", "node", ["scripts/audit-stress.mjs"]],
  ["実ブラウザ: 部品 (v0.4)", "node", ["scripts/verify-parts.mjs"]],
  ["実ブラウザ: 入力/選択/楽観更新 (v0.5)", "node", ["scripts/verify-forms.mjs"]],
  ["実ブラウザ: ナビ/開閉/本文/画像 (v0.6)", "node", ["scripts/verify-nav.mjs"]],
  ["実ブラウザ: SEO / ブログ / フィード (v0.7)", "node", ["scripts/verify-seo.mjs"]],
  // 受け口サーバを立てて、本物の HTTP を飛ばして測ります
  ["実ブラウザ: フォームの送信先 (v0.8)", "node", ["scripts/verify-submit.mjs"]],
];

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
    const response = await fetch("http://127.0.0.1:4321/sitemap.xml");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""))
      .filter(Boolean);
    if (paths.length === 0) {
      return { pages: fallback, ok: false, why: "sitemap.xml にURLがありません" };
    }
    return {
      pages: paths.map((p) => `http://127.0.0.1:4321${p}`),
      ok: true,
      why: `${paths.length}ページ`,
    };
  } catch (e) {
    return { pages: fallback, ok: false, why: String(e).slice(0, 120) };
  }
}
const discoveredSitePages = await sitePages();
report({
  name: "Astro sitemapから検査対象を取得",
  ok: discoveredSitePages.ok,
  out: discoveredSitePages.why,
});
const SITE_PAGES = discoveredSitePages.pages;
process.stdout.write(`
（Astro サイトの検査対象: ${SITE_PAGES.length} ページ）
`);

await group([
  ...browserSteps,
  /* **両方の言語で測ります。** 1 行の長さの閾値は和文と欧文で違い、
     折り返す位置も変わります。カタログの既定は英語なので、
     日本語だけ測っていると「見に来た人が最初に見る画面」を見ていません。 */
  ["実ブラウザ: 端末幅の崩れ", "node", [
    "registry/nasu/scripts/check-responsive.mjs",
    ...PLAYGROUND_TABS.map((t) => `http://127.0.0.1:4173/?tab=${t}`),
    ...PLAYGROUND_TABS.map((t) => `http://127.0.0.1:4173/?tab=${t}&lang=ja`),
    ...SITE_PAGES,
  ]],
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
