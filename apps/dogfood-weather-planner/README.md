# Weather Planner

[日本語](./README.ja.md)

A seven-day weather planner and a state-heavy Nasu Stack dogfood app. Search for
a place, inspect the forecast, attach a lightweight plan to each day, and reload
the page without losing the latest saved draft.

This app lives in `apps/dogfood-weather-planner` and is also distributed as the
`weather-planner` CLI template. It uses copy-owned registry source installed
through the public shadcn route; it does not import Nasu Stack through a
workspace alias. The template is generated from this tested directory, so the
live example and the files users receive cannot silently drift apart.

## Is it free?

Yes for local development, this example, and qualifying non-commercial use. The
default endpoints require no account, API key, or credit card. Open-Meteo's free
API is limited to non-commercial use and currently allows up to 10,000 requests
per day. Attribution is required. Commercial products must use an appropriate
commercial or self-hosted service; keep provider credentials on a server, never
in a `VITE_*` value.

- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [Open-Meteo data licence](https://open-meteo.com/en/license)

## Start locally

Run these commands from the root of this app directory:

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173/>. The provided values show Tokyo immediately, so
copying `.env.example` is optional unless you want a different starting place or
API endpoint.

## What it exercises

- `AsyncSelect`: debounced place search, abort, stale-result protection, keyboard
  selection, and viewport-aware suggestions.
- `useResource`: forecast loading, retry, dependency changes, and stale response
  isolation.
- `useAutosave`: one active save plus one latest queued value, with visible dirty,
  saving, saved, and error states.
- `Popover`: forecast details and a focused plan-clearing action.
- `ErrorBoundary`: render failures stay inside the forecast section.
- Layout primitives: a wide responsive card composition from 320px through large
  desktop widths.

Forecast and geocoding responses cross a runtime boundary as `unknown` and are
validated before React receives them. A malformed or failed response is shown as
a retryable error; it is never treated as a valid forecast.

## Public configuration

| Variable | Default | Responsibility |
|---|---|---|
| `VITE_WEATHER_API_URL` | `https://api.open-meteo.com/` | Public forecast endpoint |
| `VITE_GEOCODING_API_URL` | `https://geocoding-api.open-meteo.com/` | Public place-search endpoint |
| `VITE_DEFAULT_LATITUDE` | `35.6762` | Public starting latitude |
| `VITE_DEFAULT_LONGITUDE` | `139.6503` | Public starting longitude |
| `VITE_DEFAULT_LOCATION` | `Tokyo` | Initial display label |
| `VITE_DEFAULT_COUNTRY` | `Japan` | Initial country label |
| `VITE_DEFAULT_LOCALE` | `en` | Date, number, and search-result locale |

Only HTTPS endpoints are accepted, except localhost fixture URLs used by tests.
Credentials, query strings, and fragments are rejected at startup.

## Storage boundary

Plans are saved to this browser's `localStorage`. That gives reload recovery, not
cross-device sync, authenticated storage, version conflict handling, or offline
weather data. Those are application/server responsibilities and are deliberately
not simulated by the template.

## Verify

```bash
npm run verify
```

The verifier builds the app, uses a deterministic local weather service, drives
Chromium by keyboard and pointer, tests retry and autosave recovery, reloads the
stored draft, and checks 320 / 375 / 414 / 768 / 1024 / 1920px layouts without
depending on Open-Meteo's availability.

See [HowToUse.md](./HowToUse.md) for the editing and deployment guide.
