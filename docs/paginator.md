# Paginator

[日本語](paginator.ja.md)

`Paginator` renders page navigation as real links. It owns the bounded set of
page numbers, ellipses, current-page semantics, and previous/next states. It
does not fetch a total, define what `?page=` means, or synchronize a router.

```tsx
import { Paginator } from "@/components/ui/paginator";

<Paginator
  currentPage={page}
  totalPages={result.totalPages}
  getHref={(next) => `/articles?page=${next}`}
/>
```

`getHref` is required. This keeps every destination available to the browser,
so opening in a new tab, copying a link, server rendering, and navigation when
client JavaScript fails all keep working.

## Client-side routers

Keep the real `href`, then intercept only an ordinary unmodified click. Let
modified clicks keep the browser's native behavior.

```tsx
<Paginator
  currentPage={page}
  totalPages={result.totalPages}
  getHref={(next) => `/articles?page=${next}`}
  onPageChange={(next, event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    router.navigate(`/articles?page=${next}`);
  }}
/>
```

## Language and lower-level use

The accessible defaults are English because Nasu Stack does not own an app
locale. Supply `labels` where the interface language differs.

```tsx
<Paginator
  // ...
  labels={{
    navigation: "Article pages",
    previous: "Newer articles",
    next: "Older articles",
    page: (page) => `Article page ${page}`,
  }}
/>
```

If the provided appearance is not suitable, use `getPaginationItems()` to
build your own links while retaining the bounded page/ellipsis algorithm.
`siblingCount` and `boundaryCount` are capped at 10 so accidental input cannot
turn a large total into a huge DOM. Fork the small helper if a specialized
navigation genuinely needs more.

## Boundary

- The application owns the real total and how out-of-range URL input is
  redirected or reported. The component defensively clamps display values; it
  is not input validation for your route.
- A page is a stable URL position. Cursor-based feeds and “load more” have
  different race and duplication contracts and should not be disguised as
  numbered pagination.
- On the first or last page, the unavailable direction is shown as disabled
  text and is not added to the Tab sequence.
- Large page counts do not render every link. Narrow containers wrap the
  bounded list instead of crushing targets or overflowing the document.

Install it with:

```bash
npx shadcn add Nasu726/Nasu-Stack/paginator
```
