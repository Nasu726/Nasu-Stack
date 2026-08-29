# Migrating from v1 to v2

*[日本語](migration-v2.ja.md)*

## Short answer

There is no forced migration. Nasu Stack copies source into your application,
and v2 does not replace that source in the background. A v1 application can
keep its current files. No v1 registry item name, public export, or semantic
token was removed.

v2 is a major release because it expands the Stable contract and makes one
intentional behavior change: `useAction` no longer automatically retries an
error whose code is `VALIDATION` or HTTP `422`. Retrying the same invalid input
only delays feedback; authoritative validation still belongs on the server.

## Starting a new project

Use the versioned v2 release asset. Its release workflow refuses overwrites:

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v2.0.1/create-nasu-stack-2.0.1.tgz my-site
```

The language, starting-point, and template prompts are unchanged. Existing
`--lang`, `--template`, and `--yes` commands continue to work.

## Updating an application that already copied v1 items

Copied files belong to your application. Update only the items whose v2
behavior you want, one item at a time:

1. Commit your current application changes.
2. Preview the incoming item without writing files.
3. Inspect its per-file diff.
4. Overwrite only an unmodified copy, or merge the relevant changes into your
   customized copy yourself.
5. Run your application's typecheck, tests, and build.

For example:

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --dry-run
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --diff
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/async-form --overwrite
```

The last command replaces existing files. Do not run it until the diff is safe
for your application. Nasu Stack deliberately has no hidden update mechanism.

## Existing items with v2 changes

| Item | What changed | Required action |
|---|---|---|
| `use-action` | `VALIDATION` and HTTP `422` are terminal failures instead of automatic retry candidates | Check code that intentionally used retry for a 422 response; other callers need no change |
| `async-form` | Optional library-independent validation, transformed action input, first-error focus, and nested field-error clearing | Existing calls keep the same shape; update the item only if you want these behaviors |
| `use-popover` | Adds measured viewport positioning, `floatingRef`, `floatingStyle`, alignment, and explicit remeasurement | Existing `anchorRef` / `placement` use remains valid |
| `async-boundary` | Adds an optional `retryLabel` | No source change required |
| `layout` | Adds `Switcher` and `SidebarLayout` exports without a new registry item | Update `layout` only if you want those exports |

These are additions except for the documented retry policy. There is no rename
or removed prop that requires a mechanical rewrite.

## New v2 registry items

The following item names are new:

`validation`, `use-interaction-guard`, `use-autosave`, `use-copy`,
`copy-button`, `error-boundary`, `field-array`, `paginator`, `popover`,
`load-more-list`, and `search-list`.

Add only the responsibility you need. `CursorPage`, `CursorLoader`, and
`useCursorList` are lower-level exports installed with `load-more-list`; they
are not extra item names to memorize. The catalog and
[overview](overview.md) show the component → hook → contract path.

## Responsibility boundary

v2 does not take ownership of authentication, authorization, server-side
validation, rate limiting, idempotency, transactions, durable drafts, or
database cursor correctness. The complete ownership table remains in
[boundaries.md](boundaries.md).
