/**
 * サイト全体の設定。**1 か所にまとめます。**
 * ここが散らばると、OGP のサイト名とフッタの表記がずれる、が必ず起きます。
 */
export const SITE = {
  /** 絶対 URL の起点。astro.config.mjs の `site` と同じ値にしてください。 */
  url: "https://example.com",
  name: "Studio Nasu",
  description:
    "静的なページは Astro、動く部分だけ React。WebTemplate で組んだサイトの見本です。",
  author: "なす",
  /**
   * 既定の OGP 画像。**無いと SNS に貼ったとき白い箱が出るだけになります。**
   * ページごとに差し替えたいときは Base.astro に image を渡してください。
   */
  ogImage: "/og.png",
  locale: "ja",
} as const;
