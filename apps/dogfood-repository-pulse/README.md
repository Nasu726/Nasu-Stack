# Repository Pulse

[日本語](./README.ja.md)

Repository Pulse is a read-heavy dogfood application for Nasu Stack. It shows
public repository metadata, issue and pull-request search, explicit load-more
pagination, and a responsive release table.

[View the public dogfood app](https://nasu726.github.io/Nasu-Stack/dogfood/repository-pulse/)

This is an example application, not a new `create-nasu-stack` template. It was
created from the packed CLI and populated through the public shadcn registry so
that it exercises the same copy-owned source path as a real user project.

## Start locally

Run every command from this directory (the one containing `package.json`).

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.

The checked-in example points at `Nasu726/Nasu-Stack`. Change these public
values in `.env` to inspect another public repository:

| Variable | Required | Purpose |
|---|---:|---|
| `VITE_GITHUB_OWNER` | Yes | GitHub owner or organization |
| `VITE_GITHUB_REPO` | Yes | Public repository name |
| `VITE_GITHUB_API_URL` | No | API base; defaults to `https://api.github.com/` |

If a required value is absent or unsafe, the app renders a correction screen
that names the variable instead of failing with a blank page.

## Commands

```bash
npm run dev       # development server
npm run build     # typecheck and production build
npm run preview   # serve the production build
npm run verify    # fixture API + browser regression checks
```

Read [HowToUse.md](./HowToUse.md) for the implementation map, responsibility
boundary, and deployment notes.

## Security boundary

Every `VITE_*` value is embedded in browser JavaScript and is public. Do not put
a GitHub token or any other secret in these variables. Unauthenticated GitHub
requests have a lower rate limit by design. Private repositories or higher
limits require a server-side proxy that owns authentication, authorization,
rate limiting, logging, and secret storage.
