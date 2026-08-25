# Responsibility boundaries

**Nasu Stack keeps beginners from being stranded without locking experienced
developers in.** It turns decisions that recur in web development into safe
defaults, explicit constraints, and small primitives. It does not make every
decision on behalf of the application.

This document is the public contract for where Nasu Stack's responsibility
ends. When a feature is proposed, the first question is:

> Whose decision is this, and where must Nasu Stack stop deciding?

*[日本語版はこちら](boundaries.ja.md)*

## The four rules

1. **Safe by default.** The first path should not fail in a way that an
   unfamiliar user cannot diagnose.
2. **Explicit boundary.** A client-side convenience is never described as a
   server-side guarantee.
3. **Escape hatch.** A default may guide you, but it must not trap you. Step
   down from a component to a hook, or from a hook to plain React and browser
   APIs.
4. **Reusable primitive or contract.** Nasu Stack owns recurring wiring, not
   the application's business decisions.

These rules apply together. A safe default without an escape hatch becomes a
lock. An escape hatch without a safe default leaves beginners to rediscover
the same failures.

## Complexity has a budget too

Even safe features strand beginners when they introduce too many names,
states, and settings. Before adding a component, Nasu Stack chooses the lowest
layer that can solve the problem.

| Problem | First choice |
|---|---|
| Semantics and interactions the browser already owns | Native HTML |
| Value conversion or a result shape | Pure function or contract |
| One behavior such as duplicate-activation prevention | Small hook |
| State inseparable from presentation, focus, and ARIA | Component |
| A safe composition of several primitives | Copy-and-own recipe |
| Authentication, transactions, and business workflow | Application or server |

A new name is added only when the behavior cannot fit an existing item and the
decisions removed outweigh the concept users must learn. Preventing only a
double click, for example, must not require a complete async state machine with
retry, success presentation, and an `AbortSignal`. Conversely, stale network
responses and unmount safety must not be presented as if a time-based guard
provided those guarantees.

When a high-level component starts growing a large API, Nasu Stack first splits
the concern into a hook, contract, or recipe. A recipe is a safe composition to
copy and own, not a new framework or a sealed finished product.

## Who owns each decision

| Area | Nasu Stack owns | Your app or domain owns | Your server or infrastructure owns |
|---|---|---|---|
| Shipped source | The documented behavior, types, dependencies, and checks of each registry item | Which items to copy, how to compose them, and the behavior of any modified copy | Deployment and runtime compatibility |
| Layout and accessibility | Responsive defaults and the component's semantics, focus, keyboard, and screen-reader behavior | Content, labels, heading order across the page, and whether a chosen composition makes sense | Any platform-specific rendering or assistive-technology policy |
| Async UI state | Loading, success, failure, double-submit protection, passing an abort signal, and preventing a cancelled or stale result from returning to the UI | What success means, which message to show, and whether the user should be offered cancellation | Whether work can actually be cancelled, rolled back, or committed atomically |
| Re-entrant interaction | Preventing the same UI operation from overlapping within the selected primitive's documented contract | Which operations may repeat and when to enable them again | Idempotency, deduplication, and treating side effects as one operation |
| Input and data | Browser-side guidance and runtime checks for Nasu Stack's own public contracts | Domain rules and the shape you expect from an API | Authentication, authorization, authoritative validation, CSRF protection, and response schemas |
| Repeated fields | Stable UI identity, indexed names, min/max controls, and focus after add/remove | Row content, persistent IDs, ordering, and array domain rules | Authoritative cardinality, uniqueness, authorization, and database constraints |
| Render failure | Containing a descendant React render failure, an accessible fallback, reset, and a reporting callback boundary | Fallback wording, recovery conditions, redaction, support IDs, and errors outside the boundary | Error collection, alerting, retention, and incident response |
| Autosave | Debounce, one in-flight save, one latest queued value, stale UI prevention, and unmount abort signaling | Editor state, status wording, durable local drafts, navigation guards, and conflict UX | Authorization, version conflicts, idempotency, atomic writes, and durable storage |
| JSON transport | Treating an empty successful response as empty, accepting JSON media types, and failing closed on malformed or non-JSON bodies | Mapping a parsed value into a domain type, or using a different transport helper | Correct status codes, media types, response bodies, and safe error reporting |
| Retry | A bounded retry mechanism and a controlled failure when retry policy code is invalid | Opting in only when repeating the operation is safe | Idempotency, deduplication, transaction handling, and rate limits |
| Uploads | Immediate browser feedback about the selected file | Product limits and the experience after acceptance or rejection | Size and type enforcement, magic-byte inspection, malware handling, storage, and authorization |
| Example receivers | A small, fail-closed integration example and its documented limitations | Adapting the example to the application's fields and provider | Production authentication, authorization, rate limiting, bot protection, logging, and secret management |

