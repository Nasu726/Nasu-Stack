import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

/**
 * 公開してよい記事だけを、新しい順で返します。
 *
 * **この関数が唯一の入口です。** 一覧・sitemap・RSS がそれぞれ
 * `getCollection("blog")` を呼んで各自で絞り込むと、
 * どれか 1 つで下書きが漏れます。しかも漏れたことに気づけません
 * （下書きは自分で書いたものなので、見ても違和感がない）。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("blog", ({ data }) => data.draft !== true);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** 表示用の日付。`<time datetime>` に入れる ISO も一緒に返します。 */
export function formatDate(date: Date): { iso: string; text: string } {
  return {
    iso: date.toISOString().slice(0, 10),
    text: new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
  };
}
