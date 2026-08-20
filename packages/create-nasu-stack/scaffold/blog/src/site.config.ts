/**
 * サイト全体の設定。英語版と日本語版で URL・名前・画像を共有します。
 * サイト名や説明を変えるときは、まずここを直してください。
 */
export const SITE = {
  /** 絶対 URL の起点は astro.config.mjs の `site` から受け取ります。 */
  url: import.meta.env.SITE ?? "https://example.com",
  name: "__PROJECT_NAME__",
  description: "A site built with Nasu Stack.",
  author: "",
  locale: "en",
  ogImage: "/og.png",
} as const;

/** 日本語 route の表示文。共通の値は SITE をそのまま使います。 */
export const SITE_JA = {
  ...SITE,
  description: "Nasu Stack で作ったサイトです。",
  locale: "ja",
} as const;

/** フッタの年は build 時点から作り、手で書き写しません。 */
export const YEAR = new Date().getFullYear();

/** カタログなど、同じ origin にある別サイトと保存先を分けます。 */
export const THEME_STORAGE_KEY = "__PROJECT_NAME__.theme";
