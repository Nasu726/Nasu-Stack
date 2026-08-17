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
 *   public/create-webtemplate.tgz   入口の CLI（npm レジストリには置きません）
 *   public/create-webtemplate.tgz.sha256
 *   public/404.html                 存在しない URL のときに出るページ
 *   public/index.html               入口の案内（v0.9b でドキュメントサイトに差し替え）
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pnpm } from "./_proc.mjs";
import { PUBLIC_BASE, REGISTRY_URL, TARBALL_URL } from "./_site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const cli = path.join(root, "packages", "create-webtemplate");

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
 * `npx https://…/create-webtemplate.tgz my-site` が成立します。
 * npm アカウントという攻撃面が増えず、名前の取り合いにも巻き込まれません。
 */
// template/ は生成物です（commit していません）。pack の前に必ず作ります。
run([path.join(root, "scripts/build-create-template.mjs")]);

// npm ではなく pnpm で pack します。**`npm.cmd` を呼ぶと同じ穴に落ちるため**
// （Windows でバッチを spawn する話。理由は scripts/_proc.mjs に書きました）。
//
// `--pack-destination` は使いません。**引数にパスを載せないためです。**
// 退路（PATH の pnpm を shell 経由で呼ぶ経路）では引数がエスケープされないので、
// リポジトリの置き場に空白が入っているだけで壊れます
// （`C:\Users\John Doe\...` は珍しくありません）。
// 出た場所から移すほうが、渡す文字列が 1 つも増えません。
const pack = pnpm(["pack"]);
const packed = execFileSync(pack.cmd, pack.args, {
  cwd: cli,
  encoding: "utf8",
  ...pack.options,
})
  .trim()
  .split(/\r?\n/)
  .pop()
  .trim();

/* 版を含まない名前に揃えます。README に載る URL が版ごとに変わると、
   案内を直し忘れた瞬間に「動かない URL」が残るためです。
   版は tarball の中の package.json にあります。 */
const tgz = path.join(pub, "create-webtemplate.tgz");
// pnpm pack は絶対パスを印字します（npm はファイル名だけ）。
// resolve なら、どちらが返ってきても正しい 1 か所を指します。
fs.mkdirSync(pub, { recursive: true });
fs.renameSync(path.resolve(cli, packed), tgz);

/**
 * 利用者が打つ前に照合できるように、ハッシュを並べて置きます。
 *
 * **これは「誰が作ったか」を示しません。** 示せるのは
 * 「取れたものが、こちらが出したものと同じか」だけです。
 * それでも、経路の途中で差し替えられていないことは確かめられます。
 */
const sha = createHash("sha256").update(fs.readFileSync(tgz)).digest("hex");
fs.writeFileSync(`${tgz}.sha256`, `${sha}  create-webtemplate.tgz\n`, "utf8");
log(`入口: create-webtemplate.tgz (${(fs.statSync(tgz).size / 1024) | 0} KB)`);
log(`sha256: ${sha}`);

/* --- 3. ページ ------------------------------------------------------ */
const items = JSON.parse(
  fs.readFileSync(path.join(pub, "r", "index.json"), "utf8"),
).items;

/** 静的ホスティングに置くだけなので、外部への参照を持たない 1 枚にします。 */
const page = (title, body) => `<!doctype html>
<html lang="ja">
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
    "WebTemplate",
    `<h1>WebTemplate</h1>
<p>Web サイトを作るときに毎回同じところで手間がかかる部分を、部品側で引き受ける土台です。</p>

<h2>新しく作る</h2>
<pre><code>npx ${TARBALL_URL} my-site</code></pre>
<p><a href="./create-webtemplate.tgz.sha256">SHA-256</a> を並べて置いてあります。打つ前に照合できます。</p>
<p>できたプロジェクトには <code>components.json</code> が入っているので、部品はそのまま足せます。</p>

<h2>いまあるプロジェクトに部品だけ入れる</h2>
<p>先に <code>components.json</code> へ 1 行足してください。これが無いと部品の依存を辿れません。</p>
<pre><code>{ "registries": { "@nasu": "${REGISTRY_URL}" } }</code></pre>
<pre><code>npx shadcn@${SHADCN} add @nasu/action-button</code></pre>

<h2>配っている部品（${items.length}）</h2>
<ul>
${items.map((i) => `  <li><a href="./r/${i.name}.json"><code>${i.name}</code></a> — ${i.title}</li>`).join("\n")}
</ul>

<p><a href="https://github.com/Nasu726/WebTemplate">GitHub</a></p>`,
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
    "見つかりませんでした — WebTemplate",
    `<h1>見つかりませんでした</h1>
<p>その URL には何もありません。</p>
<p><a href="${new URL(PUBLIC_BASE).pathname}/">入口へ戻る</a></p>`,
  ),
  "utf8",
);

log(`ページ: index.html / 404.html（部品 ${items.length} 件）`);
console.log(`✅ public/ を組み立てました`);
