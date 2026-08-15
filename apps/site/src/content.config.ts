import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

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
  }),
});

export const collections = { blog };
