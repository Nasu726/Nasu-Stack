---
title: "Notes: <section> and &"
description: This article keeps RSS and sitemap escaping covered even when a title contains markup characters.
date: 2026-01-05
tags: [HTML]
lang: en
route: tips
---

This title contains `<` and `&`. Keeping one article like this is useful:
forgetting XML escaping breaks RSS, while feed readers often stop updating
without explaining why. `npm run check` can detect the breakage.

## `<div>` and `<section>`

A `<section>` is a region with a heading. Without a heading, `<div>` is the
better choice. When unsure, prefer the weaker meaning; using strong semantics
incorrectly causes more harm.