Nasu Stack is responsible for the registry source it ships. Because shadcn
copies that source into your repository, **a modified copy belongs to your
application**. You can change anything; the changed behavior is then outside
the guarantees of the original item.

## What the contracts mean

### Cancellation prevents stale UI, not server-side work

An `Action` receives an `AbortSignal`. Nasu Stack aborts that signal when it
owns the cancellation and ignores a result from an operation that has already
been cancelled or superseded.

That does **not** prove that the request stopped, undo a database write, recall
an email, or roll back a payment. The server must implement those semantics.
Treat abort as a request to stop, not proof that nothing happened.

### `jsonRequest` validates the transport, not your domain

`jsonRequest` accepts an empty `204`, `205`, or empty successful body as
`undefined`. A non-empty successful body must use `application/json` or an
`application/*+json` media type and contain valid JSON; otherwise it fails
closed with `BAD_RESPONSE`.

Parsing JSON only establishes that it is JSON. It does not establish that the
value is the object your application expects. Validate untrusted response
values at the boundary where your domain starts. If the endpoint intentionally
returns text, use `fetch` or a purpose-built helper instead.

### Browser validation is feedback, not authority

Fields, `FileDrop`, and the form helpers can give immediate feedback and keep
invalid data from being submitted accidentally. A caller can bypass all of
them. The server remains authoritative for every value and permission.

### A validation result carries a decision; it does not make one

`ValidationResult` / `Validator` standardize how parsed data, field errors, and
form errors cross the client / server boundary. `runValidation` checks that
Nasu Stack's own public result shape is well formed, and
`validationFailureResponse` adapts a failure to the existing form transport.

They do not decide which email is valid, whether a user may edit a record, or
whether a value is unique. The application chooses a schema library and owns
domain rules. The server reruns every authoritative check even when the same
validator already gave browser feedback. Authentication, authorization, CSRF,
rate limits, database constraints, and response schemas remain server work.

### A FieldArray key is not a record identity

`FieldArray` keeps a browser row stable while neighboring indexes change. Its
key is intentionally not submitted and does not survive a reload. The app owns
real record IDs and ordering; the server rechecks cardinality, uniqueness,
authorization, and database constraints. Client `min` / `max` only prevent an
awkward UI action. Reorder is outside this primitive because it needs its own
keyboard, announcement, persistence, and conflict contract.

### Render failure and asynchronous failure stay separate

`ErrorBoundary` catches a descendant failure while React is rendering that
subtree. It does not catch event handlers, rejected promises, effects, timers,
Server Components, or server rendering. Those paths have different recovery
and reporting contracts and must not be relabeled as `ActionError` merely to
fit one component.

The default fallback preserves an accessible retry path. The application owns
whether retrying makes sense, which details are safe to show, and how a report
reaches monitoring. A custom fallback is an escape hatch and therefore owns
its own semantics and focus behavior.

### Autosave schedules writes; it does not resolve them

`useAutosave` prevents rapid edits from becoming a request per keystroke,
coalesces waiting values to the latest one, and refuses to let an old response
replace the latest client state. It does not make two edits compatible, make a
write idempotent, or decide whose version wins.

It also does not silently persist arbitrary form values to `localStorage`.
Durable drafts introduce privacy, retention, encryption, migration, offline,
and cross-tab decisions that belong to the application. `cancel()` asks the
transport to abort and ignores the result; as with every `AbortSignal`, that is
not proof that the server rolled back the write.

### A Popover owns disclosure mechanics, not content semantics

`Popover` owns controlled or uncontrolled open wiring, outside pointer and
Escape dismissal, focus return, and keeping its measured panel within the
viewport. It stays non-modal and leaves focus on the trigger when it opens so
the next Tab follows ordinary DOM order.

It does not infer whether its children are a menu, listbox, dialog, tooltip, or
ordinary supporting content. Use the specialized component whose semantics and
keyboard model match that job. It also intentionally does not portal: an
ancestor that clips overflow remains an application layout decision. Move the
surface outside that container, or use `Dialog` when modal behavior and the
browser top layer are the actual requirement.

