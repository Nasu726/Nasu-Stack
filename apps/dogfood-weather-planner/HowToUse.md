# How to use Weather Planner

Run all commands in this guide from the root of the Weather Planner project—the
directory containing `package.json`.

## 1. Start the app

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173/>. The environment file is optional with the supplied
Tokyo defaults, but copying it makes the public configuration explicit.

This template includes the `package-lock.json` that Nasu Stack verified. Keep it
in git and commit the lockfile after `npm install`, whether npm leaves it unchanged
or you deliberately update the dependency tree.

## 2. Choose the initial place

Edit `.env`:

```dotenv
VITE_DEFAULT_LATITUDE=51.5072
VITE_DEFAULT_LONGITUDE=-0.1276
VITE_DEFAULT_LOCATION=London
VITE_DEFAULT_COUNTRY=United Kingdom
VITE_DEFAULT_LOCALE=en-GB
```

Restart the development server after changing `.env`. Visitors can still search
for a different place in the app.

Every `VITE_*` value is readable in the built JavaScript. Coordinates, labels,
locale, and a public API URL are suitable. API keys, tokens, passwords, private
account IDs, and provider credentials are not.

## 3. Understand the free API boundary

The default Open-Meteo endpoints require no account or key for qualifying
non-commercial use. The free service has usage limits and no uptime guarantee,
and the displayed data requires attribution. Keep the visible “Weather data by
Open-Meteo.com” link when using that provider.

For a commercial product, use a suitable commercial or self-hosted service. If a
provider needs a secret, call it from your server and expose only your own public
endpoint to this app. Do not put the secret in `VITE_WEATHER_API_URL` or another
browser variable.

- Terms: <https://open-meteo.com/en/terms>
- Licence: <https://open-meteo.com/en/license>

## 4. Edit the product

- `src/App.tsx`: page composition, day cards, plan controls, and visible copy.
- `src/lib/config.ts`: public environment validation and safe defaults.
- `src/lib/weather.ts`: API requests and fail-closed response parsing.
- `src/lib/planner.ts`: local draft schema, restore, and save action.
- `src/hooks/use-autosave.ts`: copy-owned autosave queue.
- `src/components/ui/async-select.tsx`: copy-owned searchable selector.
- `src/styles/tokens.css` and `src/styles/themes.css`: design tokens and tones.

The app fixes its tone in code with `data-theme="vivid"` and
`defaultTheme="vivid"`. Visitors do not need a theme picker. Change both values
to `neutral`, `warm`, or `editorial` if another tone fits your product.

## 5. Change storage deliberately

The included save action writes one versioned draft to `localStorage`. It does
not promise cross-device sync, user accounts, version conflict resolution,
server acknowledgement, or offline forecast access.

To add real server persistence, replace `savePlannerDraft` with an `Action` that
calls your own receiver. Keep `ctx.signal` attached to requests, define your
conflict and idempotency rules on the server, and do not claim success until that
server confirms it.

## 6. Verify before deployment

```bash
npm run verify
```

The check uses local fixtures rather than the live provider. A live API outage
must not make a known-good source release fail, and a fixture must not hide an
invalid response parser.

For a production build:

```bash
npm run build
npm run preview
```

Deploy `dist/` to any static host. Set the same public environment values in the
host's build settings. The plan remains browser-local unless you deliberately
replace the save action with a server boundary.
