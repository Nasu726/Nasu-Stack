# ErrorBoundary

`ErrorBoundary`はReactの**render failure**を1つのsubtree内へ閉じ込めます。
失敗した範囲には読み上げ可能なfallbackと復帰経路を出し、siblingやページの残りは
そのまま利用できます。

*[English version](error-boundary.md)*

```bash
npx shadcn add Nasu726/Nasu-Stack/error-boundary
```

```tsx
import { ErrorBoundary } from "@/components/ui/error-boundary";

<ErrorBoundary
  title="ダッシュボードを表示できませんでした"
  description="ページのほかの部分はそのまま利用できます。"
  retryLabel="もう一度試す"
  onError={(error, info) => reportRenderFailure(error, info.componentStack)}
>
  <Dashboard />
</ErrorBoundary>;
```

既定fallbackは`role="alert"`を持ち、失敗した範囲へfocusを移し、retry buttonを
表示します。retryすると失敗したsubtreeを再mountします。先に外部stateを変える
必要がある場合はreset keyを変えます。

```tsx
<ErrorBoundary resetKeys={[accountId, revision]}>
  <Account accountId={accountId} />
</ErrorBoundary>
```

`onError`がthrow / rejectしてもfallbackまで失わないよう隔離します。独自fallback
componentまでthrowした場合は、依存を持たない最小messageを残します。独自fallbackは
escape hatchなので、その文言・semantics・focus先・復帰UIは利用側が所有します。

## 捕捉しないもの

- event handlerがthrowしたerror
- Promise、effect、timer、network requestの失敗
- Server Componentやserver renderingのerror
- boundary自身より上で起きた失敗

非同期stateには`useAction`、`useResource`、`AsyncBoundary`を使います。render failureを
`ActionError`へ変換してはいけません。復帰方法もreporting contractも別だからです。
logging、redaction、support ID、retryしてよいかの判断はapplicationが所有します。
