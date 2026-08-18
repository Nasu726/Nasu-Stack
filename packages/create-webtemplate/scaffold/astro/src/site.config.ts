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

/**
 * フッタの著作権表記に使う年。**手で書きません。**
 * 静的サイトなので、ビルドした時点の年で固定されます。
 * 手で書くと、年が変わった翌日から全ページが古くなります。
 */
export const YEAR = new Date().getFullYear();

/**
 * テーマの保存先（localStorage のキー）。
 *
 * **同じドメインに別のサイトを置くときは、必ず分けてください。**
 * localStorage は origin 単位なので、`example.com/app/` と
 * `example.com/docs/` は同じ入れ物を共有します。分けないと、
 * 片方で選んだ明暗がもう片方にもそのまま出ます。
 */
export const THEME_STORAGE_KEY = "__PROJECT_NAME__.theme";
