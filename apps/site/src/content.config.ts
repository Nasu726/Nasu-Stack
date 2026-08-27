import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
/* Astro自身が公開するZodです。利用者側へzodの直接依存は増やしません。 */
import { z } from "astro/zod";

/**
 * 記事の置き場。Astro 5 の Content Layer で読みます。
 *
 * `draft` を持たせているのが要点です。**書きかけを公開しないための旗**で、
 * 一覧・sitemap・RSS の 3 か所すべてで外す必要があります。
 * 外し忘れを防ぐため、絞り込みは src/lib/posts.ts に 1 つだけ置いています。
 */
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    /** 言語ごとに同じURL名を使うためのroute。省略時はファイル名です。 */
    route: z.string().optional(),
    /* 本文の言語。**読み上げの発音がここで決まります。**
       サイト全体は site.config の locale ですが、記事単位で違うことがあります
       （このデモには和文組版を見せるための日本語の記事が 1 本あります）。 */
    lang: z.string().optional(),
  }),
});

export const collections = { blog };
