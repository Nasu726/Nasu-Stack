/** サイト全体の設定。1 か所にまとめます。 */
export const SITE = {
  /** astro.config.mjs の `site` と同じ値にしてください。 */
  url: "https://example.com",
  name: "__PROJECT_NAME__",
  description: "WebTemplate で作ったサイトです。",
  author: "",
  locale: "ja",
  ogImage: "/og.png",
} as const;
