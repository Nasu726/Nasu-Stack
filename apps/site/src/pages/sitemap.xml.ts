import type { APIRoute } from "astro";
import { buildSitemap } from "@/lib/feed";
import { getPublishedPosts } from "../lib/posts";
import { SITE } from "../site.config";
import { withBase } from "@/lib/base";

/**
 * sitemap.xml。**下書きは getPublishedPosts が外します。**
 * ここで getCollection を直接呼ぶと、一覧からは消えているのに
 * sitemap にだけ下書きが残る、という漏れ方をします。
 */
export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const xml = buildSitemap(SITE.url, [
    /* **base を付けます。** sitemap が出すのは絶対 URL なので、
       付け忘れると「存在しないページの一覧」を検索エンジンに渡すことに
       なります。手元では直下配信なので、やはり気づけません。 */
    { path: withBase("/"), changefreq: "weekly", priority: 1 },
    { path: withBase("/lp/"), changefreq: "monthly", priority: 0.9 },
    { path: withBase("/about/"), changefreq: "yearly", priority: 0.5 },
    { path: withBase("/contact/"), changefreq: "yearly", priority: 0.7 },
    { path: withBase("/blog/"), changefreq: "weekly", priority: 0.8 },
    ...posts.map((p) => ({
      path: withBase(`/blog/${p.id}/`),
      lastmod: p.data.updated ?? p.data.date,
      priority: 0.6,
    })),
  ]);

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
