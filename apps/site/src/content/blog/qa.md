---
title: "Q&A: <div> vs <section>"
description: An article whose title contains & and <, to prove the RSS feed and sitemap do not break.
date: 2026-07-15
tags: [HTML, Accessibility]
---

## What this article is for

The title contains `&` and `<`. **Forget to escape those and the feed breaks**,
so this exists to catch that. A reader's feed app usually unsubscribes from a
broken feed without saying anything. So it gets checked mechanically.

## The difference between `<div>` and `<section>`

A `<section>` is "a chunk that has a heading". If there is no heading, `<div>`
is the correct choice. When in doubt, use `<div>`. Putting a `<section>`
somewhere meaningless fills the screen-reader outline with empty entries.

> With semantics, when in doubt pick the weaker one. Getting a strong meaning
> wrong does more harm.
