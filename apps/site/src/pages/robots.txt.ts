import type { APIRoute } from "astro";
import { buildRobots } from "@/lib/feed";
import { SITE } from "../site.config";
import { withBase } from "@/lib/base";

export const GET: APIRoute = () =>
  new Response(buildRobots(SITE.url, { sitemapPath: withBase("/sitemap.xml") }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