### A Paginator owns navigation shape, not page meaning

`Paginator` owns a bounded list of page links and ellipses, previous and next
states, and the accessible current position. A real `href` is required even
when a client router intercepts ordinary clicks, preserving server rendering,
modified clicks, copied links, and a path when JavaScript fails.

The application owns how a URL maps to a page, where the total comes from,
whether an out-of-range request redirects or fails, and how router state stays
in sync. Cursor pagination and “load more” have separate ordering, stale-result,
and duplication contracts; numbered pagination does not claim to solve them.

### Clipboard state is not disclosure permission

`useCopy` and `CopyButton` own one browser clipboard attempt, a compatibility
fallback, accessible success or failure state, repeat-activation locking, and
reset timer cleanup. They do not infer whether the supplied text is safe to
reveal or whether a secret, personal value, or expiring token should be copied.

The application owns the exact string and the policy that permits disclosure.
A clipboard write cannot be aborted, so reset does not pretend to cancel an
active attempt. The legacy textarea path is a compatibility fallback, not a
way around browser permission; refusal by both paths remains an explicit error.

### Retry requires an idempotency decision

Only enable `retry` for an operation where repeating the same request is safe.
Payments, order creation, and sending mail usually are not. The first request
may have reached the server even when its response was lost.

When such an operation must be retried, pair it with a server-side mechanism
that treats repeated requests as one, such as an `Idempotency-Key`. The client
cannot infer that guarantee.

### Accessibility is shared across the composition

Nasu Stack owns the semantics and interactions inside a shipped component.
It cannot choose an accurate label, repair a page-wide heading hierarchy, or
decide whether the content order expresses your intent. Components provide an
accessible path; the application must preserve it when composing and editing
them.

When the browser already provides the required semantics and keyboard model,
Nasu Stack uses that native control as the foundation instead of imitating it.
It also does not remove an available action merely because a default timer
elapsed: a toast with an action has no auto-dismiss timer unless the application
explicitly chooses a `duration`. It can still be dismissed, cleared, or evicted
when the provider's `max` queue is full. The application owns the wording and
any deliberate time limit or queue size it sets.

## Easy-to-misread conveniences

### `FileDrop`'s `accept` and `maxSize`

**These are not a defense.** They look at the file extension and the type the
browser guessed, both of which the sender controls. Rename `virus.exe` to
`photo.png` and it can pass.

The browser check exists to tell someone immediately that they picked the
wrong file. On the receiving server, check size, type, and the actual magic
bytes. For images, that includes recognizing SVG for what it is.

### `HoneypotField`

It reduces naive bot submissions. It is not a substitute for authentication,
authorization, CSRF protection, rate limiting, or dedicated bot protection.

### `EndpointSpec.defaults`

These are values the client sends, so if the same key exists in the input, the
input wins. Do not put authorization values such as `role`, `tenantId`, or
`userId` here. Identity and authority are decided on the server.

### Headers and environment variables in the browser

`EndpointSpec.headers`, `createSubmit({ headers })`, and
`uploadWithProgress(..., { headers })` are sent from the browser.

```ts
// This is not a secret
headers: { Authorization: `Bearer ${SERVICE_API_KEY}` }
```

Developer tools, network logs, and browser extensions can read them. Values in
environment variables starting with `PUBLIC_` or `VITE_` also ship to the
browser. When the other service requires a secret, put a server you control in
between and call it from there.

## Where secrets go

| Location | Who can read it | What belongs there |
|---|---|---|
| `PUBLIC_*` / `VITE_*` environment variables | **Anyone** | Public URLs and public keys |
| Headers sent from the browser | **Anyone** | Tokens that are safe to publish |
| Written directly in browser code | **Anyone** | Nothing secret |
| Server-side secret storage | Only authorized operators and services | API keys, destinations, and authentication keys |

When in doubt, ask whether you would print the value on a public page. If not,
it does not belong in the browser.

## Not provided by Nasu Stack

- An authentication or authorization system
- A database, ORM, transaction manager, or server-side application framework
- Authoritative server-side validation or domain schemas
- CSRF protection, rate limiting, bot protection, or upload-content inspection
- A guarantee that cancelling a browser operation reverses server-side effects
- A guarantee that an application remains accessible or secure after its copied
  source is modified

Nasu Stack may provide primitives or integration examples for these concerns.
Doing so does not transfer their production responsibility to this project.
Security reporting and the narrower list of security promises are in
[`../SECURITY.md`](../SECURITY.md).
