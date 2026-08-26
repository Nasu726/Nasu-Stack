# LoadMoreList and useCursorList

*[日本語版はこちら](load-more-list.ja.md)*

`LoadMoreList` loads cursor pages after an explicit button activation. It does
not turn the page into automatic infinite scroll. The same registry item also
installs `useCursorList`, `CursorPage`, and `CursorLoader`, so you can step down
without adding another package or replacing the contract.

```bash
npx shadcn add Nasu726/Nasu-Stack/load-more-list
```

```tsx
import { LoadMoreList } from "@/components/ui/load-more-list";
import { jsonRequest } from "@/lib/action";
import type { CursorPage } from "@/lib/cursor";

type Article = { id: string; href: string; title: string };

<LoadMoreList
  loader={(cursor, ctx) =>
    jsonRequest<CursorPage<Article, string>>("/api/articles", {
      method: "POST",
      body: JSON.stringify({ cursor }),
      ctx,
    })
  }
  renderItem={(article) => (
    <a href={article.href}>{article.title}</a>
  )}
  getKey={(article) => article.id}
/>
```

The first page receives `undefined`. Each successful response supplies the
cursor for the next request:

```ts
interface CursorPage<TItem, TCursor> {
  items: TItem[];
  nextCursor?: TCursor | null;
}
```

An absent or `null` `nextCursor` means the real end. An empty `items` array is
not necessarily the end: when a next cursor exists, the Load more button stays
available. Cursor values accepted by the hook are finite structural values
(strings, finite numbers, booleans, arrays, and plain objects); `null` is
reserved for the end marker.

## What it protects

- The initial page loads automatically; later pages require the button.
- A synchronous ref lock prevents repeated `loadMore()` calls from starting
  duplicate requests before React can render `disabled`.
- Changing `deps` immediately hides the previous collection, aborts its active
  request, and ignores a late response even when the transport ignores the
  signal.
- A failed later page leaves already loaded items in place. `retry()` requests
  only that failed cursor.
- Returning to a cursor that was already requested fails closed with
  `CURSOR_LOOP`; a malformed page fails with `INVALID_CURSOR_PAGE`.
- Loading, errors, counts, an empty collection, and the end are announced.
  Focus remains at the Load more control after appending, moves to retry after
  failure, and moves to the end status when the final button disappears.

All visible defaults are English. Override `labels`, including the `error`
formatter, for the app locale.

```tsx
<LoadMoreList
  loader={loadArticles}
  renderItem={renderArticle}
  getKey={(article) => article.id}
  labels={{
    loadMore: "Show more articles",
    end: "All articles are shown.",
    error: (error) =>
      error.code === "CURSOR_LOOP"
        ? "The article feed could not continue."
        : error.displayMessage,
  }}
/>
```

## One layer lower

Use the hook when the list, button, or status presentation belongs to your
product. It exposes `items`, the four async states, `hasMore`, `isEnd`,
`loadMore()`, `retry()`, and `reload()`.

```tsx
import { useCursorList } from "@/hooks/use-cursor-list";

const feed = useCursorList(loadArticles, [activeFilter]);

return (
  <>
    <ArticleGrid articles={feed.items} />
    {feed.hasMore && (
      <button disabled={feed.isLoadingMore} onClick={() => void feed.loadMore()}>
        Load more
      </button>
    )}
  </>
);
```

`deps` is the identity of the whole collection, not the current cursor. Put a
filter, search term, tenant, or sort selection there. The hook owns the cursor
queue internally.

## Responsibility boundary

Nasu Stack owns the client request lock, reset/stale generations, visible async
branches, retrying the failed page, cursor-loop detection, and the manual Load
more interaction. The application and server still own:

- issuing opaque cursors and defining stable order;
- authorization and filtering for every page;
- item identity, overlap, deduplication, updates, and deletion between pages;
- cache and index consistency, rate limits, and abuse prevention;
- URL/history restoration and whether loaded pages survive navigation;
- virtualization for very large collections.

The hook deliberately does not deduplicate items. Only the domain can decide
whether two equal IDs are accidental overlap, an updated record, or distinct
versions. The server should return a stable order and a cursor that advances.
An `AbortSignal` prevents stale client state; it does not prove that server work
stopped. The button prevents duplicate client requests, not duplicate server
effects.

Automatic `IntersectionObserver` loading is not included. It can make the end,
browser history, scroll restoration, footer access, and assistive-technology
navigation harder. Add observation in the application only when those product
decisions have been made; the manual button remains the safe path.
