/**
 * 公開する `public/` を組み立てます。
 *
 *   node scripts/build-pages.mjs
 *
 * ----------------------------------------------------------------
 * なぜ YAML ではなくスクリプトなのか
 * ----------------------------------------------------------------
 * ワークフローに手順を並べると、**手元で同じものを作れません。**
 * 「CI でだけ壊れる」「CI でだけ直る」が起きて、確かめる手段が
 * push しかなくなります。組み立てはここに置き、CI はこれを呼ぶだけにします。
 *
 * ----------------------------------------------------------------
 * 出るもの
 * ----------------------------------------------------------------
 *   public/r/<name>.json            shadcn CLI が読むレジストリ
 *   public/r/index.json             一覧
 *   public/create-nasu-stack.tgz   入口の CLI（npm レジストリには置きません）
 *   public/create-nasu-stack.tgz.sha256
 *   public/404.html                 存在しない URL のときに出るページ
 *   public/index.html               入口の案内（v0.9b でドキュメントサイトに差し替え）
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pnpm } from "./_proc.mjs";
import { packCreateNasuStack } from "./_pack-create.mjs";
import { PUBLIC_BASE, REGISTRY_URL, TARBALL_URL } from "./_site.mjs";
import { REPO } from "./_deps.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");

/** 検証済みの shadcn の版。最新版は案内しません（理由は build-create-template.mjs）。 */
const SHADCN = (
  JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
    .devDependencies?.shadcn ?? ""
).replace(/^[\^~]/, "");

const run = (args, cwd = root) =>
  execFileSync(process.execPath, args, { cwd, stdio: "inherit" });
const log = (...a) => console.log("·", ...a);

/* --- 1. レジストリ ------------------------------------------------- */
// public/r/ を消してから書き直します（build-registry.mjs の中でやっています）
run([path.join(root, "scripts/build-registry.mjs")]);

/* --- 2. 入口の CLI を tarball にする -------------------------------- */
/**
 * **npm には publish しません。** 個人的なプロジェクトとして続けるので、
 * 継続的な保守を約束できないためです。理由と代償は docs/security.md に。
 *
 * npm は URL の tarball をそのまま受け取れるので、
 * `npx https://…/create-nasu-stack.tgz my-site` が成立します。
 * npm アカウントという攻撃面が増えず、名前の取り合いにも巻き込まれません。
 */
/* 版を含まない名前に揃えます。README に載る URL が版ごとに変わると、
   案内を直し忘れた瞬間に「動かない URL」が残るためです。
   版は tarball の中の package.json にあります。 */
const packed = packCreateNasuStack({
  destination: pub,
  filename: "create-nasu-stack.tgz",
});
log(`入口: create-nasu-stack.tgz (${(packed.size / 1024) | 0} KB)`);
log(`sha256: ${packed.sha256}`);

/* --- 3. カタログとデモ ---------------------------------------------
 * ----------------------------------------------------------------
 * **v0.9a まで、どちらも一度も公開されていませんでした。**
 * 公開されていたのはレジストリの JSON と tarball とリンク一覧だけで、
 * 利用者は「何がもらえるのか」を打つ前に判断できませんでした。
 *
 * サブパス配信なので `base` を渡してビルドし直します。
 * `base` が合っていないと HTML は出るのに JS と CSS が 404 になり、
 * **真っ白な画面**になります（deploy 自体は成功するので気づきにくい）。
 * ---------------------------------------------------------------- */
const basePath = new URL(PUBLIC_BASE).pathname.replace(/\/$/, "");

function buildApp(filter, dir, dest, extraEnv) {
  const b = pnpm(["--filter", filter, "build"]);
  execFileSync(b.cmd, b.args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    ...b.options,
  });
  fs.cpSync(path.join(root, dir), path.join(pub, dest), { recursive: true });
  log(`${dest}/ … ${filter} を base=${extraEnv.PUBLIC_BASE} で組み立てました`);
}

