# How Repository Pulse is put together

[日本語](./HowToUse.ja.md)

Run commands from this project root—the directory containing `package.json`.
Copy `.env.example` to `.env`, then run `npm install` and `npm run dev`.

## Implementation map

| Location | Responsibility |
|---|---|
| `src/App.tsx` | Page composition and application copy |
| `src/lib/config.ts` | Validate public environment values before rendering |
| `src/lib/github.ts` | GitHub URLs, HTTP error translation, and runtime response validation |
| `src/components/recipes/search-list.tsx` | Debounce, stale-request cancellation, and search states |
| `src/components/ui/load-more-list.tsx` | Cursor state, explicit next page, retry, and focus restoration |
| `src/components/ui/data-table.tsx` | Sorting, paging, and table-to-card responsive composition |
| `src/components/ui/copy-button.tsx` | Clipboard state and announcements |
| `src/components/ui/error-boundary.tsx` | Local containment of render failures |

The files under `src/components`, `src/hooks`, and `src/lib` were copied into
this application. They are application-owned source, not a hidden workspace
dependency.

## Data flow

`readPublicConfig()` accepts only public repository coordinates and an API URL.
`createGithubClient()` then exposes four operations: repository summary,
releases, search, and cursor-based recent work. Every response enters as
`unknown` and is checked before React receives it. A 200 response with the wrong
shape therefore becomes a visible `BAD_RESPONSE` failure instead of a render
error or false success.

The application intentionally does not send an `Authorization` header. Browser
environment variables, request headers, and bundled source are all visible to
the visitor.

## Change the repository

Edit `.env` and restart the development server:

```dotenv
VITE_GITHUB_OWNER=Nasu726
VITE_GITHUB_REPO=Nasu-Stack
# VITE_GITHUB_API_URL=https://api.github.com/
```

The API URL must use HTTPS. HTTP is accepted only for `localhost` and
`127.0.0.1`, which lets the deterministic test fixture run without weakening a
deployed build.

## Add or update a copied item

The registry alias lives in `components.json`. Inspect differences before
overwriting application changes:

```bash
npx shadcn@4.17.0 add @nasu/data-table --dry-run
npx shadcn@4.17.0 add @nasu/data-table --diff
```

Only use `--overwrite` after reviewing the diff. A later registry release does
not silently update copied source.

## Verify and deploy

`npm run verify` builds with a local fixture API, opens the app in Chromium, and
checks success, search, load-more, retry, keyboard use, configuration failure,
and narrow/wide layouts. It does not make GitHub availability part of CI.

`npm run build` creates `dist/`. When deploying below a URL subpath, set Vite's
`base` in `vite.config.ts`. The public API URL may point at GitHub Enterprise,
but private access still requires a server-side proxy; a browser token is not an
acceptable shortcut.
