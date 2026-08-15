import type { APIRoute } from "astro";
import { buildSitemap } from "@/lib/feed";
import { getPublishedPosts } from "../lib/posts";
import { SITE } from "../site.config";

/**
 * sitemap.xml。**下書きは getPublishedPosts が外します。**
 * ここで getCollection を直接呼ぶと、一覧からは消えているのに
 * sitemap にだけ下書きが残る、という漏れ方をします。
 */
export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const xml = buildSitemap(SITE.url, [
    { path: "/", changefreq: "weekly", priority: 1 },
    { path: "/blog/", changefreq: "weekly", priority: 0.8 },
    ...posts.map((p) => ({
      path: `/blog/${p.id}/`,
      lastmod: p.data.updated ?? p.data.date,
      priority: 0.6,
    })),
  ]);

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