buildApp("playground", "apps/playground/dist", "catalog", {
  PUBLIC_BASE: `${basePath}/catalog/`,
});
buildApp("site", "apps/site/dist", "demo", {
  PUBLIC_BASE: `${basePath}/demo/`,
  /* 絶対 URL（canonical / OGP / sitemap）の起点。**origin だけ**を渡します。
     下の階層は base の担当で、`Astro.url.pathname` に既に含まれています。
     ここに base 込みの URL を渡すと canonical が
     `…/Nasu Stack/Nasu Stack/demo/` のように二重になります（実際なりました）。 */
  PUBLIC_SITE: new URL(PUBLIC_BASE).origin,
});

/* --- 4. ページ ------------------------------------------------------ */
const items = JSON.parse(
  fs.readFileSync(path.join(pub, "r", "index.json"), "utf8"),
).items;

/**
 * 静的ホスティングに置くだけなので、外部への参照を持たない 1 枚にします。
 *
 * `lang` は本文と揃えます。**読み上げの発音がここで決まる**ので、
 * 英語の本文に lang="ja" が付いていると日本語として読まれます。
 */
const page = (title, body, lang = "en") => `<!doctype html>
<html lang="${lang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2rem 1.25rem; max-width: 42rem;
    font-family: system-ui, sans-serif; line-height: 1.7;
  }
  code, pre { font-family: ui-monospace, monospace; font-size: 0.95em; }
  pre { overflow-x: auto; padding: 0.75rem 1rem; border-radius: 6px;
        background: color-mix(in srgb, currentColor 8%, transparent); }
  a { color: inherit; }
  ul { padding-left: 1.2rem; }
  li { margin: 0.15rem 0; }
</style>
${body}
</html>
`;

fs.writeFileSync(
  path.join(pub, "index.html"),
  page(
    "Nasu Stack",
    `<h1>Nasu Stack</h1>
<p><b>Spacing you don't have to decide. State you don't have to write.</b></p>
<p>Components and starter templates for React and Astro. They take over the two
things beginners reliably get stuck on: layout and async state.</p>

<h2>Start a new project</h2>
<pre><code>npx ${TARBALL_URL} my-site</code></pre>
<p>The <a href="./create-nasu-stack.tgz.sha256">SHA-256</a> is published next to it, so you can verify before you run it.</p>

<h2>Add components to an existing project</h2>
<p>No configuration needed — dependencies come along automatically.</p>
<pre><code>npx shadcn@${SHADCN} add ${REPO}/action-button</code></pre>
<p>Prefer the short <code>@nasu/…</code> form? Register the namespace once:</p>
<pre><code>npx shadcn@${SHADCN} registry add "@nasu=${REGISTRY_URL}"</code></pre>

<h2>Look around</h2>
<ul>
  <li><a href="./catalog/">Component catalog</a> — every component, live</li>
  <li><a href="./demo/">Demo site</a> — a site built from them (blog, landing page, contact)</li>
</ul>

<h2>Components (${items.length})</h2>
<ul>
${items.map((i) => `  <li><a href="./r/${i.name}.json"><code>${i.name}</code></a> — ${i.title}</li>`).join("\n")}
</ul>

<p><a href="https://github.com/Nasu726/Nasu-Stack">GitHub</a> ・
<a href="https://github.com/Nasu726/Nasu-Stack/blob/main/README.ja.md">日本語版の README</a></p>`,
  ),
  "utf8",
);

/**
 * 404。**ステータスが本当に 404 になるかは、ホスティング次第です。**
 * 置いても 200 で返すところがあります（そうなると検索エンジンが
 * 存在しないページを登録します）。公開後に実測して記録してください。
 */
fs.writeFileSync(
  path.join(pub, "404.html"),
  page(
    "Not found — Nasu Stack",
    `<h1>Not found</h1>
<p>There is nothing at that URL.</p>
<p><a href="${new URL(PUBLIC_BASE).pathname}/">Back to the start</a></p>`,
  ),
  "utf8",
);

log(`ページ: index.html / 404.html（部品 ${items.length} 件）`);
console.log(`✅ public/ を組み立てました`);
