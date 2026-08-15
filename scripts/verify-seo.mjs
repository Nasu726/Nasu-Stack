/**
 * v0.7 前半の検証。docs/plan-v07.md の「実測で確かめる項目」に対応します。
 *
 * XML と robots.txt はブラウザを使わず fetch で取ります。
 * HTML のページだけ実ブラウザで見ます（本文の行長やレイアウトシフトは
 * 実際に描画しないと分かりません）。
 */
import { chromium } from "playwright";

const SITE_BASE = process.env.SITE_URL || "http://127.0.0.1:4321";
/** ページの中身が指す先。ビルド時に astro.config の site が使われます。 */
const PUBLIC_ORIGIN = "https://example.com";

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}
const log = (...a) => console.log("·", ...a);

const text = async (path) => {
  const r = await fetch(SITE_BASE + path);
  return { status: r.status, body: await r.text() };
};

/* ================================================================
 * 1. XML と robots（ブラウザ不要）
 * ============================================================== */

const sitemap = await text("/sitemap.xml");
const rss = await text("/rss.xml");
const robots = await text("/robots.txt");

must("sitemap.xml が配信される", sitemap.status === 200, `status ${sitemap.status}`);
must("rss.xml が配信される", rss.status === 200, `status ${rss.status}`);
must("robots.txt が配信される", robots.status === 200, `status ${robots.status}`);

/** XML として整形式か、ブラウザの DOMParser で確かめます。 */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(SITE_BASE + "/", { waitUntil: "networkidle" });

const parseXml = (xml) =>
  page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(src, "application/xml");
    const err = doc.querySelector("parsererror");
    return {
      ok: !err,
      error: err?.textContent?.slice(0, 120) ?? null,
      locs: [...doc.querySelectorAll("loc")].map((n) => n.textContent),
      titles: [...doc.querySelectorAll("item > title")].map((n) => n.textContent),
      links: [...doc.querySelectorAll("item > link")].map((n) => n.textContent),
    };
  }, xml);

const sm = await parseXml(sitemap.body);
must("sitemap が XML として整形式", sm.ok, sm.error ?? "");
must(
  "sitemap の loc が全部絶対 URL",
  sm.locs.length > 0 && sm.locs.every((u) => u.startsWith(PUBLIC_ORIGIN)),
  `${sm.locs.length} 件`,
);
log("sitemap:", JSON.stringify(sm.locs));

const rs = await parseXml(rss.body);
must("rss が XML として整形式", rs.ok, rs.error ?? "");
must("rss に記事が入っている", rs.titles.length > 0, `${rs.titles.length} 件`);
// & や < を素で出すと、この判定だけでなく上の「整形式」も落ちます
must(
  "題名の & と < がそのまま読める（エスケープが正しい）",
  rs.titles.some((t) => t.includes("Q&A") && t.includes("<div>")),
  JSON.stringify(rs.titles),
);
must(
  "rss の link が絶対 URL",
  rs.links.every((u) => u.startsWith(PUBLIC_ORIGIN)),
  JSON.stringify(rs.links),
);

must(
  "robots.txt が sitemap の場所を指す",
  robots.body.includes(`Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`),
  robots.body.trim().split("\n").at(-1),
);

/* ================================================================
 * 2. 下書きが 3 か所すべてから外れているか
 * ============================================================== */

const DRAFT_MARK = "書きかけのメモ";
const listing = await text("/blog/");
const draftPage = await text("/blog/draft-note/");

must("下書きが sitemap に出ない", !sitemap.body.includes("draft-note"));
must("下書きが RSS に出ない", !rss.body.includes(DRAFT_MARK));
must("下書きが一覧に出ない", !listing.body.includes(DRAFT_MARK));
// 一覧から消えていてもページが残っていたら、URL を知っている人には読めます
must(
  "下書きのページ自体が生成されない",
  draftPage.status === 404,
  `status ${draftPage.status}`,
);

/* ================================================================
 * 3. 各ページのメタ情報
 * ============================================================== */

const PAGES = [
  "/",
  "/lp/",
  "/about/",
  "/contact/",
  "/blog/",
  "/blog/hello/",
  "/blog/qa/",
  "/404.html",
];
const metas = [];

