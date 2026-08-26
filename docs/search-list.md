# Search list recipe

*[日本語版はこちら](search-list.ja.md)*

`SearchListRecipe` is copy-owned wiring for a search field and a link-first
result list. It debounces rapid input, hides results from the previous query as
soon as the query changes, aborts a superseded request, and makes loading,
failure, retry, empty, and success states explicit.

```bash
npx shadcn add Nasu726/Nasu-Stack/search-list
```

```tsx
import {
  SearchListRecipe,
  type SearchListItem,
} from "@/components/recipes/search-list";
import { jsonRequest } from "@/lib/action";

<SearchListRecipe
  search={(query, ctx) =>
    jsonRequest<SearchListItem[]>(
      `/api/search?q=${encodeURIComponent(query)}`,
      { ctx },
    )
  }
/>
```

The action receives the normalized query and the ordinary Nasu Stack
`ActionContext`. Pass `ctx.signal` to your transport. When the user enters a
new query, the recipe asks the old transport to stop and refuses to put its
late result back into the UI.

## Why this is a recipe

The reusable part is the failure-prone wiring, not a universal search product.
The item is installed into `components/recipes/search-list.tsx` so you can own
and edit it. Its intentionally small result contract is:

```ts
interface SearchListItem {
  id: React.Key;
  href: string;
  title: string;
  description?: string;
}
```

Every destination remains a real link. If your domain needs grouped results,
facets, highlighting, cursor pagination, or a different row shape, change the
copied recipe or step down to `useResource` and `AsyncBoundary`; you do not
need to replace the rest of Nasu Stack.

Use `AsyncSelect` when the user is choosing one form value. Use `DataList` for
a list that reloads from explicit dependencies without a search field. This
recipe is for finding destinations or records and then following a link.

## Defaults and language

- `debounceMs` defaults to 300 ms.
- `minQueryLength` defaults to 2.
- automatic `retry` defaults to 0; a visible retry button remains available.
- `debounceMs` must be a non-negative finite number, `minQueryLength` a
  positive integer, and `retry` a non-negative integer.
- visible defaults are English. Override any entry in `messages` for your app
  locale and wording.

```tsx
<SearchListRecipe
  search={searchArticles}
  debounceMs={400}
  messages={{
    label: "Search articles",
    empty: "No articles match this query.",
    retry: "Try search again",
  }}
/>
```

The input has a real label, search progress and result counts use a polite live
region, errors are alerts, and the result rows are keyboard-reachable links.
Long unbroken titles and descriptions wrap instead of widening a narrow page.

## Responsibility boundary

The recipe owns client debounce, stale-result exclusion, request abort
signaling, the four visible async branches, and link-first result semantics.
It does **not** decide:

- what a query means, how text is normalized, ranked, highlighted, or logged;
- which records the current user may discover or open;
- rate limits, abuse prevention, caching, or search-index consistency;
- whether a URL is safe and canonical;
- total counts, facets, cursor order, or pagination policy.

Authorization and result filtering must happen on the server. Hiding a result
in this UI is not access control. An abort signal prevents stale client UI; it
does not prove that server work stopped. Debounce reduces ordinary requests
but is not a rate limit.
