# Security

*[日本語版はこちら](SECURITY.ja.md)*

## Reporting something you found

**Please don't open a public issue.** It gets read before it gets fixed.

Report it privately through GitHub
[Security Advisories](https://github.com/Nasu726/Nasu-Stack/security/advisories/new).

**A reply is not guaranteed.** This is a personal project maintained in
someone's spare time, and no response deadline is promised (see "What is not
promised" below). It is not a good fit for uses that need a fast, certain
answer.

## What this repository is

A **starter kit** that distributes website components.

**It is not published to npm.**

It is also **not listed in the shadcn registry directory**, and it doesn't need
to be — `npx shadcn add Nasu726/Nasu-Stack/<name>` works without any listing.
If it is ever listed, it still won't go to npm (the directory doesn't require
it).

Only three things are distributed:

| | |
|---|---|
| `https://nasu726.github.io/Nasu-Stack/r/*.json` | the registry the shadcn CLI reads |
| `https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz` | the starter CLI |
| the matching `.sha256` | the hash of that tarball |

**Nothing is published to npm under the name `create-nasu-stack`.** That name
is unclaimed, so typing `npx create-nasu-stack` **runs somebody else's code.**
Always point at the tarball URL above. (`scripts/check-forbidden.mjs` watches
for that string mechanically.)

You can verify the tarball before you run it.

Download it once, verify that file, and **run that same file**:

```bash
curl -fsSL -O https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz
curl -fsSL -O https://nasu726.github.io/Nasu-Stack/create-nasu-stack.tgz.sha256
sha256sum -c create-nasu-stack.tgz.sha256   # once this says OK
npx ./create-nasu-stack.tgz my-site
```

(On Windows PowerShell, compare the output of
`Get-FileHash create-nasu-stack.tgz -Algorithm SHA256` against the contents of
the `.sha256` file.)

**The one-liner in the README cannot verify anything.** That form fetches from
the URL again at run time, so **what you checked and what you ran are not
necessarily the same bytes.**

**This does not tell you who made it.** All it tells you is whether what you
got matches what was published here.

## What is not promised

**This is a Public Beta.** What is covered, and what you have to write
yourself, is listed in [`docs/boundaries.md`](docs/boundaries.md).

- **Ongoing maintenance is not promised.** It's a personal project
- **No response deadline** is promised for vulnerabilities
- No backports to older versions. Fixes land on the newest one only

If those terms don't work for your use, please don't use this.
The reasoning and the trade-offs are in [`docs/security.md`](docs/security.md).

## Things to know about the code that ships

The components run in the browser. **Browser-side checks are not a defense.**

| Component | Easy to misread |
|---|---|
| `FileDrop`'s `accept` / `maxSize` | Only looks at the name and the browser's guess. **Always verify size, type, and magic bytes on the server** |
| `HoneypotField` | Thins out naive bots. Useless against anyone targeting you |
| `EndpointSpec.defaults` | Values the client sends, so **the input can override them.** Don't put authorization values here |
| `ActionError.displayMessage` | A server's raw `message` is never shown (it leaks internals). Return the text you want shown as `userMessage` |
| `PUBLIC_` / `VITE_` env vars | **They ship to the browser.** Anyone can read them, so no keys |

## Dependencies

- GitHub Actions are **all pinned by SHA** — tags can be moved
- Workflows declare the minimum `permissions:` explicitly
- Generated projects run `npm audit` every time (CI fails on high or above)
- Renovate handles dependency updates; Dependabot alerts handle vulnerability
  notices (the split is documented in `renovate.json`)