for (const path of PAGES) {
  await page.goto(SITE_BASE + path, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const get = (sel, attr = "content") =>
      document.querySelector(sel)?.getAttribute(attr) ?? null;
    const ldNode = document.querySelector('script[type="application/ld+json"]');
    let ld = null;
    let ldOk = false;
    try {
      ld = JSON.parse(ldNode?.textContent ?? "");
      ldOk = true;
    } catch {
      ldOk = false;
    }
    return {
      title: document.title,
      description: get('meta[name="description"]'),
      canonical: get('link[rel="canonical"]', "href"),
      ogImage: get('meta[property="og:image"]'),
      ogType: get('meta[property="og:type"]'),
      twitterCard: get('meta[name="twitter:card"]'),
      robots: get('meta[name="robots"]'),
      ldOk,
      ldType: ld?.["@type"] ?? null,
      rssLink: get('link[rel="alternate"][type="application/rss+xml"]', "href"),
    };
  });
  metas.push({ path, ...m });
}

const titles = metas.map((m) => m.title);
must(
  "すべてのページの title が一意",
  new Set(titles).size === titles.length,
  JSON.stringify(titles),
);
must(
  "canonical が全ページ絶対 URL",
  metas.every((m) => (m.canonical ?? "").startsWith(PUBLIC_ORIGIN)),
  JSON.stringify(metas.map((m) => m.canonical)),
);
must(
  "og:image が全ページ絶対 URL",
  metas.every((m) => (m.ogImage ?? "").startsWith(PUBLIC_ORIGIN)),
  JSON.stringify([...new Set(metas.map((m) => m.ogImage))]),
);
must(
  "description が全ページに入っている",
  metas.every((m) => (m.description ?? "").length > 0),
);
must("JSON-LD が全ページで JSON として読める", metas.every((m) => m.ldOk));
must(
  "記事ページの @type が Article、それ以外は WebSite",
  metas.every((m) =>
    m.path.startsWith("/blog/hello") || m.path.startsWith("/blog/qa")
      ? m.ldType === "Article"
      : m.ldType === "WebSite",
  ),
  JSON.stringify(metas.map((m) => `${m.path}:${m.ldType}`)),
);
must(
  "og:type が記事だけ article",
  metas.every((m) =>
    m.path.startsWith("/blog/hello") || m.path.startsWith("/blog/qa")
      ? m.ogType === "article"
      : m.ogType === "website",
  ),
);
must(
  "404 ページは検索結果に出さない（noindex）",
  metas.find((m) => m.path === "/404.html")?.robots === "noindex, nofollow",
);
must(
  "RSS の場所を全ページから辿れる",
  metas.every((m) => (m.rssLink ?? "").includes("rss.xml")),
);

/* ================================================================
 * 4. 記事ページの中身
 * ============================================================== */

await page.goto(SITE_BASE + "/blog/hello/", { waitUntil: "networkidle" });

const article = await page.evaluate(() => {
  const prose = document.querySelector(".wt-prose");
  const p = prose?.querySelector("p");
  const h2 = prose?.querySelector("h2");
  const time = document.querySelector("time");
  const fs = p ? parseFloat(getComputedStyle(p).fontSize) : 0;
  return {
    proseがある: !!prose,
    本文の幅em: p && fs ? Math.round(p.getBoundingClientRect().width / fs) : 0,
    見出しのscrollMargin: h2 ? getComputedStyle(h2).scrollMarginTop : null,
    timeのdatetime: time?.getAttribute("datetime") ?? null,
    timeの文字: time?.textContent?.trim() ?? null,
    見出しの数: prose?.querySelectorAll("h2, h3").length ?? 0,
    場所を取らない画像: [...(prose?.querySelectorAll("img") ?? [])].filter((img) => {
      const cs = getComputedStyle(img);
      const parent = img.parentElement && getComputedStyle(img.parentElement);
      return (
        cs.aspectRatio === "auto" &&
        parent?.aspectRatio === "auto" &&
        !(img.hasAttribute("width") && img.hasAttribute("height"))
      );
    }).length,
  };
});

