# Search list recipe

*[English version](search-list.md)*

`SearchListRecipe`は検索欄とlink-firstな結果一覧の、copy-ownedな配線です。高速入力を
debounceし、検索語が変わった時点で前の結果を隠し、置き換えられたrequestをabortして、
読込中・失敗・再試行・空・成功を明示します。

```bash
npx shadcn add Nasu726/Nasu-Stack/search-list
```

```tsx
import {
  SearchListRecipe,
  type SearchListItem,
} from "@/components/recipes/search-list";
import { jsonRequest } from "@/lib/action";

<SearchListRecipe
  search={(query, ctx) =>
    jsonRequest<SearchListItem[]>(
      `/api/search?q=${encodeURIComponent(query)}`,
      { ctx },
    )
  }
/>
```

actionには正規化済みの検索語と、通常のNasu Stack `ActionContext`が渡ります。
`ctx.signal`をtransportへ渡してください。新しい検索語が入力されると、recipeは古い
transportへ停止を依頼し、遅れて返った結果をUIへ戻しません。

## recipeにした理由

再利用するのは壊れやすい配線であり、万能な検索productではありません。itemは
`components/recipes/search-list.tsx`へ導入されるため、自分のcodeとして変更できます。
意図的に小さくした結果contractは次の形です。

```ts
interface SearchListItem {
  id: React.Key;
  href: string;
  title: string;
  description?: string;
}
```

移動先はすべて本物のlinkです。group、facet、highlight、cursor pagination、異なる行の形が
必要なら、コピーしたrecipeを変えるか、`useResource`と`AsyncBoundary`へ1段降りてください。
Nasu Stackのほかの部分まで置き換える必要はありません。

formの値を1つ選ぶ場合は`AsyncSelect`、検索欄を持たず明示的な依存値から再取得する一覧は
`DataList`を使います。このrecipeは移動先やrecordを探し、そのlinkを辿る用途です。

## 既定値と言語

- `debounceMs`は既定300ms
- `minQueryLength`は既定2
- 自動`retry`は既定0。画面内の再試行buttonは残ります
- `debounceMs`は0以上の有限値、`minQueryLength`は1以上の整数、`retry`は0以上の整数
- 表示文言の既定は英語。appのlocaleと文脈に合わせて`messages`の各項目を上書きできます

```tsx
<SearchListRecipe
  search={searchArticles}
  debounceMs={400}
  messages={{
    label: "記事を検索",
    empty: "一致する記事はありません。",
    retry: "検索を再試行",
  }}
/>
```

inputは本物のlabelを持ち、検索中と件数はpoliteなlive region、失敗はalert、結果行はkeyboardで
到達できるlinkです。切れない長いtitleやdescriptionも狭いpageを押し広げず折り返します。

## 責任境界

recipeが所有するのはclient debounce、stale resultの除外、requestのabort通知、4つのasync
分岐、link-firstな結果semanticsです。次は**決めません**。

- queryの意味、文字の正規化、順位付け、highlight、logging
- 現在の利用者が発見・閲覧してよいrecord
- rate limit、abuse防止、cache、検索indexの整合性
- URLが安全でcanonicalか
- total、facet、cursor順序、pagination policy

認可と結果filterはserverで行います。このUIから結果を隠すことはaccess controlではありません。
abort signalは古いclient UIを防ぎますが、server処理が止まった証明ではありません。debounceは
通常のrequestを減らしますが、rate limitではありません。
