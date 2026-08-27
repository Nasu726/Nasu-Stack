/**
 * 純粋な関数（seo.ts / feed.ts）の単体検査。
 *
 *   node scripts/verify-seo-unit.mjs
 *
 * ブラウザを立てずに走るので速く、**エスケープの確認に向いています。**
 * `&` ひとつでフィードが壊れる類の間違いは、実ブラウザで見ても気づけません。
 *
 * TypeScript のまま import できないので、tsc で一度 JS に落としてから読みます。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCheckHarness } from "./_check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".verify-seo");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// tsc で JS に落とします。process.execPath 経由で呼ぶので、
// OS によるコマンド名の違い（tsc / tsc.cmd）を踏みません。
/* seo.ts が `@/lib/inline-script` を import するので、
   alias を持った tsconfig を一時的に作って渡します
   （コマンドラインの引数では paths を渡せません）。 */
const tsconfig = path.join(out, "tsconfig.json");
fs.writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      outDir: ".",
      rootDir: path.join(root, "registry", "nasu"),
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
      skipLibCheck: true,
      baseUrl: path.join(root, "registry", "nasu"),
      paths: { "@/*": ["./*"] },
      types: [],
      lib: ["es2022", "dom"],
    },
    files: [
      path.join(root, "registry", "nasu", "lib", "seo.ts"),
      path.join(root, "registry", "nasu", "lib", "feed.ts"),
      path.join(root, "registry", "nasu", "lib", "inline-script.ts"),
    ],
  }),
);
execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
  { stdio: "inherit", cwd: root },
);

/* tsc は alias を出力に書き写すだけで、解決はしません。 */
for (const f of fs.readdirSync(path.join(out, "lib"))) {
  if (!f.endsWith(".js")) continue;
  const jsPath = path.join(out, "lib", f);
  const src = fs.readFileSync(jsPath, "utf8");
  fs.writeFileSync(
    jsPath,
    src.replace(/from "@\/lib\/([^"]+)"/g, (_, n) => 'from "./' + n + '.js"'),
  );
}

// .js を ESM として読ませるため、package.json を置きます
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const { buildMeta, absoluteUrl } = await import(
  pathToFileURL(path.join(out, "lib", "seo.js")).href
);
const { buildSitemap, buildRss, buildRobots, escapeXml } = await import(
  pathToFileURL(path.join(out, "lib", "feed.js")).href
);

/* ================================================================ */

const { must, report } = createCheckHarness();
const attrOf = (tags, key, value) =>
  tags.find((t) => t.attrs[key] === value)?.attrs.content ??
  tags.find((t) => t.attrs[key] === value)?.attrs.href;

const SITE = "https://example.com";

/* ===== absoluteUrl ============================================== */
must("相対パスを絶対 URL に直す", absoluteUrl(SITE, "/a") === `${SITE}/a`, absoluteUrl(SITE, "/a"));
must(
  "先頭のスラッシュが無くても直す",
  absoluteUrl(SITE, "a") === `${SITE}/a`,
  absoluteUrl(SITE, "a"),
);
must(
  "末尾のスラッシュが重なっても // にならない",
  absoluteUrl("https://example.com/", "/a") === `${SITE}/a`,
  absoluteUrl("https://example.com/", "/a"),
);
must(
  "すでに絶対 URL ならそのまま",
  absoluteUrl(SITE, "https://other.test/x") === "https://other.test/x",
);

/* ===== buildMeta ================================================ */
const meta = buildMeta({
  title: "はじめての記事",
  siteName: "Studio Nasu",
  description: "説明文です",
  site: SITE,
  path: "/blog/hello",
  image: "/og/hello.png",
  imageAlt: "サムネイル",
  type: "article",
  publishedAt: "2026-08-01",
  author: "なす",
});

must(
  "title に「記事名 | サイト名」が入る",
  meta.find((t) => t.tag === "title")?.children === "はじめての記事 | Studio Nasu",
  meta.find((t) => t.tag === "title")?.children,
);
must(
  "canonical が絶対 URL",
  attrOf(meta, "rel", "canonical") === `${SITE}/blog/hello`,
  attrOf(meta, "rel", "canonical"),
);
// 相対のまま出すと SNS 側が解決できず、画像なしで表示されます
must(
  "og:image が絶対 URL に直る",
  attrOf(meta, "property", "og:image") === `${SITE}/og/hello.png`,
  attrOf(meta, "property", "og:image"),
);
must(
  "画像があるとき twitter:card は summary_large_image",
  attrOf(meta, "name", "twitter:card") === "summary_large_image",
);
must(
  "画像が無いときは summary に落ちる",
  attrOf(
    buildMeta({ title: "x", site: SITE }),
    "name",
    "twitter:card",
  ) === "summary",
);
must(
  "記事なら article:published_time が入る",
  attrOf(meta, "property", "article:published_time") === "2026-08-01",
);

