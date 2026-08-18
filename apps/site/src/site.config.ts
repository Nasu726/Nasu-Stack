/**
 * サイト全体の設定。**1 か所にまとめます。**
 * ここが散らばると、OGP のサイト名とフッタの表記がずれる、が必ず起きます。
 */
export const SITE = {
  /**
   * 絶対 URL の起点。**唯一の定義は `astro.config.mjs` の `site` です。**
   *
   * Astro がその値を `import.meta.env.SITE` で渡してくるので、ここでは
   * 書き写さずに受け取ります。2 か所に書くと必ずずれます——実際 v0.9b では、
   * canonical は astro.config の値、sitemap はここの固定値を使っていて、
   * **同じページに 2 つの違うアドレスが出ていました。**
   *
   * ここには**公開先の origin だけ**を入れます（`https://example.com`）。
   * 下の階層（`/my-site/`）は `base` の担当で、`Astro.url.pathname` に
   * 既に含まれています。両方に入れると二重になります。
   */
  url: import.meta.env.SITE ?? "https://example.com",
  /* 雛型の見本なので、**誰のものでもない名前**にしています。
     自分のサイトにするときは、ここと about.astro を書き換えてください。 */
  name: "Example Studio",
  description:
    "静的なページは Astro、動く部分だけ React。WebTemplate で組んだサイトの見本です。",
  author: "Example Studio",
  /**
   * 既定の OGP 画像。**無いと SNS に貼ったとき白い箱が出るだけになります。**
   * ページごとに差し替えたいときは Base.astro に image を渡してください。
   */
  ogImage: "/og.png",
  locale: "ja",
} as const;

/**
 * フッタの著作権表記に使う年。**書き写しません。**
 * 静的サイトなので、ビルドした時点の年で固定されます。
 * 手で書くと、年が変わった翌日から全ページが古くなります。
 */
export const YEAR = new Date().getFullYear();
