# useAutosave
persisting arbitrary form data would create privacy, retention, and migration
decisions that a UI registry cannot safely make.
`useAutosave` owns the client-side queue that is easy to get subtly wrong:
debounce, one in-flight save, one latest queued value, stale-response
protection, retry, and unmount abort signaling.

*[日本語版はこちら](autosave.ja.md)*

```bash
npx shadcn add Nasu726/Nasu-Stack/use-autosave
```

```tsx
import { useAutosave } from "@/hooks/use-autosave";

const draft = useAutosave(saveArticle, { delay: 800 });

<textarea
  defaultValue={article.body}
  onChange={(event) => draft.schedule({ body: event.currentTarget.value })}
  onBlur={draft.flush}
/>
<output aria-live="polite">
  {draft.isSaving ? "Saving…" : draft.isDirty ? "Unsaved changes" : "Saved"}
</output>;
```

`saveArticle(input, { signal })` has the same `Action` contract as the other
state hooks. Editing does **not** abort an in-flight save. Intermediate queued
values are replaced, and only the latest value is sent next. A response for an
older generation cannot replace the latest UI state or call the latest-value
callbacks.

After a failure, `retry()` retries that latest value immediately. A new
`schedule()` replaces it and follows the normal debounce. `flush()` skips the
remaining debounce. `cancel()` discards unsaved values and asks the current
transport to abort; `reset()` also clears saved output and returns to `idle`.

## Cancellation is not an undo

An `AbortSignal` is a request to stop. The server may already have committed
the write, and a transport may ignore the signal. `cancel()` prevents that
result from updating this hook; it does not roll back a database, message, or
payment.

## What remains application and server work

- keeping the current editor value in React or form state;
- deciding what a valid draft is and what status wording to show;
- version conflicts, optimistic concurrency, idempotency, and authorization;
- durable local drafts, encryption, offline/background sync, and navigation
  guards;
- retry policy for writes and recovery after a partially committed request.

The hook intentionally does not write values to `localStorage`. Automatically
persisting arbitrary form data would create privacy, retention, and migration
decisions that a UI registry cannot safely make.
