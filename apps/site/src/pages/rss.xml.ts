import type { APIRoute } from "astro";
import { buildRss } from "@/lib/feed";
import { getPublishedPosts, postSlug } from "../lib/posts";
import { SITE } from "../site.config";
import { withBase } from "@/lib/base";

/** RSS。下書きの除外は sitemap と同じ 1 つの関数に任せます。 */
export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts("en");

  const xml = buildRss({
    site: SITE.url,
    title: SITE.name,
    description: SITE.description,
    language: SITE.locale,
    items: posts.map((p) => ({
      title: p.data.title,
      path: withBase(`/blog/${postSlug(p)}/`),
      description: p.data.description,
      date: p.data.date,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
