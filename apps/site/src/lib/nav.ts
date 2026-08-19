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
      { href: "/rss.xml", label: "RSS" },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
];
