# Changelog

All notable changes to Nasu Stack are recorded here. The project follows
[Semantic Versioning](https://semver.org/) for the Stable contract described
below.

## [2.0.0] - 2026-08-27

Second Stable major release. Applications that copied v1 source keep owning
that source and are not updated in the background.

### Added

- 11 registry items: validation, interaction guard, autosave, copy, error
  boundary, field array, paginator, popover, load-more list, and the copy-owned
  search-list recipe
- Lower-level component → hook → contract paths for layout, validation,
  clipboard, popover positioning, and cursor pagination
- English and Japanese guides for each new responsibility, including a v1 → v2
  migration guide that preserves application customizations
- A release gate covering 33 verification stages and 112 generated-project
  assertions, with all 51 registry items installed by the real shadcn CLI

### Changed

- `useAction` treats `VALIDATION` and HTTP `422` as terminal failures instead
  of retrying the same invalid input
- `AsyncForm` can run a library-independent validator, pass transformed data to
  its action, focus the first invalid control, and clear nested field errors
- Main-branch verification runs once inside the Pages pipeline; workspace
  writers are process-locked while independent install, build, and browser work
  remains parallel
- Published GET checks use a bounded retry for transient network/429/5xx
  failures without hiding 404s or persistent failures

No v1 registry item name, public export, or semantic token was removed. See the
[v2 migration guide](docs/migration-v2.md) before replacing copied files.

### Responsibility boundary

Authentication, authorization, authoritative server validation, rate limiting,
idempotency, transactions, durable draft storage, and database cursor
correctness remain application/server responsibilities. v2 adds contracts and
adapters at those boundaries; it does not become a backend framework.

## [1.0.0] - 2026-08-20

First Stable release.

### Stable contract

- Registry item names and the public exports copied by those items
- Documented component, hook, action, and transport contracts
- Semantic CSS token names and their accessibility requirements
- The `create-nasu-stack` templates and command-line options, including `--lang`

Breaking changes to this surface wait for the next major release. Source copied
into an application through shadcn belongs to that application and remains free
to edit; Nasu Stack does not silently update it.

### Included

- Layout primitives and four coordinated light/dark themes
- Async action, resource, optimistic update, form, table, select, and toast
  contracts with browser-level regression checks
- Astro, blog, and Vite starter templates
- A versioned GitHub Release asset with checksum and a no-overwrite workflow as the canonical Stable starter
- English and Japanese documentation, catalog entry points, Astro demo routes,
  and language-selected guidance from `create-nasu-stack`
- A release gate covering 29 verification stages and 112 generated-project
  assertions, including real Chromium, npm install/build, and the real shadcn CLI

### Outside the contract

Authentication, authorization, domain validation, rate limiting, bot protection,
idempotency, and rollback of server-side effects remain application/server
responsibilities. See [docs/boundaries.md](docs/boundaries.md) for the complete
boundary.

Stable is not a claim that the software is defect-free or a promise of perpetual
maintenance. It means the responsibility boundary and public surface above can
now be depended on without accepting breaking changes in a minor or patch release.

[2.0.0]: https://github.com/Nasu726/Nasu-Stack/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Nasu726/Nasu-Stack/releases/tag/v1.0.0
