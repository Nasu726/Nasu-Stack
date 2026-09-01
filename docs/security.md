# How this is distributed, and why that's safe

The moment this is published, it becomes **something that runs code on other
people's machines.**

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/action-button   # files get written into your src/
npx https://…/create-nasu-stack.tgz my-site              # code runs on your machine
```

So it isn't enough for what was built to be correct. **What's distributed has
to be the same thing that was built.** This page is the list.

*[日本語版はこちら](security.ja.md)* — the Japanese version also carries the
repository-hardening checklist (branch protection, workflow permissions, and so
on), which is for the maintainer rather than for you.

---

## 1. What is being protected

Three things, and **they break in different ways.**

| Protected | What happens when it breaks |
|---|---|
| **History** | A force push can swap the contents of a tag or of `main`. "The version that passed the checks" and "the version that shipped" become different things |
| **CI** | Workflows run other people's code next to a token with write access. One compromised action is enough |
| **Dependencies** | This is what supply-chain attacks aim at: publish a version from a stolen account and wait for it to ride along in someone's update |

---

## 2. Why the entry point is not on npm

Telling people to run `npx create-nasu-stack my-site` would require publishing
to npm. **This project doesn't publish.** It's a personal project and ongoing
maintenance can't be promised.

Instead, a **tarball URL** is distributed:

```bash
npx https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz my-site
```

npm accepts a tarball URL directly (measured, not assumed).
The Stable URL includes the version and points at an asset the release workflow
refuses to overwrite. A new release gets a new URL instead of reusing cached
contents under the same command.

The choice buys more than convenience:

- **No npm account as extra attack surface.** If it's taken, anyone can publish
- **No name squabbles.** Everything distributed lives under one domain

### The risk that remains

**The name `create-nasu-stack` is unclaimed on npm.** If a third party
publishes under it, anyone typing `npx create-nasu-stack` **runs that third
party's code.**

There is no way to prevent that from this side — claiming the name would be the
only defense, and that decision was made against. What can be done is **never
write that form anywhere**, and only point at the tarball URL.
`scripts/check-forbidden.mjs` enforces it mechanically.

If this ever does go to npm, these come first:

1. Two-factor authentication on the account (mandatory)
2. **Trusted publishing (OIDC).** No long-lived token in CI
3. `npm publish --provenance`, so the workflow and commit it came from are on
   the record

---

## 3. What you can check, as someone using it

Even with everything hardened on this side, **all you can confirm is that you
typed the real URL.** These rules help:

- **Stable installs use a versioned GitHub Release asset.** The workflow refuses
  to overwrite an existing release, and the URL changes with the version
- **The Pages tarball is only a latest-main preview.** Its contents change at
  the same URL, and npm/npx may reuse URL-cached contents, so it is not the
  canonical Stable install command
- **The SHA-256 of the distributed tarball is published alongside it**
  (`create-nasu-stack-2.1.0.tgz.sha256`), so you can compare before you run
  anything
- **Every URL is https** — the registry JSON and the tarball alike

```bash
# For v2.1.0, download once, verify that file, and run that same file.
curl -fsSL -O https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz
curl -fsSL -O https://github.com/Nasu726/Nasu-Stack/releases/download/v2.1.0/create-nasu-stack-2.1.0.tgz.sha256
sha256sum -c create-nasu-stack-2.1.0.tgz.sha256
npx ./create-nasu-stack-2.1.0.tgz my-site
```

The release workflow verifies the tag against the package version and refuses
to overwrite an existing GitHub Release. The Pages and Release tarballs are
built through the same packer, so their construction cannot drift silently.

Repository-level GitHub release immutability was enabled on 2026-08-30 and
protects future releases after they are published. GitHub does not apply the
setting retroactively: the API still reports `immutable: false` for `v2.0.0`.
That release therefore relies on its protected tag, the no-overwrite workflow,
the versioned URL, checksum, and manifest rather than GitHub's immutable-release
enforcement.

**The one-line npx command does not verify the checksum.** Use the download,
check, and local-run form above when you need to verify the exact bytes first.

---

## 4. Holes that are still open

**Writing them down is what stops "we did everything" from setting in.**

- **The distribution is not signed.** A SHA-256 tells you the bytes are intact;
  it does not tell you who made them. Something like sigstore is only
  meaningful once there's a procedure a user can actually follow, so it isn't
  in yet
- **`v2.0.0` predates repository-level immutable releases.** An administrator
  could still change that existing release or its assets; verify its published
  checksum when exact bytes matter. Releases published after 2026-08-30 are
  locked by GitHub after publication and receive a release attestation
- **No provenance for the registry JSON.** Same reasoning

---

## 5. Updates vs. vulnerabilities — who watches what

**Pointing both tools at the same thing produces two PRs for one update.**
After you merge one, the other conflicts, and it isn't clear whether to close
it. So the roles are split:

| | Responsibility | Where it's configured |
|---|---|---|
| Dependabot alerts | **Vulnerability notices and their fix PRs** | Enabled on GitHub |
| Renovate | **Routine updates** (patch / minor / major, lockfile maintenance) | `renovate.json` |

`renovate.json` explicitly opts out of the vulnerability role:

```json
"vulnerabilityAlerts": { "enabled": false },
"osvVulnerabilityAlerts": false
```

### Why `minimumReleaseAge` is set

**The moments right after a publish are the most dangerous.** Supply-chain
attacks on npm usually take the form of a new version pushed from a stolen
account, and the window is the hours-to-days before someone notices and pulls
it.

Waiting 7 days avoids almost all of that window. **The cost is that legitimate
fixes are also 7 days late** — which is fine, because vulnerability fixes are
Dependabot's job, and those aren't delayed.

GitHub Actions use 3 days: there are fewer of them, and the blast radius is
confined to CI.

### Why actions are pinned by SHA

**Tags can be moved.** If you point at `@v4` and the contents are swapped one
day, nothing here would notice. A SHA changes when the contents change.

**Once pinned, you need something that follows along**, or you trade "it can't
change on its own" for "it can't get fixed on its own".
`helpers:pinGitHubActionDigests` is that something.