const ld = meta.find((t) => t.tag === "script");
let parsed = null;
try {
  parsed = JSON.parse(ld?.children ?? "");
} catch {
  /* 落ちたら下の判定で拾う */
}
must("JSON-LD が JSON として読める", parsed !== null);
must("JSON-LD の @type が Article", parsed?.["@type"] === "Article", parsed?.["@type"]);
must("JSON-LD に headline がある", !!parsed?.headline, parsed?.headline);
must("JSON-LD の image が絶対 URL", parsed?.image === `${SITE}/og/hello.png`);
must(
  "値の無い項目を JSON-LD に入れない",
  Object.values(parsed ?? {}).every((v) => v !== undefined && v !== ""),
);
// `</script>` が入ると、そこでスクリプトが終わって残りが本文として出ます
const evil = buildMeta({
  title: "危険な</script><img src=x>タイトル",
  site: SITE,
  type: "article",
});
const evilLd = evil.find((t) => t.tag === "script")?.children ?? "";
must(
  "JSON-LD の中で < を逃がしている（</script> で閉じない）",
  !evilLd.includes("</script>") && evilLd.includes("\\u003c"),
  evilLd.slice(0, 60),
);
must(
  "逃がしても JSON として読める",
  (() => {
    try {
      return JSON.parse(evilLd).headline.includes("</script>");
    } catch {
      return false;
    }
  })(),
);

must(
  "サイト名と題名が同じときは重ねない",
  buildMeta({ title: "Studio Nasu", siteName: "Studio Nasu", site: SITE }).find(
    (t) => t.tag === "title",
  )?.children === "Studio Nasu",
);
must(
  "noindex を指定したら robots に出る",
  attrOf(buildMeta({ title: "x", site: SITE, noindex: true }), "name", "robots") ===
    "noindex, nofollow",
);

/* ===== escapeXml ================================================ */
must("& を実体参照にする", escapeXml("Q&A") === "Q&amp;A", escapeXml("Q&A"));
must(
  "< > を実体参照にする",
  escapeXml("<div>") === "&lt;div&gt;",
  escapeXml("<div>"),
);
// & を後に処理すると &lt; が &amp;lt; になります。順番が要点です。
must(
  "二重に置換しない（& を最初に処理している）",
  escapeXml("a<b&c") === "a&lt;b&amp;c",
  escapeXml("a<b&c"),
);

/* ===== buildSitemap ============================================= */
const sitemap = buildSitemap(SITE, [
  { path: "/", lastmod: "2026-08-01", priority: 1 },
  { path: "/blog/q&a", lastmod: new Date("2026-07-01") },
]);
must("sitemap が XML 宣言で始まる", sitemap.startsWith('<?xml version="1.0"'));
must("sitemap の loc が絶対 URL", sitemap.includes(`<loc>${SITE}/</loc>`));
must(
  "sitemap の URL がエスケープされる",
  sitemap.includes("q&amp;a") && !/[^&]&(?!amp;|lt;|gt;|quot;|apos;)/.test(sitemap),
  sitemap.match(/<loc>[^<]*q[^<]*<\/loc>/)?.[0],
);
must("lastmod が YYYY-MM-DD に揃う", /<lastmod>2026-07-01<\/lastmod>/.test(sitemap));
must("priority が 1 桁の小数になる", /<priority>1\.0<\/priority>/.test(sitemap));

/* ===== buildRss ================================================= */
const rss = buildRss({
  site: SITE,
  title: "Studio Nasu & Co.",
  description: "説明 <strong>です</strong>",
  items: [
    {
      title: "Q&A: <div> の使い方",
      path: "/blog/qa",
      description: "本文に & や < が入っています",
      date: "2026-08-01T00:00:00Z",
      author: "なす",
    },
  ],
});
must("rss が XML 宣言で始まる", rss.startsWith('<?xml version="1.0"'));
must(
  "チャンネル名の & がエスケープされる",
  rss.includes("Studio Nasu &amp; Co."),
);
must(
  "記事名の & と < がエスケープされる",
  rss.includes("Q&amp;A: &lt;div&gt; の使い方"),
);
must(
  "エスケープ漏れが 1 つも無い",
  !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(rss),
  (rss.match(/&(?!amp;|lt;|gt;|quot;|apos;)./g) ?? []).join(" "),
);
// ISO のまま入れると読み飛ばすリーダーがあります
must(
  "pubDate が RFC 822 形式",
  /<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} .+GMT<\/pubDate>/.test(rss),
  rss.match(/<pubDate>[^<]*<\/pubDate>/)?.[0],
);
must("guid がリンクと同じ（重複表示を防ぐ）", rss.includes('<guid isPermaLink="true">'));
must("atom:link で自分自身を指す", rss.includes('rel="self"'));

/* ===== buildRobots ============================================== */
const robots = buildRobots(SITE);
must("robots が sitemap を指す", robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
must(
  "robots に Disallow を足せる",
  buildRobots(SITE, { disallow: ["/draft/"] }).includes("Disallow: /draft/"),
);

/* ================================================================ */

fs.rmSync(out, { recursive: true, force: true });

process.exit(report().ok ? 0 : 1);
