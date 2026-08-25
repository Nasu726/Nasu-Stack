# ErrorBoundary

`ErrorBoundary` keeps a React **render failure** inside one subtree. It gives
the failed area an accessible fallback and a recovery path while siblings and
the rest of the page remain usable.

*[日本語版はこちら](error-boundary.ja.md)*

```bash
npx shadcn add Nasu726/Nasu-Stack/error-boundary
```

```tsx
import { ErrorBoundary } from "@/components/ui/error-boundary";

<ErrorBoundary
  title="The dashboard could not be displayed"
  description="The rest of this page is still available."
  retryLabel="Try again"
  onError={(error, info) => reportRenderFailure(error, info.componentStack)}
>
  <Dashboard />
</ErrorBoundary>;
```

The default fallback uses `role="alert"`, moves focus to the failed area, and
offers a retry button. Retrying remounts the failed subtree. If external state
must change first, change a reset key:

```tsx
<ErrorBoundary resetKeys={[accountId, revision]}>
  <Account accountId={accountId} />
</ErrorBoundary>
```

An `onError` callback that throws or rejects is isolated so it cannot destroy
the fallback. If a custom fallback component itself throws, a minimal
dependency-free last-resort message remains. A custom fallback is an escape
hatch and owns its own wording, semantics, focus targets, and recovery UI.

## What it does not catch

- errors thrown by event handlers;
- rejected promises, effects, timers, or network requests;
- errors from Server Components or server rendering;
- failures above the boundary itself.

Use `useAction`, `useResource`, or `AsyncBoundary` for asynchronous state. Do
not convert a render failure into `ActionError`: they have different recovery
and reporting contracts. The application still owns logging, redaction,
support IDs, and deciding whether retrying is safe.
