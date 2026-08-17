/**
 * feed.ts — sitemap.xml と rss.xml を組み立てる
 * ================================================================
 * **フレームワークに依存しません。** データを渡すと文字列が返るだけです。
 *
 * ```ts
 * // Astro のエンドポイント（src/pages/sitemap.xml.ts）
 * export const GET = () =>
 *   new Response(buildSitemap("https://example.com", pages), {
 *     headers: { "Content-Type": "application/xml" },
 *   });
 * ```
 *
 * ----------------------------------------------------------------
 * なぜ `@astrojs/rss` を使わないのか
 * ----------------------------------------------------------------
 * 1. Astro 専用になります。この設計の売りは「特定の何かに縛られない」ことです
 * 2. 依存が増えるほど、バージョンのずれで腐ります
 *
 * XML の組み立ては 40 行ほどで済み、しかも**エスケープの規則を自分で持てます**。
 * ここが他人任せだと、`&` ひとつでフィードが壊れたときに追えません。
 */

/**
 * XML の特殊文字を実体参照に置き換えます。
 *
 * **ここを通していない文字列を XML に入れてはいけません。**
 * 記事の題名に `Q&A` や `<div> の使い方` が入っていると、
 * エスケープしないだけでフィード全体が「整形式でない」と拒否されます。
 * 読者側のリーダーは、たいてい何も言わずに購読を切ります。
 */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;") // & を最初に置くこと。後だと二重に置換されます
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 末尾のスラッシュを揃えて連結します。 */
function abs(site: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return site.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

/** 日付を ISO 8601（日付だけ）に揃えます。 */
function isoDate(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/* ==================================================================
 * sitemap.xml
 * ================================================================ */

export interface SitemapEntry {
  /** サイト内のパス、または絶対 URL。 */
  path: string;
  lastmod?: string | Date;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  /** 0.0〜1.0。 */
  priority?: number;
}

export function buildSitemap(site: string, entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(abs(site, e.path))}</loc>`];
      const lastmod = isoDate(e.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number") {
        parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/* ==================================================================
 * rss.xml
 * ================================================================ */

export interface RssItem {
  title: string;
  path: string;
  description?: string;
  /** 公開日。 */
  date?: string | Date;
  author?: string;
}

export interface RssInput {
  site: string;
  title: string;
  description: string;
  /** フィードの言語。既定 ja。 */
  language?: string;
  /** フィード自身の URL。既定 `/rss.xml`。 */
  feedPath?: string;
  items: RssItem[];
}

export function buildRss({
  site,
  title,
  description,
  language = "ja",
  feedPath = "/rss.xml",
  items,
}: RssInput): string {
  const entries = items
    .map((item) => {
      const link = abs(site, item.path);
      const parts = [
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        // guid は「同じ記事かどうか」の判定に使われます。
        // リンクと同じにしておくと、リーダーが重複表示しません。
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      ];
      if (item.description) {
        parts.push(`      <description>${escapeXml(item.description)}</description>`);
      }
      const d = item.date instanceof Date ? item.date : item.date ? new Date(item.date) : undefined;
      if (d && !Number.isNaN(d.getTime())) {
        // RSS 2.0 の pubDate は RFC 822 形式です。ISO を入れると
        // 読み飛ばすリーダーがあります。
        parts.push(`      <pubDate>${d.toUTCString()}</pubDate>`);
      }
      if (item.author) {
        parts.push(`      <author>${escapeXml(item.author)}</author>`);
      }
      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(abs(site, "/"))}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <atom:link href="${escapeXml(abs(site, feedPath))}" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;
}

/* ==================================================================
 * robots.txt
 * ================================================================ */

export function buildRobots(
  site: string,
  {
    disallow = [] as string[],
    /**
     * sitemap の置き場所。**サブパスに公開するなら渡してください。**
     * 下の階層に置いたのに `/sitemap.xml` と書くと、
     * 存在しない場所を検索エンジンに教えることになります。
     * `withBase("/sitemap.xml")` を渡すのが確実です。
     */
    sitemapPath = "/sitemap.xml",
  } = {},
): string {
  const lines = ["User-agent: *"];
  for (const p of disallow) lines.push(`Disallow: ${p}`);
  if (disallow.length === 0) lines.push("Allow: /");
  lines.push("");
  // sitemap の場所を書いておかないと、見つけてもらえるまで時間がかかります
  lines.push(`Sitemap: ${abs(site, sitemapPath)}`);
  lines.push("");
  return lines.join("\n");
}
