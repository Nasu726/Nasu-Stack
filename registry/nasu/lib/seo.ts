/**
 * seo.ts — メタ情報を組み立てる
 * ================================================================
 * **フレームワークに依存しません。** データを渡すとタグの一覧が返るだけです。
 * Astro なら `<Seo>`、React なら好きな方法で `<head>` に流してください。
 *
 * ```ts
 * const meta = buildMeta({
 *   title: "はじめての記事",
 *   siteName: "Example Studio",
 *   description: "…",
 *   site: "https://example.com",
 *   path: "/blog/hello",
 *   image: "/og/hello.png",
 *   type: "article",
 *   publishedAt: "2026-08-01",
 * });
 * ```
 *
 * ----------------------------------------------------------------
 * この関数の主な仕事は「相対 URL を絶対に直すこと」です
 * ----------------------------------------------------------------
 * OGP の画像を `/og/hello.png` のように相対で書くと、SNS 側は
 * どのドメインの話か分からず、**画像なしで表示されます。**
 * canonical も同じで、相対のままだと同じページが複数の URL として
 * 登録されることがあります。
 *
 * 手で毎回 `https://…` を書くと必ずどこかで忘れるので、ここでまとめて直します。
 */

import { toInlineScriptJson } from "@/lib/inline-script";

export interface MetaInput {
  /** ページの題名。サイト名は自動で足すので入れないでください。 */
  title: string;
  /** サイト全体の名前。 */
  siteName?: string;
  description?: string;
  /** サイトの起点。`https://example.com` のような絶対 URL。 */
  site: string;
  /** このページのパス。`/blog/hello` など。 */
  path?: string;
  /** OGP 画像。相対でも構いません（絶対に直します）。 */
  image?: string;
  /** 画像の説明。読み上げにも使われます。 */
  imageAlt?: string;
  type?: "website" | "article";
  /** 記事の公開日（ISO 8601）。 */
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  /** 言語。既定 ja。 */
  locale?: string;
  /** 検索結果に出さない。下書きのプレビューなどで使います。 */
  noindex?: boolean;
}

export interface MetaTag {
  /** "title" | "meta" | "link" | "script" */
  tag: string;
  attrs: Record<string, string>;
  /** title と script（JSON-LD）だけ中身を持ちます。 */
  children?: string;
}

/** 末尾のスラッシュを揃えて連結します（`//` や欠落を防ぐ）。 */
export function absoluteUrl(site: string, path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = site.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  return base + rel;
}

export function buildMeta(input: MetaInput): MetaTag[] {
  const {
    title,
    siteName,
    description,
    site,
    path = "/",
    image,
    imageAlt,
    type = "website",
    publishedAt,
    updatedAt,
    author,
    locale = "ja",
    noindex,
  } = input;

  const url = absoluteUrl(site, path);
  const imageUrl = image ? absoluteUrl(site, image) : undefined;
  // 「記事名 | サイト名」。サイト名が無いか、題名と同じなら題名だけ。
  const fullTitle = siteName && siteName !== title ? `${title} | ${siteName}` : title;

  const tags: MetaTag[] = [
    { tag: "title", attrs: {}, children: fullTitle },
    { tag: "link", attrs: { rel: "canonical", href: url } },
    { tag: "meta", attrs: { property: "og:title", content: title } },
    { tag: "meta", attrs: { property: "og:type", content: type } },
    { tag: "meta", attrs: { property: "og:url", content: url } },
    { tag: "meta", attrs: { property: "og:locale", content: locale } },
  ];

  if (description) {
    tags.push({ tag: "meta", attrs: { name: "description", content: description } });
    tags.push({
      tag: "meta",
      attrs: { property: "og:description", content: description },
    });
  }
  if (siteName) {
    tags.push({ tag: "meta", attrs: { property: "og:site_name", content: siteName } });
  }
  if (imageUrl) {
    tags.push({ tag: "meta", attrs: { property: "og:image", content: imageUrl } });
    if (imageAlt) {
      tags.push({
        tag: "meta",
        attrs: { property: "og:image:alt", content: imageAlt },
      });
    }
    // 画像があるときだけ大きいカードにします。
    // 画像なしで summary_large_image にすると、X 側で崩れて出ます。
    tags.push({
      tag: "meta",
      attrs: { name: "twitter:card", content: "summary_large_image" },
    });
  } else {
    tags.push({ tag: "meta", attrs: { name: "twitter:card", content: "summary" } });
  }

  if (type === "article") {
    if (publishedAt) {
      tags.push({
        tag: "meta",
        attrs: { property: "article:published_time", content: publishedAt },
      });
    }
    if (updatedAt) {
      tags.push({
        tag: "meta",
        attrs: { property: "article:modified_time", content: updatedAt },
      });
    }
  }

  if (noindex) {
    tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" } });
  }

  tags.push({
    tag: "script",
    attrs: { type: "application/ld+json" },
    /* 逃がし処理は `@/lib/inline-script` に 1 つだけ置いてあります。
       ここと theme-provider が同じものを使います。2 か所に書くと、
       片方だけ直したときに気づけません。 */
    children: toInlineScriptJson(
      buildJsonLd({
        title,
        siteName,
        description,
        url,
        imageUrl,
        type,
        publishedAt,
        updatedAt,
        author,
      }),
    ),
  });

  return tags;
}

/**
 * 構造化データ。検索結果に日付や著者が出るかどうかが変わります。
 * 空の項目を入れると弾かれるので、**値があるものだけ**入れます。
 */
function buildJsonLd(o: {
  title: string;
  siteName?: string;
  description?: string;
  url: string;
  imageUrl?: string;
  type: "website" | "article";
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": o.type === "article" ? "Article" : "WebSite",
    name: o.title,
    url: o.url,
  };
  if (o.type === "article") {
    base.headline = o.title;
    delete base.name;
    if (o.publishedAt) base.datePublished = o.publishedAt;
    if (o.updatedAt) base.dateModified = o.updatedAt;
    if (o.author) base.author = { "@type": "Person", name: o.author };
  }
  if (o.description) base.description = o.description;
  if (o.imageUrl) base.image = o.imageUrl;
  if (o.siteName) base.publisher = { "@type": "Organization", name: o.siteName };
  return base;
}