must("記事本文が prose で描かれている", article.proseがある);
// 和文は 45em（≒45 字）まで。これを超えると視線の戻りが長くて読みにくくなります
must(
  "本文の 1 行が 45em 以下",
  article.本文の幅em > 0 && article.本文の幅em <= 45,
  `${article.本文の幅em}em`,
);
must(
  "見出しが sticky ヘッダに潜らない（scroll-margin がある）",
  parseFloat(article.見出しのscrollMargin ?? "0") > 0,
  article.見出しのscrollMargin,
);
must(
  "日付が <time datetime> で出ている",
  /^\d{4}-\d{2}-\d{2}$/.test(article.timeのdatetime ?? ""),
  `${article.timeのdatetime} / ${article.timeの文字}`,
);
must("記事に見出しがある", article.見出しの数 > 0, `${article.見出しの数} 個`);
must(
  "記事内に場所を取っていない画像が無い",
  article.場所を取らない画像 === 0,
  `${article.場所を取らない画像} 件`,
);

/* --- アンカーで飛んだとき、見出しがヘッダに隠れないか --- */
const headingId = await page.evaluate(() => {
  const h = document.querySelector(".wt-prose h2");
  if (!h) return null;
  if (!h.id) h.id = "probe-heading";
  return h.id;
});
if (headingId) {
  await page.goto(`${SITE_BASE}/blog/hello/#${headingId}`, {
    waitUntil: "networkidle",
  });
  const hidden = await page.evaluate((id) => {
    const h = document.getElementById(id) ?? document.querySelector(".wt-prose h2");
    const header = document.querySelector("header");
    if (!h || !header) return null;
    return Math.round(header.getBoundingClientRect().bottom - h.getBoundingClientRect().top);
  }, headingId);
  log("アンカーで飛んだときの隠れ量:", `${hidden}px（0 以下なら隠れていない）`);
}

/* ================================================================
 * 4.5 雛型ページの骨格
 * ============================================================== */

for (const path of ["/lp/", "/about/", "/contact/"]) {
  await page.goto(SITE_BASE + path, { waitUntil: "networkidle" });
  const s = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    h2: document.querySelectorAll("h2").length,
    // landmark が無いと、読み上げの利用者はページ内を飛べません
    header: document.querySelectorAll("header").length,
    main: document.querySelectorAll("main").length,
    footer: document.querySelectorAll("footer").length,
    skip: !!document.querySelector('a[href="#main"]'),
    mainFocusable: document.querySelector("main")?.getAttribute("tabindex") === "-1",
    // 見出しの飛び級（h1 の次が h3 など）は構造が壊れている合図
    headingOrder: [...document.querySelectorAll("h1,h2,h3")].map((h) =>
      Number(h.tagName[1]),
    ),
  }));
  must(`${path} h1 がちょうど 1 つ`, s.h1 === 1, `${s.h1} 個`);
  must(
    `${path} landmark が揃っている（header / main / footer）`,
    s.header >= 1 && s.main === 1 && s.footer >= 1,
    JSON.stringify({ header: s.header, main: s.main, footer: s.footer }),
  );
  must(`${path} スキップリンクの飛び先が focus できる`, s.skip && s.mainFocusable);
  must(
    `${path} 見出しが飛び級していない`,
    s.headingOrder.every((lv, i, a) => i === 0 || lv - a[i - 1] <= 1),
    JSON.stringify(s.headingOrder),
  );
}

/* ================================================================
 * 5. 404
 * ============================================================== */

const notFound = await text("/this-page-does-not-exist/");
must(
  "存在しない URL で 404 が返る",
  notFound.status === 404,
  `status ${notFound.status}`,
);
log(
  "  ※ 404 ページの見た目は静的ホスティング側の設定に依存します（README に注記）",
);

/* ================================================================ */

await page.close();
await browser.close();

const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(
  failed.length === 0
    ? `✅ 判定 ${checks.length} 件すべて成功`
    : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
);
for (const f of failed) console.log(`   ✗ ${f.label}  ${f.detail}`);
console.log(
  pageErrors.length === 0
    ? "✅ pageerror 0 件"
    : `❌ pageerror ${pageErrors.length} 件:\n` + pageErrors.join("\n"),
);
process.exit(failed.length || pageErrors.length ? 1 : 0);
