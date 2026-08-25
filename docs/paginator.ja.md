# Paginator

[English](paginator.md)

`Paginator`はページ移動を本物のlinkとして表示します。表示数を抑えたpage番号とellipsis、
現在pageのsemantics、前後の有効・無効だけを所有します。totalの取得、`?page=`の意味、
routerとの同期は所有しません。

```tsx
import { Paginator } from "@/components/ui/paginator";

<Paginator
  currentPage={page}
  totalPages={result.totalPages}
  getHref={(next) => `/articles?page=${next}`}
/>
```

`getHref`は必須です。すべての移動先がbrowserへ渡るため、新しいtabで開く、linkをコピーする、
server rendering、client JavaScriptが失敗した場合の移動を保てます。

## client-side router

実URLを残し、modifierのない通常clickだけを横取りします。modifier clickはbrowser本来の
動作を保ちます。

```tsx
<Paginator
  currentPage={page}
  totalPages={result.totalPages}
  getHref={(next) => `/articles?page=${next}`}
  onPageChange={(next, event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    router.navigate(`/articles?page=${next}`);
  }}
/>
```

## 言語と1段下の使い方

Nasu Stackはappのlocaleを所有しないため、読み上げ文言の既定値は英語です。interfaceの
言語が異なる場合は`labels`を渡します。

```tsx
<Paginator
  // ...
  labels={{
    navigation: "記事のページ",
    previous: "新しい記事",
    next: "古い記事",
    page: (page) => `記事の${page}ページ目`,
  }}
/>
```

既定の見た目が合わなければ、`getPaginationItems()`で自分のlinkを組み、表示数を抑える
page / ellipsis algorithmだけを利用できます。
`siblingCount`と`boundaryCount`は10を上限にし、誤入力で巨大なtotalが巨大なDOMへ変わらない
ようにしています。本当にそれ以上必要な特殊navigationでは、小さいhelperをforkして所有します。

## 境界

- 正しいtotalと、URLから来た範囲外の値をredirect・errorのどちらにするかはapplicationが
  所有します。componentは表示値を防御的に丸めますが、routeの入力validationではありません。
- pageは安定したURL位置です。cursor型feedと「さらに読む」はrace・重複防止の契約が異なるため、
  番号paginationに見せかけません。
- 最初・最後のpageでは移動できない方向をdisabledな文字として示し、Tab順序へ入れません。
- 巨大なpage数でも全linkをrenderしません。狭い器ではtargetを潰したりdocumentをはみ出させたり
  せず、上限のある並びを折り返します。

導入:

```bash
npx shadcn add Nasu726/Nasu-Stack/paginator
```
