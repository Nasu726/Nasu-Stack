# What is covered, and what is not

**These components don't make your app safe. They make the safe choice easier
to reach.** Below is what you get by dropping them in, and what stays your job.

*[日本語版はこちら](boundaries.ja.md)*

## The table

| We cover | You must write (server side) |
|---|---|
| Screen state (loading, success, failure, empty) | **Authentication** — who is this |
| Double-submit guard, abort, timeout | **Authorization** — are they allowed to |
| Screen readers, keyboard, screen width | **Server-side validation** (the browser side can be bypassed) |
| Browser-side input checks (**advice**) | CSRF, rate limiting |
| Telling you where secrets go | Upload validation (size, type, **magic bytes**) |
| Keeping raw server text off the screen | What ends up in your logs |

---

## Easy to misread

### `FileDrop`'s `accept` and `maxSize`

**These are not a defense.** They look at the file extension and the type the
browser guessed — both of which the sender controls. Rename `virus.exe` to
`photo.png` and it passes.

The point of rejecting here is to tell someone immediately that they picked the
wrong file. **On the receiving server, always check size, type, and the actual
magic bytes.** For images that includes recognizing SVG for what it is.

### `HoneypotField`

It thins out naive bots. **It is not a substitute for authentication,
authorization, CSRF protection, or rate limiting.** Anyone targeting you
specifically will walk past it.

### `EndpointSpec.defaults`

These are values the client sends, so **if the same key exists in the input,
the input wins.** Don't put authorization values like `role`, `tenantId`, or
`userId` here. Who someone is gets decided on the server.

### `headers` sent from the browser

`EndpointSpec.headers`, `createSubmit({ headers })`, and
`uploadWithProgress(..., { headers })` are **sent from the browser.**

```ts
// This is not a secret
headers: { Authorization: `Bearer ${SERVICE_API_KEY}` }
```

Devtools, network logs, and browser extensions can all read it. When the other
side needs a server key, **put your own server (a Worker, say) in between** and
call from there.

### Environment variables starting with `PUBLIC_` or `VITE_`

**They ship to the browser.** Anyone can read them. Don't put keys in them.

### `retry`

Only add it to operations where **doing the same thing twice changes nothing.**
Payments, order creation, and sending mail are not such operations. If the
first request reached the server and only the response was lost, a retry
**makes it happen again.**

If you need it there, design it together with a server-side mechanism that
treats identical requests as one (an `Idempotency-Key`, for example). This side
alone cannot tell the difference.

---

## Where secrets go

| Location | Who can read it | What belongs there |
|---|---|---|
| `PUBLIC_*` / `VITE_*` env vars | **Anyone** | Public URLs, public keys |
| `headers` sent from the browser | **Anyone** | Tokens that are safe to publish |
| Written directly in the code | **Anyone** (it ships) | Nothing |
| Server-side secret (Worker, etc.) | Only you | API keys, destinations, auth keys |

**When in doubt, ask whether you'd write it on a public page.** If you
wouldn't, it doesn't belong in the browser.

---

## Not covered right now

- Rate limiting and bot protection for the contact receiver
  (`examples/receivers/` is a worked example, not a service)
- Authentication and authorization
- Server-side validation (what's in the templates is only a sample)

These are also listed under "What is not promised" in
[`../SECURITY.md`](../SECURITY.md).
