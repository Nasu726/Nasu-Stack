# Nasu Stack — the whole picture

**This describes why things are the way they are, not what was built.** The
second is recoverable by reading the code; the first is lost unless it's
written down.

*[日本語版はこちら](overview.ja.md)*

---

## 1. What this is for

Building for the web by hand gets you the quality you want, but the same parts
cost you time on every project. This takes those parts over so **more of your
time goes into the work that's actually yours.**

More freedom than the visual site builders, a lower first wall than plain Astro
or Next.js. That gap is the target.

### The slogan is a design test

> Keep beginners from being stranded. Don't lock experienced developers in.

"Keep beginners from being stranded" does not mean removing every choice. It
means the first path has a safe default, failures are visible and diagnosable,
and unfamiliar users are not expected to rediscover known pitfalls.

"Don't lock experienced developers in" does not mean avoiding constraints. It
means each constraint states what it protects and leaves a supported way to
step down to a lower layer or plain platform code.

Every design is tested against four things:

| Test | Question |
|---|---|
| Safe default | Can the first path avoid a known, hard-to-diagnose failure? |
| Explicit boundary | Are we clear about what this does **not** guarantee? |
| Escape hatch | Can someone leave the default without replacing the whole stack? |
| Primitive or contract | Are we taking over recurring wiring rather than a domain decision? |

The deciding question is **"whose decision should this be, and where should
Nasu Stack stop?"** The complete ownership map is the public contract in
[`boundaries.md`](boundaries.md).

### Who it's for

| | |
|---|---|
| Primary | Beginners through intermediate developers — **people who can touch code a little** |
| Secondary | Developers who want the freedom |
| Not for | **People who never write code.** That space is already served |

Setting the floor at "can touch code a little" is the single biggest fork in
this design. Including people below it would require a visual editor, and that
is an order of magnitude more project.

### Freedom in stages

> Start easy. Reach into the code once you want to.

This is implemented as **stepping down**, not switching over.

```
<ActionButton action={...}>            ← the layer where you think about nothing
      ↓ once that isn't enough
<Button onClick={...}> + useAction()   ← borrow just the state
      ↓ further
<Button> + useInteractionGuard()       ← prevent overlap only
      ↓ further
useState / useRef                      ← plain React
```

Stopping at any layer leaves you with something that works. Layout has the same
shape:

```
<Stack space="lg">   ← pick from a fixed scale
      ↓
<Box padding={...}>  ← a little finer
      ↓
className="..."      ← plain Tailwind
```

---

## 2. What is taken over, and what is not

### Taken over

The two places beginners reliably get stuck. **They're completely different in
character, so they're handled separately.**

| | The trouble | When it hits |
|---|---|---|
| **Layout** | Can't decide widths, spacing, arrangement | Right after you start |
| **State** | Can't write what happens after the click, after the submit, after the failure | Once it looks right |

The first is the "doesn't move but you can see it" stage; the second is the
"you can see it but it doesn't move" stage. Everyone hits both, so covering
only one doesn't add up to "I can build a site".

### Not taken over

**No purely presentational section libraries.** Heroes, pricing tables,
three-column feature grids — as of 2026 there are more than 2,500 of those on
sale, and building more has no value.

What gets built is **the skeleton and the wiring**: the things that don't show
up visually but break when missing.

- Heading hierarchy (one `h1`, no skipped levels)
- Landmarks (`header` / `main` / `footer` / `nav`) and a skip link
- Images reserving their space before they load
- Everything reachable by keyboard
- Nothing breaking on a narrow screen

### Why that gap exists

The market splits like this:

| | State |
|---|---|
| Presentational components | 2,500+ on sale. **Saturated** |
| Components with behavior | Supabase UI, Convex Components, … **tied to one backend** |
| **In between** | Backend-agnostic, owning only state and wiring → **empty** |

This fills that gap.

---

## 3. The four layers

