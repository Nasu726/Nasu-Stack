# How Astro and React are split

If you're holding "Astro for static, React for dynamic" in your head, this
design looks strange. Here are the assumptions.

*[日本語版はこちら](astro-and-react.ja.md)*

---

## Premise: the two live in the same project

**Astro is not a replacement for React.** Astro is a way to serve most of a
page as static HTML and run a framework **only where it's needed** — and
putting React into that "where it's needed" is exactly what it's for.

`apps/site` in this repository is precisely that:

```astro
<DataList client:load loader={{ url: "/works.json" }} />
<ContactForm client:load />
```

The page itself ships with zero bytes of JS, and only those two spots boot as
React. **The unit of choice is a part of a page, not a project.**

So splitting the components into "for Astro" and "for React" would mean using
two different sets within one page.

---

## The axis they're actually split on

They are split — just not by framework.

```
lib/*.ts              pure functions (run anywhere)
                      action / seo / feed / utils
       ↑
components/ui/*.tsx   React (renders statically from Astro too)
       ↑
Seo.astro etc.        thin Astro-only wrappers (~10 lines)
```

**React components work inside Astro without a `client:` directive.** In that
case they're emitted as static HTML and add zero bytes of JavaScript. That's
measured, not assumed (no `<astro-slot>` wrapper, and `Stack`'s gap stays
24px).

It's also why `SiteHeader`'s narrow-screen menu is a `<details>`: it needs no
JS, so placing it in Astro doesn't require making it an island.

---

## What splitting by framework would cost

Keeping both `components/astro/*.astro` and `components/react/*.tsx` has a
clear price:

| | If split |
|---|---|
| Implementation | Two of every component. Fixing one and leaving the other stale becomes normal |
| Checks | Every assertion doubles — **and both sets have to be maintained or the split means nothing** |
| Drift | The failure this repository hit over and over, adopted on purpose |

The last one is the heaviest. Most bugs found during this project came from
**the same value existing in two places.**

- Header height vs. anchor scroll offset → collapsed into `--header-h`
- The tab list in three places → collapsed into `tabs.mjs`
- Draft exclusion in three places → collapsed into `getPublishedPosts()`
- Input classes in four places → collapsed into `inputClass()`

Splitting the components in two would be **adopting that failure as
architecture.**

---

## The upside of splitting is real

To be fair, Astro-only components would gain:

- Elements as props (`brand={<a href="/">…</a>}` would work)
- Free-form slots (React island props are serialized to JSON)
- No React runtime at all

That constraint has actually bitten. Passing `<a>` as `brand` from `.astro`
broke the build, and the workaround was adding `brandHref` (a string).

---

## Conclusion: split on "pure" vs. "thin wrapper"

The current policy:

1. **Decisions and data assembly go in pure functions that know no framework**
   (`buildMeta`, `buildRss`, `Action`)
2. **The UI exists once, in React** (Astro can render it statically)
3. **Framework-specific details get absorbed by a thin wrapper**
   (`Seo.astro` is 30 lines)

Once the wrappers get thick, splitting becomes the right call. Measured today,
`Seo.astro` is 30 lines and `brandHref` is 26 — nowhere near the cost of
maintaining two sets.

### Rules for using React components from `.astro`

**Props can only be values that survive JSON.** No functions, no elements.

```astro
<SiteHeader brand={SITE.name} brandHref="/" items={NAV} />   ✅
<SiteHeader brand={<a href="/">{SITE.name}</a>} />           ❌ breaks the build
<DataList loader={{ url: "/works.json", method: "GET" }} />  ✅ declarative form
<DataList loader={async () => fetch("/works.json")} />       ❌ functions don't pass
```

This is also why `ActionSpec` — the declarative `{url, method}` form — was
added in v0.2. **The same constraint has shaped the component design ever
since.**
