/**
 * サイト共通のナビゲーション定義。
 *
 * **1 か所にまとめます。** ページごとに書くと、
 * 「新しいページを足したのにヘッダから辿れない」が必ず起きます。
 */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/lp/", label: "Services" },
  { href: "/about/", label: "About" },
  { href: "/blog/", label: "Blog" },
  { href: "/contact/", label: "Contact" },
  { href: "/ja/", label: "日本語" },
];

export const FOOTER_GROUPS = [
  {
    label: "Site",
    items: [
      { href: "/lp/", label: "Services" },
      { href: "/about/", label: "About" },
      { href: "/blog/", label: "Blog" },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/contact/", label: "Contact" },
      { href: "/ja/", label: "日本語" },
      { href: "/rss.xml", label: "RSS" },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
];

export const NAV_JA = [
  { href: "/ja/", label: "ホーム" },
  { href: "/ja/lp/", label: "サービス" },
  { href: "/ja/about/", label: "会社概要" },
  { href: "/ja/blog/", label: "ブログ" },
  { href: "/ja/contact/", label: "お問い合わせ" },
  { href: "/", label: "English" },
];

export const FOOTER_GROUPS_JA = [
  {
    label: "サイト",
    items: [
      { href: "/ja/lp/", label: "サービス" },
      { href: "/ja/about/", label: "会社概要" },
      { href: "/ja/blog/", label: "ブログ" },
    ],
  },
  {
    label: "その他",
    items: [
      { href: "/ja/contact/", label: "お問い合わせ" },
      { href: "/", label: "English" },
      { href: "/ja/rss.xml", label: "RSS" },
      { href: "/sitemap.xml", label: "サイトマップ" },
    ],
  },
];