```
┌─────────────────────────────────────────┐
│  Theme      tokens.css + themes.css     │  color, radius, shadow, type, spacing via data-theme
├─────────────────────────────────────────┤
│  Layout     Stack / Switcher / SidebarLayout │  content-aware. No outer margin
├─────────────────────────────────────────┤
│  Component  ActionButton / AsyncForm / FieldArray │  stateful. Backend-agnostic
│             SiteHeader / Dialog / Tabs  │  ARIA and keyboard are ours
├─────────────────────────────────────────┤
│  Contract   Action / ActionSpec         │  just (input, ctx) => Promise<output>
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

---

## 4. The six ideas the design rests on

### (1) Layout hurts because the options are infinite, not because there's freedom

Choosing spacing, a beginner cannot tell whether `8px` or `12px` is right.
**Dragging things in a visual editor doesn't change that the options are
infinite.** That's why sites built in Wix often still don't look composed.

What works is not changing the input method but **reducing the values you can
pick.** SEEK's Braid Design System got there first, and the principle is one
line:

> A component never carries margin around itself. Spacing is owned entirely by
> layout components.

**This is achievable in plain code, at a fraction of the cost of a visual
editor.** And what comes out is clean code from the start.

### (2) Constraints are defaults, not walls

If only the scale works, you get stuck the first time you want 2px less.

```ts
type Space = SpaceToken | (string & {});
```

Autocomplete offers the nine steps, but `space="13px"` and
`clamp(1rem, 5vw, 4rem)` both work. **Supported by defaults, free to step
outside.** Those two are compatible.

### (3) Always put an escape hatch one level down

The "stepping down" structure above. Stopping at any layer must leave something
that works.

### (4) Works without it. Better with it

Components work without `ActionProvider` (you just lose the notifications).
Without `ConfirmProvider` it falls back to `window.confirm`. **Nothing is a
required dependency, so you can adopt this partially.**

### (5) Never put the same value in two places

**Most of the bugs found during this project came from here.**

| What drifted | What happened |
|---|---|
| Header height vs. anchor scroll offset | Jumping to `#contact` hid the heading behind 64px |
| The tab list, in three places | A new screen never entered the checks and was never tested at 320px |
| Draft exclusion, in three places | When it leaks, **it's your own writing, so you can't notice** |
| Input field classes, in four places | Change the theme and exactly one of them looks wrong |
| Nine missing `registryDependencies` | **Never reproducible in this repo.** It only breaks for the user |

That's why the `create` templates are **generated from the source, not
committed**. With no room to edit by hand, there is nothing to drift.

### (6) If it works without JavaScript, choose that

The narrow-screen menu is `<details>`, not `<dialog>`.

| | `<details>` | Hand-rolled with `useState` |
|---|---|---|
| Opens without JS | yes | no |
| Keyboard | yes | write it yourself |
| Expanded state for screen readers | yes | write it yourself |
| Ctrl+F finds text inside when closed | yes | no |

**Verified by actually opening the pages with JavaScript disabled.**

---

## 5. What exists today

**51 registry items.** Add them individually with
`npx shadcn add Nasu726/Nasu-Stack/<name>`.

| Layer | Contents |
|---|---|
| Theme | `tokens.css` / `themes.css` / `prose.css` / `ThemeProvider` (4 themes, no flash) |
| Layout | Box / Stack / Inline / **Switcher / SidebarLayout** / Columns / Column / Tiles / Spread / ContentBlock / PageBlock / Divider / Section |
| Nav | SiteHeader / NavLink / SkipLink / SiteFooter / **Paginator** |
| Disclosure | Dialog (center, sheet) / Tabs / Disclosure / Accordion / **Popover** / DropdownMenu / NavDropdown |
| Input | AsyncForm (optional Validator + first-error focus) / **FieldArray** (stable key / indexed name / min-max / focus) / Field / SelectField / CheckboxField / CheckboxGroup / RadioGroup / DateField / AsyncSelect / FileDrop / HoneypotField |
| Display | DataList / **LoadMoreList** / DataTable / AsyncBoundary / **ErrorBoundary** / **CopyButton** / Toast / ConfirmDialog / Scrollable / Frame / Img |
| Contract and wiring | Action / ActionSpec / ActionError / **CursorPage / CursorLoader** / **ValidationResult / Validator / validationFailureResponse** / jsonRequest / upload / **createSubmit** |
| Hooks | useAction / useResource / **useCursorList** / useOptimisticList / usePopover / **useInteractionGuard / useAutosave / useCopy** |
| Recipes | **SearchListRecipe** (debounce / stale exclusion / abort / failure / link results; copy and own) |
| Generation | `buildMeta` (SEO, OGP, JSON-LD) / `buildSitemap` / `buildRss` / `buildRobots` |
| Checks | `check-responsive.mjs` (**shipped to users too**) |
| Entry point | `create-nasu-stack` (Astro, blog, and Vite templates) |
| Templates | Landing / about / contact / blog (index, article, RSS, sitemap, 404) |
| Receiver | A Cloudflare Worker example (including the CORS preflight) |

