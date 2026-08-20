# Changelog

All notable changes to Nasu Stack are recorded here. The project follows
[Semantic Versioning](https://semver.org/) for the Stable contract described
below.

## [1.0.0] - 2026-08-20

First Stable release.

### Stable contract

- Registry item names and the public exports copied by those items
- Documented component, hook, action, and transport contracts
- Semantic CSS token names and their accessibility requirements
- The existing `create-nasu-stack` templates and command-line options

Breaking changes to this surface wait for the next major release. Source copied
into an application through shadcn belongs to that application and remains free
to edit; Nasu Stack does not silently update it.

### Included

- Layout primitives and four coordinated light/dark themes
- Async action, resource, optimistic update, form, table, select, and toast
  contracts with browser-level regression checks
- Astro, blog, and Vite starter templates
- English and Japanese documentation, catalog entry points, and Astro demo routes
- A release gate covering 29 verification stages and 106 generated-project
  assertions, including real Chromium, npm install/build, and the real shadcn CLI

### Outside the contract

Authentication, authorization, domain validation, rate limiting, bot protection,
idempotency, and rollback of server-side effects remain application/server
responsibilities. See [docs/boundaries.md](docs/boundaries.md) for the complete
boundary.

Stable is not a claim that the software is defect-free or a promise of perpetual
maintenance. It means the responsibility boundary and public surface above can
now be depended on without accepting breaking changes in a minor or patch release.

[1.0.0]: https://github.com/Nasu726/Nasu-Stack/releases/tag/v1.0.0
