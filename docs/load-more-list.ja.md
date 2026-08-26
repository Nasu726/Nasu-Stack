# LoadMoreListとuseCursorList

*[English version](load-more-list.md)*

`LoadMoreList`は、明示的なbutton操作の後にcursor pageを追加します。pageを自動無限scrollへは
変えません。同じregistry itemが`useCursorList`・`CursorPage`・`CursorLoader`も導入するため、
別packageを足したりcontractを置き換えたりせず1段ずつ降りられます。

```bash
npx shadcn add Nasu726/Nasu-Stack/load-more-list
```

```tsx
import { LoadMoreList } from "@/components/ui/load-more-list";
import { jsonRequest } from "@/lib/action";
import type { CursorPage } from "@/lib/cursor";

type Article = { id: string; href: string; title: string };

<LoadMoreList
  loader={(cursor, ctx) =>
    jsonRequest<CursorPage<Article, string>>("/api/articles", {
      method: "POST",
      body: JSON.stringify({ cursor }),
      ctx,
    })
  }
  renderItem={(article) => (
    <a href={article.href}>{article.title}</a>
  )}
  getKey={(article) => article.id}
/>
```

最初のpageは`undefined`を受け取ります。成功responseが次のrequest用cursorを返します。

```ts
interface CursorPage<TItem, TCursor> {
  items: TItem[];
  nextCursor?: TCursor | null;
}
```

`nextCursor`が無い、または`null`なら本当の末尾です。`items`が空でも末尾とは限りません。
次cursorがあればLoad more buttonを残します。hookが受け付けるcursorは有限の構造値（string、
有限number、boolean、array、plain object）です。`null`は末尾の印として予約します。

## 防ぐもの

- 最初のpageだけ自動取得し、後続pageはbutton操作を必須にする
- Reactが`disabled`を描画するより前の`loadMore()`同期連打もref lockで1 requestにする
- `deps`変更時に前collectionを即座に隠し、進行中requestをabortする。transportがsignalを
  無視して遅れて返っても結果を捨てる
- 後続pageの失敗では取得済みitemを残し、`retry()`はそのcursorだけを再実行する
- 既に要求したcursorへ戻るresponseは`CURSOR_LOOP`、不正pageは`INVALID_CURSOR_PAGE`で
  fail closedにする
- loading、error、件数、空、末尾を読み上げる。append後はLoad more、失敗後はretry、最後の
  buttonが消えた後はend statusへfocusを保つ

表示文言の既定はすべて英語です。`error` formatterを含む`labels`をappのlocaleに合わせて
上書きできます。

```tsx
<LoadMoreList
  loader={loadArticles}
  renderItem={renderArticle}
  getKey={(article) => article.id}
  labels={{
    loadMore: "記事をさらに表示",
    end: "すべての記事を表示しました。",
    error: (error) =>
      error.code === "CURSOR_LOOP"
        ? "記事一覧を続けられませんでした。"
        : error.displayMessage,
  }}
/>
```

## 1段下へ降りる

list・button・statusの見た目がproduct固有ならhookを使います。`items`、4つのasync state、
`hasMore`、`isEnd`、`loadMore()`、`retry()`、`reload()`を公開します。

```tsx
import { useCursorList } from "@/hooks/use-cursor-list";

const feed = useCursorList(loadArticles, [activeFilter]);

return (
  <>
    <ArticleGrid articles={feed.items} />
    {feed.hasMore && (
      <button disabled={feed.isLoadingMore} onClick={() => void feed.loadMore()}>
        さらに読み込む
      </button>
    )}
  </>
);
```

`deps`は現在cursorではなくcollection全体の識別です。filter・検索語・tenant・sort選択を
入れてください。cursor queueはhook内部が所有します。

## 責任境界

Nasu Stackが所有するのはclient request lock、reset/stale generation、見えるasync分岐、失敗
pageのretry、cursor loop検出、手動Load more interactionです。次はapplication / serverに
残ります。

- opaque cursorの発行と安定した順序の定義
- 全pageの認可とfilter
- item identity、page間のoverlap・重複排除・更新・削除
- cache / index整合性、rate limit、abuse防止
- URL / history復元、navigation後も読込済みpageを残すか
- 非常に大きいcollectionのvirtualization

hookは意図的にitemを重複排除しません。同じIDが偶然のoverlap・更新済みrecord・別versionの
どれなのかはdomainだけが判断できます。serverは安定順序と前進するcursorを返してください。
`AbortSignal`は古いclient stateを防ぎますがserver処理停止の証明ではありません。buttonは
clientの重複requestを防ぎますが、serverの副作用を重複排除するものではありません。

自動`IntersectionObserver` loadは含めません。末尾、browser history、scroll復元、footerへの
到達、支援技術でのnavigationを難しくすることがあります。それらのproduct判断を終えた場合だけ
applicationでobserverを足し、手動buttonを安全な経路として残してください。