`Tooltip` is intentionally absent from v2. Essential instructions and disabled
reasons stay visible; optional content that must work on touch uses `Popover`.
The measured rationale and the lower-level escape hatch are recorded in
[`boundaries.md`](boundaries.md#tooltip-is-not-a-v2-public-primitive).

---

## 6. How the checks are thought about

`pnpm verify` is 33 stages; `pnpm verify:create` is 112 assertions. It looks
like a lot. There's a reason.

### A check that only prints is not a check

For a while, 86 measurements were all `log()`. They printed numbers, and
**`pnpm verify` stayed green when things broke.** Every bug found until then
was found by a human reading that output.

**Anything that depends on a human reading 80+ lines of numbers every time
falls apart as the component count grows.**

### What becomes an assertion, and what doesn't

| | Treatment |
|---|---|
| Properties that matter when broken (tap target ≥ 24px, roles, focus restore) | assert |
| Values determined by tokens (which spacing step, body measure) | assert |
| Values that change with arrangement (absolute coordinates) | **no.** Assert the relationship — moved / didn't move |

Assertions that are too strict fail on unrelated changes, and eventually nobody
looks at them.

### Adding an assertion doesn't tell you it can fail

**Break it on purpose and confirm.**

| What was broken | Result |
|---|---|
| Set every `Tabs` tabIndex to 0 | ✓ only the roving-tabindex assertion failed |
| Reverted `formDataToObject` to `Object.fromEntries` | ✓ only the two multi-value assertions failed |
| Removed `min-h-11` from `NavLink` | **✗ nothing failed** |

The third one exposed a hole in the check itself. The WCAG inline exception was
written as `display.startsWith("inline")`, which also excluded nav links
(`inline-flex`). Without this step, the hole would still be there.

### Produce the state and measure it — don't infer it

- Do images reserve space? → **block image loading** and measure
  (inferring from attributes detected zero cases on a fast machine)
- Does the background stay put? → send **wheel input**, not `window.scrollBy`
  (the latter is programmatic and works even with `overflow: hidden`)
- Was the form really submitted? → **stand up a receiver and look at what arrived**
- Does the generated template work? → **install → build → serve → real browser**

---

## 7. Rules that came from actual mistakes

| Rule | What prompted it |
|---|---|
| If the screen switches by tab or branch, the checks must switch too | "the check passes" and "it's in the check's scope" are different things |
| Cross-check `registryDependencies` mechanically | Never reproducible locally; breaks only at the user |
| Never degrade silently | When the sitemap can't be fetched, print why — otherwise you "covered everything" |
| `.astro` props only take JSON-able values | No elements, no functions. Same reason for `ActionSpec` and `brandHref` |
| `w-full` does nothing inside a table | Column width comes from content, so it's circular. Use `min-width` |
| Passing `new AbortController().signal` is pretend-abortable | It means nothing unless someone calls `abort()` |
| Flex children are `min-width: auto`. `min-w-0` to shrink | **Hit three times** (Inline, tables, header) |
| Never assert something false | A CORS failure is indistinguishable from a dropped connection, so say both |

---

## 8. What's next

| | |
|---|---|
| v0.9 | Static registry hosting / catalog as a docs site / Renovate |
| After | Dashboard template / live validation for `Field` / auth and billing adapters |
| Not for now | **Visual editing.** The audience floor is "can touch code a little". If it ever happens, it comes after the constrained components exist, as a UI that picks from limited options |

### Still unverified

- **The 404 status.** Some static hosts serve `404.html` with a 200. Measured
  on the live deployment every time (`verify-published.mjs` prints the value)
- **How this feels to people who aren't the author.** The catalog and demo have
  been reviewed on real devices, and outside review has run twice, but nobody
  has yet started a project with it and reported back
