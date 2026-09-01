"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Frame — 画像の場所を先に取っておく箱
 * ================================================================
 * ```tsx
 * <Frame ratio="16/9">
 *   <img src="/hero.avif" alt="" />
 * </Frame>
 * ```
 *
 * ----------------------------------------------------------------
 * 何を防いでいるのか
 * ----------------------------------------------------------------
 * 画像は読み込みが終わるまで大きさが分かりません。何もしないと、
 * 読み込んだ瞬間に画像が高さを持ち、**その下の本文がガクッと下へずれます**。
 * 読んでいる途中に文章が動く、押そうとしたボタンが逃げる、あれです
 * （レイアウトシフト / CLS）。
 *
 * 直し方は「先に場所を取っておく」の一手です。比率さえ決まっていれば、
 * 画像がまだ来ていなくても高さが確定します。
 *
 * ----------------------------------------------------------------
 * 画像そのものは作りません
 * ----------------------------------------------------------------
 * Astro には最適化つきの `<Image>` があり、Next.js にもあります。
 * それらに対抗するものは作りません。**この箱は中身を選びません。**
 *
 * ```astro
 * <Frame ratio="16/9">
 *   <Image src={hero} alt="" width={1600} height={900} />
 * </Frame>
 * ```
 */

export interface FrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 縦横比。`"16/9"` `"4/3"` `"1"` など CSS の aspect-ratio と同じ書き方です。 */
  ratio?: string;
  /**
   * 中身の収め方。既定 cover（切り取ってでも埋める）。
   * contain は全体を見せます（余白ができます）。
   */
  fit?: "cover" | "contain";
  /** 角丸。 */
  radius?: "none" | "md" | "lg" | "xl";
  children?: React.ReactNode;
}

const RADIUS = {
  none: "",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
} as const;

export function Frame({
  ratio = "16/9",
  fit = "cover",
  radius = "lg",
  className,
  style,
  children,
  ...props
}: FrameProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        RADIUS[radius],
        // 中の img / video / iframe を、比率に関係なくこの箱いっぱいにします。
        // 子に手を入れないのは、Astro の <Image> でも素の <img> でも
        // 同じように使えるようにするためです。
        "[&>img]:absolute [&>img]:inset-0 [&>img]:size-full",
        "[&>video]:absolute [&>video]:inset-0 [&>video]:size-full",
        "[&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:size-full [&>iframe]:border-0",
        fit === "cover"
          ? "[&>img]:object-cover [&>video]:object-cover"
          : "[&>img]:object-contain [&>video]:object-contain",
        className,
      )}
      style={{ aspectRatio: ratio, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Img — `loading` と `decoding` の既定を間違えないための薄い包み
 * ================================================================
 * 遅延読み込み（`loading="lazy"`）は、画面外の画像には効きますが、
 * **最初に目に入る大きな画像に付けると逆効果**です。
 * ブラウザが「後回しでいい」と判断し、表示が目に見えて遅くなります
 * （LCP が伸びます）。
 *
 * 「上のほうに出る画像には `priority` を付ける」とだけ覚えれば済むようにしました。
 */
export interface ImgProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  /** 最初の画面に入る画像。遅延読み込みをやめ、優先して取りにいきます。 */
  priority?: boolean;
  alt: string;
}

export function Img({ priority, alt, ...props }: ImgProps) {
  return (
    <img
      {...props}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      // priority のときだけ優先度を上げます。全部に付けると意味がありません。
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
    />
  );
}
