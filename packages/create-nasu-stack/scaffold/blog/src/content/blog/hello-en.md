---
title: Your first article
description: Start by rewriting this article. It demonstrates Markdown and images in the generated blog.
date: 2026-01-01
tags: [Getting started]
lang: en
route: hello
---

This file is `src/content/blog/hello-en.md`.
**Rewrite it and it becomes your own article.**

Add another `.md` file in the same directory to create a new article. Use the
`route` field when the URL should differ from the file name.

## The block between `---` lines

This is the article metadata. The build stops if required fields are missing.

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Article title |
| `description` | yes | Text used in the list and social previews |
| `date` | yes | Publication date; newer articles appear first |
| `tags` | no | Categories |
| `lang` | no | Article language; defaults to English |
| `route` | no | URL name; defaults to the file name |
| `draft` | no | Set `true` to hide it everywhere |

An article with `draft: true` stays out of the index, sitemap, and RSS feed.

## Writing code

```ts
const answer = 42;
```

Long lines scroll inside the code block instead of widening the page.

## Adding an image

Use a relative path.

```markdown
![Description](./diagram.png)     ← dimensions are added automatically
![Description](/img/diagram.png)  ← no dimensions; content shifts on load
```

![A layout diagram](./diagram.png)

Astro adds `width` and `height` to relative images, reserving their space before
they load. `npm run check` catches images that do not reserve space.
