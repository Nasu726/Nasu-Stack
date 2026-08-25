# Nasu Stack

**Spacing you don't have to decide. State you don't have to write.**

Components and starter templates for React and Astro. Not another set of
pretty-but-empty components — these take over the two things beginners
reliably get stuck on: **layout** and **async state**.

*[日本語版はこちら](README.ja.md)*

```tsx
<Stack space="lg">
  <Hero />
  {/* Hand it one function. Loading, failure, and double-click are handled. */}
  <ActionButton action={() => api.save(form)}>Save</ActionButton>
</Stack>
```

**See it first:** [component catalog](https://nasu726.github.io/Nasu-Stack/catalog/) (every component, live) /
[demo site](https://nasu726.github.io/Nasu-Stack/demo/) (a site built from them)

> **Nasu Stack 1.0 is Stable.** Public registry names, exports, tokens, and the
> documented component contracts now follow semantic versioning: breaking
> changes wait for the next major release. Stable does not expand the boundary —
> **authentication, server-side validation, and rate limiting for the contact
> receiver are still your application's responsibility.**
> Read [docs/boundaries.md](docs/boundaries.md) once before you ship.

---

## Getting started

### Start a new project

One command. It asks for your language first, then how you want to start.

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v1.0.0/create-nasu-stack-1.0.0.tgz my-site
```

The versioned GitHub Release URL is the Stable entry point. Each release gets a
new URL, so npm/npx cannot reuse an older release cached under the same command.

#### Start from scratch

**For people who want to build it themselves.** You get the foundation and the
theme; the content is yours.

| Choice | |
|---|---|
| `astro` | A static site with **a single page**. Make the interactive parts React islands |
| `vite` | A React app. For admin panels and tools, where the screen itself is the product |

#### Start from a template

**For people who would rather delete than write from nothing.**

| Choice | |
|---|---|
| `blog` | Comes with a **blog, landing page, about, contact, RSS, sitemap, and 404** |

The [demo site](https://nasu726.github.io/Nasu-Stack/demo/) is exactly this, so
**you can look before you choose.**

The setup asks for **English or Japanese first**, then **From scratch or Use a
template**. Its terminal messages, `README.md`, `HowToUse.md`, and environment
variable guidance use the selected language.

Add `--lang en --template <kind> --yes` to skip the prompts. Use `--lang ja`
for Japanese guidance.

> **Not published to npm.** This is a personal project and I can't promise
> ongoing maintenance, so I don't want to hold an npm name. `npx` takes a
> tarball URL directly, which does the same job.
> **Do not type `npx create-nasu-stack`** — that name is unclaimed on npm and is
> not mine ([docs/security.md](docs/security.md)).

### Add components to a project you already have

Nothing is installed as an npm package. **The code is copied into your
repository**, so you can edit it freely. That's the point.

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/action-button
```

**That's it — no configuration.** No `components.json` entry, no registry
setup. The dependencies (`use-action`, `spinner`, `utils`, `tokens`, …) come
along automatically — 10 files for `action-button`.

<details>
<summary>Prefer the shorter <code>@nasu/…</code> form?</summary>

Register the namespace once, then use the short name everywhere:

```bash
npx shadcn@4.17.0 registry add "@nasu=https://nasu726.github.io/Nasu-Stack/r/{name}.json"
npx shadcn@4.17.0 add @nasu/action-button
```

This also enables `shadcn search @nasu` and lets you point the namespace at a
fork or mirror. Without the registration you'll get
`Unknown registry "@nasu"`.

Note that passing a bare item URL
(`npx shadcn add https://…/r/action-button.json`) **installs nothing** — it
stops before it can resolve the dependencies. That's measured, not assumed.

</details>

> **The pinned version is deliberate.** Running the newest release
> straight from the internet skips your lockfile and any cooling-off period.
> The version above is the one this project's own checks actually ran.

### Apply the theme

```css
/* src/index.css */
@import "./styles/tokens.css";   /* foundation + default theme. Enough on its own */
@import "./styles/themes.css";   /* three extra themes. Skip it if you don't need them */
```

```html
<html data-theme="warm" class="dark"></html>
```

Four themes: `neutral`, `warm`, `editorial`, `vivid`. Each changes more than
color — **corner radius, shadow strength, typeface, letter spacing, and the
size of the spacing scale** move together, so nothing looks bolted on. Drop in
`ThemeSwitcher` if you want a toggle.

To make your own, override the variables from `tokens.css` under a different
selector:

```css
[data-theme="mybrand"] {
  --bg: oklch(0.99 0 0);
  --fg: oklch(0.2 0 0);
  --primary: oklch(0.55 0.2 150);
  --primary-fg: oklch(0.99 0 0);
  /* …see the :root block in tokens.css for the full list (25 variables) */

  --radius: 0.5rem;                   /* corner radius */
  --font-display: "Your Font", serif; /* headings */
  --space-3xl: 8rem;                  /* spacing is part of the theme too */
}
[data-theme="mybrand"].dark { /* dark variant */ }
```

Skip `themes.css` entirely and you're left with `neutral` plus your own.

---

## What this is for

Building for the web by hand gets you the quality you want, but the same parts
cost you time on every project. This takes those parts over so **more of your
time goes into the work that's actually yours.**

More freedom than the visual site builders, a lower first wall than plain Astro
or Next.js. That gap is the target.

### Who it's for

| | |
|---|---|
| Primary | Beginners through intermediate developers — **people who can touch code a little** |
| Secondary | Developers who want the freedom |
| Not for | **People who never write code.** That space is already served |

Setting the floor at "can touch code a little" is the single biggest fork in
this design. Including people below it would require a visual editor, and that
is an order of magnitude more project.

### Design commitments

1. **Never lock in a backend.** fetch, Supabase, Convex — anything you can
   shape into `(input, ctx) => Promise<output>` plugs in.
2. **Always leave an escape hatch.** Every layer can drop one level down. Not
   "switch to something else" — **step down**, in place.

   ```
   <ActionButton action={…}>  →  <Button> + useAction()
                              →  <Button> + useInteractionGuard()  →  plain React
   <Stack space="lg">         →  <Stack space="13px">    →  className="gap-[13px]"
   ```

3. **One error type, always.** Whatever gets thrown becomes an `ActionError`,
   so the display side never has to branch on shape.
4. **No purely presentational components.** Heroes and pricing tables already
   exist by the thousand in the shadcn block market. What's built here is
   **things that hold state** and **layout constraints** — nothing else.
5. **Accessibility by default.** Never bolted on afterwards.

### The four layers

```
┌─────────────────────────────────────────┐
│  Theme      tokens.css + themes.css     │  ← color, radius, shadow, type, spacing via data-theme
├─────────────────────────────────────────┤
│  Layout     Stack / Switcher / SidebarLayout │  ← content-aware. No outer margin
├─────────────────────────────────────────┤
│  Component  ActionButton / AsyncForm / FieldArray │  ← stateful. Backend-agnostic
│             SiteHeader / Dialog / Tabs  │  ← nav and disclosure. ARIA and keys are ours
├─────────────────────────────────────────┤
│  Contract   Action / ActionSpec         │  ← just (input, ctx) => Promise<output>
└─────────────────────────────────────────┘
                    ↕
        your API / Supabase / Convex / whatever
```

In practice the only contract you have to learn is this:

```ts
type Action<TInput, TOutput> = (
  input: TInput,
  ctx: { signal: AbortSignal },
) => Promise<TOutput>;
```

The reasoning behind each decision is in [docs/overview.md](docs/overview.md).

---

## What's in it

### State — what one line of `ActionButton` covers

- Spinner and disabled button while it runs
- Double-submit prevention
- Error message on failure, re-run on the next press
- Checkmark on success, automatic reset a few seconds later
- Request abort on unmount (`ctx.signal`)
- `aria-busy` / `role="status"` / `role="alert"`

| Name | What it does for you |
|---|---|
| `ActionButton` | Four-state button from one function. Double-click guard, confirm dialog, retry |
| `AsyncForm` + `Field` | A whole form from one submit function. Optional validation, transformed data, field focus, and errors that clear themselves |
| `ValidationResult` / `Validator` | Library-independent success / field / form result shared by client and server; it does not define your rules |
| `FieldArray` | Stable repeated fields with indexed names, min/max controls, and add/remove focus; no reorder or domain rules |
| `DataList` | Fetch, skeleton, empty, failure, and retry in a single component |
| `AsyncBoundary` | Wraps the loading / error / empty / loaded fork |
| `ErrorBoundary` | Contains React render failures to one subtree with an accessible fallback and reset; async errors stay separate |
| `Popover` | Non-modal supporting content with controlled/uncontrolled state, Escape/outside dismissal, focus return, and viewport-edge positioning; content semantics stay yours |
| `DataTable` | Sorting and paging. **Below tablet width it becomes one card per row** |
| `AsyncSelect` | Searchable select. Cancels the previous request. Keyboard support included |
| `FileDrop` | Drag and drop, progress, retry only what failed |
| `ConfirmDialog` / `useConfirm` | Confirmation on native `<dialog>` |
| `ActionProvider` | A net so a forgotten error handler doesn't swallow the failure |
| `Toast` / `useToast` | Corner notifications |
| `ThemeProvider` / `ThemeSwitcher` | Theme switching, with a no-flash init script |
| `useAction` / `useResource` | State hooks for writes and for reads |
| `useInteractionGuard` | Prevents only overlapping UI attempts; the caller decides when to allow another |
| `useAutosave` | Debounces and coalesces saves, keeps stale responses out of state; conflict resolution stays on the server |
| `Switcher` / `SidebarLayout` | CSS-only layouts that stack when their content widths no longer fit |

The [validation contract guide](docs/validation.md) shows the `AsyncForm`,
server `Response`, and optional schema-library adapter paths together.
The [FieldArray guide](docs/field-array.md) covers nested paths, UI keys,
focus, reset, and the lower-level `fieldArrayItemName()` path.
Render-failure recovery and autosave queue boundaries are in the
[ErrorBoundary](docs/error-boundary.md) and [useAutosave](docs/autosave.md)
guides. The [Popover guide](docs/popover.md) explains its neutral semantics,
focus behavior, viewport placement, and intentional no-portal boundary.

<details>
<summary><b>DataTable — stop being a table when the screen is narrow</b></summary>

An eight-column table at 320px is unusable even with horizontal scroll. So
**below tablet width each row becomes a card**, with the column name attached
to every value.

```tsx
<DataTable
  rows={rows}                    // pass an array and it sorts and pages in memory
  columns={[
    { key: "date",  label: "Date", sortable: true },
    { key: "owner", label: "Owner", hideOnCard: true },  // dropped in card view
    { key: "amount", label: "Amount", sortable: true, align: "end" },
  ]}
  pageSize={5}
/>
```

`label` is required because **in card view the column name is the only clue
left.** To handle it server-side, pass a `loader` that returns
`{ rows, total }`.

</details>

<details>
<summary><b>FileDrop — why XHR</b></summary>

**`fetch` cannot report upload progress.** Still true in 2026. What a request
stream can measure is the moment the browser pulled data from your stream, not
the moment it reached the server.

So internally it uses `XMLHttpRequest` — but `uploadWithProgress` hides that,
and you never write XHR yourself.

```tsx
<FileDrop
  action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)}
  accept="image/*"
  maxSize={5 * 1024 * 1024}
/>
```

**One file at a time.** Sending them together means one failure costs you the
whole batch. With per-file state, "retry only what failed" falls out naturally.

`accept` and `maxSize` are **guidance for the person using the form, not a
defense** ([docs/boundaries.md](docs/boundaries.md)).

</details>

<details>
<summary><b>ActionProvider — a net for what you forgot</b></summary>

Put it once at the outside of your app. **Everything works without it.**

```tsx
<ActionProvider>
  <App />
</ActionProvider>
```

With it, an action that fails without an `onError` shows a corner notification.
That's the mistake beginners make most, and it's the one where the failure
disappears silently.

It stays quiet when the error is already visible on screen, so you never get it
twice.

| Situation | What shows |
|---|---|
| You wrote `onError` | Only what you wrote |
| `ActionButton` (`showError` defaults to true) | Red text under the button. No notification |
| `ActionButton showError={false}` | Corner notification |
| `AsyncForm` field errors (`fields` present) | Under each input. No notification |
| `AsyncForm` network or server failure | Corner notification |

</details>

### Layout — decide less, without being fenced in

People don't get stuck on layout because there's too much freedom. They get
stuck because **the options are infinite.** `8px` or `12px` is not a decision
you can make without experience.

So **the default path is nine steps.** That's all autocomplete offers you.

```
none   2xs   xs    sm    md    lg    xl    2xl   3xl
 0      4     8    12    16    24    40    64    96   (px, neutral theme)
```

**It is not a wall.** Values outside the scale work exactly as written — the
same relationship Tailwind has between `p-4` and `p-[13px]`.

```tsx
<Stack space="lg" />                        {/* recommended. autocomplete works */}
<Stack space="13px" />                      {/* off-scale value */}
<Stack space="clamp(1rem, 4vw, 3rem)" />    {/* expressions too */}
<Stack space={{ mobile: "sm", tablet: "3rem" }} />  {/* and mixtures */}

<Column width="1/3" />          <Column width="18rem" />
<ContentBlock width="prose" />  <ContentBlock width="52rem" />
<Tiles columns={{ tablet: 3 }} />
<Tiles columns="repeat(auto-fill, minmax(14rem, 1fr))" />
```

And there is exactly one rule:

> **A component never carries margin around itself. Spacing belongs to layout
> components alone.**

That's what stops "why is the gap bigger only here".

```tsx
<PageBlock>                        {/* max width + side padding */}
  <Stack space="3xl">              {/* stack vertically */}
    <Section>
      <Spread>                     {/* push to both edges */}
        <Logo /> <Nav />
      </Spread>
    </Section>

    <Columns space="lg">           {/* columns. Folds to a stack when narrow */}
      <Column width="1/3"><Side /></Column>
      <Column><Article /></Column>
    </Columns>

    <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="md">
      {items.map((i) => <Card key={i.id} />)}
    </Tiles>
  </Stack>
</PageBlock>
```

| Component | Role |
|---|---|
| `PageBlock` | The page frame. Max width plus side padding |
| `ContentBlock` | Max width only (use `width="prose"` for body text) |
| `Section` | One region of a page. Keeps the vertical rhythm consistent |
| `Stack` | Stack vertically at an even interval (the one you'll use most) |
| `Inline` | Lay out horizontally and wrap (`wrap={false}` scrolls instead) |
| `Columns` / `Column` | Columns. Folds to a stack below tablet width by default |
| `Tiles` | Even grid. Doesn't break on an awkward number of items |
| `Spread` | Push to both edges |
| `Box` | Inner padding, background, radius, shadow |
| `Scrollable` | Scroll just this part instead of squashing a table or code block |
| `Divider` | A rule |

Use `width="prose"` for body text. **It's in `em`, so it follows the font
size** — smaller text gets a narrower measure, and the number of characters per
line stays constant.

### Screen width — not breaking, and being able to prove it

Almost every broken mobile layout comes from content that won't shrink. The
theme absorbs that, so you don't have to know `overflow-wrap` exists.

```css
body { overflow-wrap: break-word; }          /* long URLs and unbreakable words */
img, video, svg, iframe { max-width: 100%; } /* oversized media */
pre { overflow-x: auto; }                    /* code scrolls instead of wrapping */
.wt-gap > * { min-width: 0; }                /* let flex/grid children shrink */

@media (pointer: coarse) {                   /* big enough to hit with a finger */
  button, select, input, textarea { min-block-size: 2.75rem; }
}
```

Inputs are always at least 16px. Below that, **iOS Safari zooms the page the
moment you touch the field** and only the user can zoom back out. It happens on
iPad too, so "only on narrow screens" doesn't prevent it.

Content that becomes unreadable when squashed — tables, code — scrolls in place
instead (`<Scrollable label="Sales">`). A shadow marks the cut-off edge, and it
is reachable by keyboard alone.

**And you can prove none of it is broken.**

```bash
npm run check -- http://localhost:5173
```

It opens a real browser at 320 / 375 / 414 / 768 / 1024px and measures. It
exits 1 when something is broken, so it drops straight into CI.

```
  ✗ http://localhost:5173  @ 320
      577px of horizontal overflow
        ↳ <p class="…"> extends 577px past the edge  "https://example.com/very/long…"
        → wrap long strings with overflow-wrap; wrap tables and code in <Scrollable>
      inputs under 16px: 3 (name=14px, email=14px, password=14px)
        → iOS zooms the page the moment these are focused
      tap targets under 24px: 2 (a 43x20 "Works", a 54x20 "Contact")
        → hard to hit, and below the WCAG 2.1 AA minimum
```

It detects: horizontal overflow and the element causing it / tap targets under
24px / inputs under 16px / elements that won't shrink below the viewport /
body text whose measure is too long.

The line-length threshold **differs for Japanese and Latin text**. A Japanese
character is roughly 1em, a Latin one averages about 0.5em, so the same pixel
width reads twice as long.

### Astro works too

Static pages in Astro, React islands only where things move.

**One catch**: you **cannot pass a function** from `.astro` into a
`client:load` island — props are serialized to JSON. So there's a declarative
form for everything that would otherwise need a callback.

```astro
---
import { DataList } from "@/ui/data-list";
---
<DataList client:load
  loader={{ url: "/api/works", method: "GET" }}
  columns={[
    { key: "title", primary: true },
    { key: "year", badge: true },
  ]} />
```

Islands that need their own logic get wrapped in a `.tsx` first — see
[`apps/site/src/components/ContactForm.tsx`](apps/site/src/components/ContactForm.tsx).
More in [docs/astro-and-react.md](docs/astro-and-react.md).

---

## More

| | |
|---|---|
| [docs/overview.md](docs/overview.md) | The whole picture, and why each decision went that way |
| [docs/boundaries.md](docs/boundaries.md) | **What is covered and what is not** (read before you ship) |
| [docs/security.md](docs/security.md) | How this is distributed, and why that's safe |
| [docs/development.md](docs/development.md) | Working on this repository (Japanese) |
| [docs/rename.md](docs/rename.md) | Why it was renamed from `WebTemplate` (Japanese) |

**Records written before v0.9e (`docs/plan-*`, `docs/result-*`, `ROADMAP.md`)
still say `WebTemplate`.** They're records of the time and haven't been
rewritten. They are in Japanese.

This is a personal project. Maintenance and response times are not promised
([SECURITY.md](SECURITY.md)).

## License

MIT
