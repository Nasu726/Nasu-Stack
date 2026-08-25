# CopyButton and useCopy

[日本語](copy-button.ja.md)

`CopyButton` copies one string after an explicit button activation and reports
copying, success, and failure accessibly. `useCopy` provides the same state
without choosing the appearance.

```tsx
import { CopyButton } from "@/components/ui/copy-button";

<CopyButton text={shareUrl}>Copy link</CopyButton>
```

The button ignores repeated activation while a write is in progress. Success
returns to idle after two seconds by default; use `resetAfter={null}` to keep
the result, or another non-negative duration to change it.

## Language and custom content

The accessible defaults are English because Nasu Stack does not own your app
locale. `labels` control visible state text and `announcements` control live
region text.

```tsx
<CopyButton
  text={shareUrl}
  labels={{ copying: "Copying link…", success: "Link copied" }}
  announcements={{ success: "The article link is now on the clipboard" }}
>
  Copy article link
</CopyButton>
```

Pass a render function when every visual state needs custom content. The
context exposes only clipboard state, method, error, and `reset()`.

```tsx
<CopyButton text={token} resetAfter={null}>
  {({ status, reset }) => (
    <>{status === "success" ? "Copied — click again to recopy" : "Copy"}</>
  )}
</CopyButton>
```

## One layer lower

```tsx
import { useCopy } from "@/hooks/use-copy";

const copy = useCopy({ resetAfter: 1500 });

<button disabled={copy.isCopying} onClick={() => void copy.copy(text)}>
  Copy with my own UI
</button>
```

For non-React code, `copyText(text)` returns whether the Clipboard API or the
fallback succeeded.

## Fallback and boundary

- The modern Clipboard API is tried first. If it is absent or rejects, the
  helper briefly creates a read-only off-screen textarea and tries the legacy
  browser copy command. The textarea is removed and focus/selection restored
  in every outcome.
- A fallback is compatibility, not permission bypass. If the browser refuses
  both paths, the state is `error` and the button stays available to retry.
- Nasu Stack cannot decide whether a secret, personal data, an expiring token,
  or hidden text may be copied. The application must choose the exact string
  and require an intentional user action where disclosure matters.
- A clipboard write cannot be aborted. `reset()` therefore does not pretend to
  cancel a write in progress, and repeated activation is locked until it
  settles.
- Callback failure does not relabel a completed clipboard write as failed.

Install only the layer you need:

```bash
npx shadcn add Nasu726/Nasu-Stack/copy-button
npx shadcn add Nasu726/Nasu-Stack/use-copy
```
