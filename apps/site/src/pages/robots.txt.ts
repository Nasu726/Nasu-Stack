import type { APIRoute } from "astro";
import { buildRobots } from "@/lib/feed";
import { SITE } from "../site.config";

export const GET: APIRoute = () =>
  new Response(buildRobots(SITE.url), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
