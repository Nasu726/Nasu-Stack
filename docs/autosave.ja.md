# useAutosave

`useAutosave`は、わずかな実装差で壊れやすいclient側queueを引き受けます。debounce、
進行中1件、待機中の最新値1件、stale response防止、retry、unmount時のabort通知です。

*[English version](autosave.md)*

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
  {draft.isSaving ? "保存中…" : draft.isDirty ? "未保存の変更あり" : "保存済み"}
</output>;
```

`saveArticle(input, { signal })`はほかのstate hookと同じ`Action` contractです。
入力し直しても進行中の保存は**abortしません**。待機途中の値は置き換え、次は最新値だけを
送ります。古いgenerationのresponseは最新UI stateを上書きせず、最新値向けcallbackも
呼びません。

失敗後の`retry()`は同じ最新値をすぐ再試行します。新しい`schedule()`は失敗値を
置き換え、通常どおりdebounceします。`flush()`は残りのdebounceを飛ばします。
`cancel()`は未保存値を捨てて進行中transportへabortを依頼し、`reset()`は成功outputも
消して`idle`へ戻します。

## cancelは取り消しではない

`AbortSignal`は停止の依頼です。serverがすでにwriteをcommitしていたり、transportが
signalを無視したりすることがあります。`cancel()`はその結果をhookのstateへ戻さない
だけで、database、message、paymentをrollbackしません。

## application / serverに残る責任

- editorの現在値をReactやform stateで保持すること
- 有効なdraftの規則と、statusに表示する文言
- version conflict、optimistic concurrency、idempotency、authorization
- durableなlocal draft、暗号化、offline/background sync、navigation guard
- writeをretryしてよい条件と、一部commit済みrequestからの復旧

このhookは値を`localStorage`へ自動保存しません。任意のform dataを永続化すると、privacy、
retention、migrationの判断までUI registryが背負うことになるためです。
