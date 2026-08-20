---
title: 日本語の組版（Japanese typography sample）
description: This article is written in Japanese on purpose, to show how prose.css sets line height and measure for CJK text.
date: 2026-07-01
tags: [Typography, 日本語]
lang: ja
---

**この記事は日本語のまま置いてあります。** 和文と欧文では 1 文字の幅が倍ほど
違うので、同じ見た目の設定では読みやすさが揃いません。ここは、その差を実際に
確かめるための場所です。

*This article is deliberately left in Japanese. A CJK character is roughly twice
the width of a Latin one, so identical settings do not read equally well. This
page exists so the difference can be seen — and measured.*

## 1 行の字数

読みやすい行の長さは、字数で決まります。欧文はおよそ 75〜80 字、和文は
40〜45 字が目安です。`prose.css` は幅を `em` で持っているので、文字を小さく
すれば幅も自動的に狭くなり、**字数のほうが一定に保たれます。**

`registry/nasu/scripts/check-responsive.mjs` は、この閾値を和文と欧文で
切り替えて測っています。同じ px 幅でも読みやすさが倍違うためです。

## 行間

行間は 1.85 にしてあります。欧文の標準よりやや広めです。和文は文字の
密度が高く、詰めると行を追う目が迷いやすいので、広いほうが読めます。

> 意味づけは、迷ったら弱いほうを選ぶ。強い意味づけを間違えるほうが害が大きい。

## 折り返し

日本語には単語の区切りがないので、どこでも折り返せます。逆に、
`https://example.com/very/long/path/that/never/breaks/anywhere` のような
文字列は 1 語として扱われ、折り返せません。`overflow-wrap: break-word` を
土台で入れてあるのはそのためです。
