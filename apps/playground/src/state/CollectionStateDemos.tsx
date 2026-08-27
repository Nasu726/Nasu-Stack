import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { AsyncForm, Field } from "@/components/ui/async-form";
import { DataList } from "@/components/ui/data-list";
import {
  SearchListRecipe,
  type SearchListItem,
} from "@/components/recipes/search-list";
import { LoadMoreList } from "@/components/ui/load-more-list";
import type { CursorPage } from "@/lib/cursor";
import { useCursorList } from "@/hooks/use-cursor-list";
import { ContentBlock, Inline, Spread } from "@/components/ui/layout";
import { Panel } from "../Panel";
import * as api from "../fake-api";
import { t } from "../lang";

export function FormSection() {
  return (
    <Panel
      title="AsyncForm + Field"
      description={
        <>
          {t("送信関数を 1 つ渡すだけ。")}
          <code className="text-fg">ActionError</code> {t("の")}{" "}
          <code className="text-fg">fields</code> {t("に入れたエラーは、\r\n          対応する入力欄の下へ自動で表示され、打ち直すと消えます。\r\n          メールを空欄にするか")} <code>a@example.com</code> {t("を入れると、\r\n          失敗したときの表示を確認できます。")}
        </>
      }
      code={t("<AsyncForm action={api.signup} submitLabel=\"アカウントを作成\">\n  <Field name=\"email\" label=\"メールアドレス\" type=\"email\" required />\n</AsyncForm>")}
    >
      <ContentBlock width="28rem" align="start">
        <AsyncForm
          action={api.signup}
          submitLabel={t("アカウントを作成")}
          successMessage={t("登録が完了しました")}
          onSuccess={async (_data, input) => {
            if (input.name !== "async-callback") return;
            await Promise.resolve();
            // AsyncForm がこの Promise を return しないと、useAction の
            // callSafely へ届かず unhandled rejection になります。
            throw new Error(t("callback がわざと失敗します"));
          }}
        >
          <Field name="name" label={t("お名前")} placeholder={t("山田 太郎")} required />
          <Field
            name="email"
            label={t("メールアドレス")}
            type="email"
            placeholder="you@example.jp"
            hint={t("確認メールを送ります")}
            required
          />
          <Field
            name="password"
            label={t("パスワード")}
            type="password"
            hint={t("8 文字以上")}
            required
          />
        </AsyncForm>
        <p className="mt-xs text-xs text-muted-fg">
          {t("見本です。押しても実際には何も送信されません。")}
        </p>
      </ContentBlock>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

export function ListSection() {
  const [which, setWhich] = React.useState<"ok" | "empty" | "error">("ok");
  const loader =
    which === "ok"
      ? api.listTasks
      : which === "empty"
        ? api.listEmpty
        : api.listBroken;

  return (
    <Panel
      title="DataList / AsyncBoundary"
      description={t("取得・スケルトン・空状態・失敗と再試行を 1 コンポーネントに閉じ込めています。下のボタンで各状態を確認できます。")}
      code={`<DataList\n  loader={(_, ctx) => jsonRequest<Task[]>("/api/tasks", { ctx })}\n  renderItem={(t) => <span>{t.title}</span>}\n/>`}
    >
      <Inline space="xs">
        {(["ok", "empty", "error"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={which === k ? "primary" : "outline"}
            onClick={() => setWhich(k)}
          >
            {k === "ok" ? t("データあり") : k === "empty" ? t("空") : t("失敗")}
          </Button>
        ))}
      </Inline>

      <DataList
        key={which}
        title={t("タスク")}
        loader={loader}
        deps={[which]}
        getKey={(task) => task.id}
        renderItem={(task) => (
          <Spread space="sm">
            <span className={task.done ? "text-muted-fg line-through" : ""}>
              {task.title}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg">
              {task.owner}
            </span>
          </Spread>
        )}
      />
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

export function SearchListSection() {
  const calls = React.useRef<string[]>([]);
  const aborts = React.useRef(0);
  const failures = React.useRef(new Map<string, number>());
  const [, renderProbe] = React.useReducer((value) => value + 1, 0);

  const search = React.useCallback(
    async (query: string, context: { signal: AbortSignal }) => {
      calls.current.push(query);
      renderProbe();

      await waitForSearch(
        query === "slow" ? 900 : 140,
        context.signal,
        () => {
          aborts.current += 1;
          renderProbe();
        },
      );

      if (query === "error") {
        const attempt = (failures.current.get(query) ?? 0) + 1;
        failures.current.set(query, attempt);
        if (attempt === 1) throw new Error(t("検索に失敗しました"));
        return [
          {
            id: "recovered",
            href: "/docs/recovered",
            title: t("再試行で取得できた結果"),
          },
        ];
      }

      if (query === "empty") return [];
      if (query === "slow") {
        return [
          {
            id: "old",
            href: "/docs/old",
            title: t("古い検索結果"),
          },
        ];
      }
      if (query === "fast") {
        return [
          {
            id: "current",
            href: "/docs/current",
            title: t("新しい検索結果"),
          },
        ];
      }

      const items: SearchListItem[] = [
        {
          id: "boundaries",
          href: "/docs/boundaries",
          title: t("責任境界"),
          description: t("認証・認可・rate limitはserverの責任として残します。"),
        },
        {
          id: "long",
          href: "/docs/search-list",
          title:
            "SearchResultWithAnIntentionallyLongUnbrokenIdentifierThatMustNotOverflow",
          description: t("長い結果でも狭い画面を押し広げません。"),
        },
      ];
      return items;
    },
    [],
  );

  return (
    <Panel
      title="Search list recipe"
      description={t("入力が止まってから検索し、新しい検索語を待つ間は古い結果を隠します。前のrequestは中断し、失敗・再試行・空状態も同じ配線で扱います。検索の意味、権限、rate limit、順位付けはappとserverの責任です。")}
      code={t("<SearchListRecipe\n  search={(query, ctx) => searchArticles(query, ctx)}\n  messages={{ label: \"記事を検索\" }}\n/>")}
    >
      <ContentBlock width="32rem" align="start" data-testid="search-list-demo">
        <SearchListRecipe
          search={search}
          debounceMs={250}
          messages={{
            label: t("サイト内検索"),
            placeholder: t("名前や説明で検索"),
            belowMinimum: (minimum) =>
              t("{0}文字以上入力すると検索します。").replace(
                "{0}",
                String(minimum),
              ),
            searching: t("検索中…"),
            empty: t("一致する結果はありません。"),
            retry: t("検索を再試行"),
            resultCount: (count) =>
              t("検索結果 {0} 件").replace("{0}", String(count)),
          }}
        />
        <output
          hidden
          data-testid="search-list-probe"
          data-calls={JSON.stringify(calls.current)}
          data-aborts={aborts.current}
        >
          {calls.current.length}:{aborts.current}
        </output>
      </ContentBlock>
    </Panel>
  );
}

function waitForSearch(
  milliseconds: number,
  signal: AbortSignal,
  onAbort: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = window.setTimeout(finish, milliseconds);
    const abort = () => {
      window.clearTimeout(timer);
      onAbort();
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/* ---------------------------------------------------------------- */

type LoadMoreMode =
  | "normal"
  | "error"
  | "empty"
  | "empty-page"
  | "loop"
  | "malformed";

interface CursorDemoItem {
  id: string;
  href: string;
  title: string;
  description: string;
}

export function LoadMoreSection() {
  const [mode, setMode] = React.useState<LoadMoreMode>("normal");
  const [version, setVersion] = React.useState(0);
  const calls = React.useRef<string[]>([]);
  const aborts = React.useRef(0);
  const failures = React.useRef(new Map<string, number>());
  const [, renderProbe] = React.useReducer((value) => value + 1, 0);

  const chooseMode = (next: LoadMoreMode) => {
    if (next === "error") failures.current.delete("error:page-2");
    setMode(next);
    setVersion((value) => value + 1);
  };

  const loader = React.useCallback(
    async (
      cursor: string | undefined,
      context: { signal: AbortSignal },
    ): Promise<CursorPage<CursorDemoItem, string>> => {
      const call = `${mode}:${cursor ?? "initial"}`;
      calls.current.push(call);
      renderProbe();

      const wait =
        mode === "normal" && cursor === "page-2"
          ? waitForCursorDemoIgnoringAbort
          : waitForCursorDemo;
      await wait(cursor === "page-2" ? 700 : 180, context.signal, () => {
        aborts.current += 1;
        renderProbe();
      });

      if (mode === "malformed" && cursor === undefined) {
        return { items: null } as unknown as CursorPage<CursorDemoItem, string>;
      }
      if (mode === "empty" && cursor === undefined) return { items: [] };
      if (mode === "empty-page" && cursor === undefined) {
        return { items: [], nextCursor: "page-2" };
      }

      if (cursor === undefined) {
        return {
          items: [
            {
              id: `${mode}-1`,
              href: "/articles/one",
              title: t("cursor一覧の最初の記事"),
              description: t("最初のpageは自動で取得します。"),
            },
            {
              id: `${mode}-2`,
              href: "/articles/two",
              title:
                "LoadMoreResultWithAnIntentionallyLongUnbrokenIdentifierThatMustWrap",
              description: t("長い結果も狭い画面を押し広げません。"),
            },
          ],
          nextCursor: "page-2",
        };
      }

      if (mode === "error" && cursor === "page-2") {
        const key = "error:page-2";
        const attempt = (failures.current.get(key) ?? 0) + 1;
        failures.current.set(key, attempt);
        if (attempt === 1) throw new Error(t("次のpageを取得できませんでした"));
      }

      if (mode === "loop" && cursor === "page-2") {
        return {
          items: [
            {
              id: "loop-item",
              href: "/articles/loop",
              title: t("追加してはいけないloop結果"),
              description: t("同じcursorへ戻るためfail closedになります。"),
            },
          ],
          nextCursor: "page-2",
        };
      }

      if (cursor === "page-2") {
        return {
          items: [
            {
              id: `${mode}-3`,
              href: "/articles/three",
              title: t("追加された記事A"),
              description: t("buttonを押した後もfocus位置を保ちます。"),
            },
            {
              id: `${mode}-4`,
              href: "/articles/four",
              title: t("追加された記事B"),
              description: t("同じcursorを連打してもrequestは1回です。"),
            },
          ],
          nextCursor: "page-3",
        };
      }

      return {
        items: [
          {
            id: `${mode}-5`,
            href: "/articles/five",
            title: t("最後の記事"),
            description: t("末尾ではbuttonをend stateへ置き換えます。"),
          },
        ],
      };
    },
    [mode],
  );

  const modes: Array<[LoadMoreMode, string]> = [
    ["normal", t("通常のcursor list")],
    ["error", t("次page失敗")],
    ["empty", t("空のcursor list")],
    ["empty-page", t("0件だが次があるpage")],
    ["loop", t("cursor loop")],
    ["malformed", t("不正なcursor page")],
  ];

  return (
    <Panel
      title="LoadMoreList / useCursorList"
      description={t("自動無限scrollではなく明示的なbuttonを既定にし、cursor requestの連打・stale response・失敗したpageのretry・末尾・cursor loopを扱います。itemの重複、並び順、認可、cursor発行はappとserverの責任です。")}
      code={t("<LoadMoreList\n  loader={(cursor, ctx) => getArticles(cursor, ctx)}\n  renderItem={(article) => <a href={article.href}>{article.title}</a>}\n  getKey={(article) => article.id}\n/>")}
    >
      <Inline space="xs">
        {modes.map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? "primary" : "outline"}
            onClick={() => chooseMode(value)}
          >
            {label}
          </Button>
        ))}
      </Inline>

      <ContentBlock width="32rem" align="start" data-testid="load-more-demo">
        <LoadMoreList
          loader={loader}
          deps={[mode, version]}
          title={t("記事")}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <a href={item.href} className="block min-w-0 text-card-fg">
              <span className="block break-words text-sm font-medium">
                {item.title}
              </span>
              <span className="mt-1 block break-words text-sm text-muted-fg">
                {item.description}
              </span>
            </a>
          )}
          labels={{
            loading: t("最初のpageを読込中…"),
            loadMore: t("さらに読み込む"),
            loadingMore: t("次のpageを読込中…"),
            retry: t("このpageを再試行"),
            empty: t("記事はまだありません。"),
            end: t("すべての記事を読み込みました。"),
            itemCount: (count) =>
              t("記事 {0} 件").replace("{0}", String(count)),
            error: (error) => (
              <span data-cursor-error-code={String(error.code ?? "")}>
                {error.code === "CURSOR_LOOP"
                  ? t("serverが既に取得したcursorを返しました。")
                  : error.code === "INVALID_CURSOR_PAGE"
                    ? t("serverが不正なcursor pageを返しました。")
                    : error.displayMessage}
              </span>
            ),
          }}
        />
        <output
          hidden
          data-testid="load-more-probe"
          data-calls={JSON.stringify(calls.current)}
          data-aborts={aborts.current}
        >
          {calls.current.length}:{aborts.current}
        </output>
      </ContentBlock>
    </Panel>
  );
}

function waitForCursorDemo(
  milliseconds: number,
  signal: AbortSignal,
  onAbort: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timer);
      onAbort();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = window.setTimeout(finish, milliseconds);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/** transportがAbortSignalを通知として受けても停止しない場合を再現します。 */
function waitForCursorDemoIgnoringAbort(
  milliseconds: number,
  signal: AbortSignal,
  onAbort: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    const abort = () => onAbort();
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    window.setTimeout(finish, milliseconds);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/** disabled buttonに頼らず、hook自身が同期連打を止めることを測る治具。 */
export function CursorHookRaceProbe() {
  const calls = React.useRef<string[]>([]);
  const [, renderProbe] = React.useReducer((value) => value + 1, 0);
  const cursor = useCursorList<string, string>(async (next, context) => {
    calls.current.push(next ?? "initial");
    renderProbe();
    await waitForCursorDemo(120, context.signal, () => {});
    return next === undefined
      ? { items: ["first"], nextCursor: "next" }
      : { items: ["second"] };
  });

  return (
    <div hidden data-testid="cursor-hook-race-probe">
      <button
        type="button"
        data-testid="cursor-hook-race-run"
        onClick={() => {
          for (let index = 0; index < 5; index++) void cursor.loadMore();
        }}
      >
        run
      </button>
      <output
        data-testid="cursor-hook-race-state"
        data-status={cursor.status}
        data-calls={JSON.stringify(calls.current)}
      >
        {cursor.status}:{calls.current.length}
      </output>
    </div>
  );
}

/* ---------------------------------------------------------------- */
