/**
 * サイト共通のナビゲーション定義。
 *
 * **1 か所にまとめます。** ページごとに書くと、
 * 「新しいページを足したのにヘッダから辿れない」が必ず起きます。
 */
export const NAV = [
  { href: "/", label: "ホーム" },
  { href: "/lp/", label: "サービス" },
  { href: "/about/", label: "会社概要" },
  { href: "/blog/", label: "ブログ" },
  { href: "/contact/", label: "お問い合わせ" },
];

export const FOOTER_GROUPS = [
  {
    label: "サイト",
    items: [
      { href: "/lp/", label: "サービス" },
      { href: "/about/", label: "会社概要" },
      { href: "/blog/", label: "ブログ" },
    ],
  },
  {
    label: "その他",
    items: [
      { href: "/contact/", label: "お問い合わせ" },
      { href: "/rss.xml", label: "RSS" },
      { href: "/sitemap.xml", label: "サイトマップ" },
    ],
  },
];
