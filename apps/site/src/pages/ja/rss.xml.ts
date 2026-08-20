import type { APIRoute } from "astro";
import { buildRss } from "@/lib/feed";
import { getPublishedPosts, postSlug } from "../../lib/posts";
import { SITE_JA } from "../../site.config";
import { withBase } from "@/lib/base";

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts("ja");

  const xml = buildRss({
    site: SITE_JA.url,
    title: `${SITE_JA.name} ブログ`,
    description: SITE_JA.description,
    language: SITE_JA.locale,
    items: posts.map((post) => ({
      title: post.data.title,
      path: withBase(`/ja/blog/${postSlug(post)}/`),
      description: post.data.description,
      date: post.data.date,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
