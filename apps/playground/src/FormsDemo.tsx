import * as React from "react";
import { Box, Inline, Stack } from "@/components/ui/layout";
import { Button } from "@/components/ui/action-button";
import { AsyncForm, Field, type FormValues } from "@/components/ui/async-form";
import {
  CheckboxField,
  CheckboxGroup,
  DateField,
  RadioGroup,
  SelectField,
} from "@/components/ui/form-fields";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { useOptimisticList } from "@/hooks/use-optimistic-list";
import { useToast } from "@/components/ui/action-provider";
import { ActionError } from "@/lib/action";
import { Panel } from "./Panel";

export function FormsDemo() {
  return (
    <Stack space="3xl">
      <InputsSection />
      <SelectionSection />
      <OptimisticSection />
    </Stack>
  );
}

/* ================================================================
 * 入力部品 + FormData の畳み込み
 * ============================================================== */

function InputsSection() {
  const [sent, setSent] = React.useState<FormValues | null>(null);

  return (
    <Panel
      title="入力部品と、複数値の取りこぼし"
      description={
        <>
          <code className="text-fg">Object.fromEntries(fd.entries())</code>{" "}
          は同じキーが複数あると最後だけ残します。
          つまり複数選択のセレクトやチェックボックス群が壊れます。
          未チェックのチェックボックスは FormData に現れないので、
          隠し入力で目印を送っています。送信すると実際の値が下に出ます。
        </>
      }
      code={`// これを使ってはいけない
Object.fromEntries(fd.entries())   // 同名キーは最後だけ残る

// 同名は配列に畳む
formDataToObject(fd)`}
    >
      <Stack space="lg">
        <Box className="max-w-md">
          <AsyncForm
            action={async (values) => {
              await new Promise((r) => setTimeout(r, 400));
              setSent(values);
              if (!values.plan) {
                throw new ActionError("validation", {
                  displayMessage: "入力内容を確認してください",
                  fields: { plan: "プランを選んでください" },
                });
              }
              return values;
            }}
            submitLabel="送信して中身を見る"
            successMessage="下に送信された値を出しました"
            resetOnSuccess={false}
          >
            <Field name="title" label="件名" required />

            <SelectField
              name="team"
              label="チーム"
              placeholder="選択してください"
              options={[
                { value: "design", label: "デザイン" },
                { value: "dev", label: "開発" },
                { value: "qa", label: "QA" },
              ]}
            />

            <SelectField
              name="langs"
              label="使う言語（複数選択）"
              multiple
              hint="Ctrl / ⌘ を押しながらで複数選べます"
              options={[
                { value: "ts", label: "TypeScript" },
                { value: "py", label: "Python" },
                { value: "rs", label: "Rust" },
                { value: "cs", label: "C#" },
              ]}
            />

            <CheckboxGroup
              name="tags"
              label="タグ（複数）"
              inline
              options={[
                { value: "web", label: "Web" },
                { value: "game", label: "ゲーム" },
                { value: "ml", label: "機械学習" },
              ]}
            />

            <RadioGroup
              name="plan"
              label="プラン"
              required
              options={[
                { value: "free", label: "無料" },
                { value: "pro", label: "Pro" },
                { value: "team", label: "チーム" },
              ]}
            />

            <DateField name="due" label="期限" hint="ブラウザ標準の日付入力です" />

            <CheckboxField
              name="agree"
              label="規約に同意する"
              hint="未チェックでも値が届きます（空文字になります）"
            />
          </AsyncForm>
        </Box>

        {sent && (
          <Box padding="sm" background="muted" radius="md">
            <Stack space="2xs">
              <span className="text-xs font-medium text-muted-fg">
                実際に送信された値
              </span>
              <pre className="overflow-x-auto text-[11px] leading-relaxed">
                <code>{JSON.stringify(sent, null, 2)}</code>
              </pre>
            </Stack>
          </Box>
        )}
      </Stack>
    </Panel>
  );
}

/* ================================================================
 * 行選択
 * ============================================================== */

interface Row {
  id: number;
  date: string;
  title: string;
  status: string;
  amount: number;
}

const ROWS: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  date: `2026-0${(i % 8) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
  title: `案件 ${String.fromCharCode(65 + i)}`,
  status: ["進行中", "完了", "停止"][i % 3],
  amount: (i + 1) * 1300,
}));

const COLUMNS: TableColumn<Row>[] = [
  { key: "date", label: "日付", sortable: true },
  { key: "title", label: "案件", sortable: true },
  { key: "status", label: "状態", sortable: true },
  {
    key: "amount",
    label: "金額",
    sortable: true,
    align: "end",
    get: (r) => `¥${r.amount.toLocaleString("ja-JP")}`,
  },
];

function SelectionSection() {
  const toast = useToast();

  return (
    <Panel
      title="行選択"
      description={
        <>
          選択は<strong className="text-fg">キーで保持</strong>するので、
          ページを移っても並べ替えても残ります。
          ヘッダのチェックは「いま表示している行」だけが対象です。
          他のページの分を含めた合計を「N 件選択中」に出します。
          Shift+クリックで範囲選択、チェックのクリックは行クリックに伝播しません。
        </>
      }
      code={`<DataTable
  rows={rows}
  columns={columns}
  getKey={(r) => r.id}     // selectable のときは必須
  selectable
  selectionActions={(keys, clear) => (
    <Button size="sm" onClick={() => bulkDelete(keys)}>削除</Button>
  )}
/>`}
    >
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getKey={(r) => r.id}
        pageSize={5}
        selectable
        caption="案件の一覧"
        onRowClick={(r) => toast.show({ tone: "info", title: r.title })}
        selectionActions={(keys, clear) => (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              toast.show({
                tone: "success",
                title: `${keys.size} 件を処理しました`,
              });
              clear();
            }}
          >
            まとめて処理
          </Button>
        )}
      />
    </Panel>
  );
}

/* ================================================================
 * useOptimisticList
 * ============================================================== */

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

let serverTodos: Todo[] = [
  { id: 1, title: "レイアウトを直す", done: true },
  { id: 2, title: "フォームを繋ぐ", done: false },
  { id: 3, title: "端末幅を確かめる", done: false },
];
let nextServerId = 100;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function OptimisticSection() {
  const [title, setTitle] = React.useState("");

  const list = useOptimisticList<Todo>({
    load: async () => {
      await wait(500);
      return [...serverTodos];
    },
    getKey: (t) => t.id,
  });

  return (
    <Panel
      title="useOptimisticList"
      description={
        <>
          追加・削除・更新をサーバーの応答を待たずに反映し、失敗したら
          <strong className="text-fg">その操作だけ</strong>取り消します。
          「配列を控えて戻す」実装だと、同時に走った他の操作まで巻き戻ります。
          題名に <code>fail</code> を入れると失敗します。
          保留中の行は薄く表示されます。
        </>
      }
      code={`const list = useOptimisticList({
  load: (_, ctx) => jsonRequest<Todo[]>("/api/todos", { ctx }),
  getKey: (t) => t.id,
});

list.add(item,  (i, ctx) => api.create(i, ctx));
list.remove(t,  (i, ctx) => api.remove(i.id, ctx));
list.update(t, { done: true }, (i, ctx) => api.update(i, ctx));`}
    >
      <Stack space="sm">
        <Inline space="xs" wrap={false}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="やることを追加（fail を含めると失敗）"
            aria-label="やることの題名"
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-base"
          />
          <Button
            onClick={() => {
              if (!title.trim()) return;
              const item: Todo = {
                id: -Date.now(), // 仮のキー。成功したらサーバーの ID に差し替わる
                title: title.trim(),
                done: false,
              };
              setTitle("");
              void list.add(item, async (i) => {
                await wait(900);
                if (/fail/i.test(i.title)) {
                  throw new ActionError("create failed", {
                    displayMessage: `「${i.title}」の追加に失敗しました`,
                  });
                }
                const saved = { ...i, id: nextServerId++ };
                serverTodos = [...serverTodos, saved];
                return saved;
              });
            }}
          >
            追加
          </Button>
        </Inline>

        <Stack space="2xs" dividers>
          {list.items.map((t) => {
            const state = list.pendingOf(t.id);
            return (
              <Inline
                key={t.id}
                space="xs"
                wrap={false}
                className={state ? "opacity-50" : undefined}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  aria-label={`${t.title} を完了にする`}
                  className="size-5 shrink-0 accent-primary"
                  onChange={() =>
                    void list.update(t, { done: !t.done }, async (i) => {
                      await wait(700);
                      if (/fail/i.test(i.title)) {
                        throw new ActionError("update failed", {
                          displayMessage: `「${i.title}」の更新に失敗しました`,
                        });
                      }
                      serverTodos = serverTodos.map((x) =>
                        x.id === i.id ? i : x,
                      );
                      return i;
                    })
                  }
                />
                <span
                  className={`min-w-0 flex-1 text-sm ${t.done ? "text-muted-fg line-through" : ""}`}
                >
                  {t.title}
                </span>
                {state && (
                  <span className="shrink-0 text-[11px] text-muted-fg">
                    {state === "add"
                      ? "追加中"
                      : state === "remove"
                        ? "削除中"
                        : "更新中"}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void list.remove(t, async (i) => {
                      await wait(900);
                      if (/fail/i.test(i.title)) {
                        throw new ActionError("delete failed", {
                          displayMessage: `「${i.title}」の削除に失敗しました`,
                        });
                      }
                      serverTodos = serverTodos.filter((x) => x.id !== i.id);
                    })
                  }
                >
                  削除
                </Button>
              </Inline>
            );
          })}
        </Stack>

        <Inline space="xs">
          <Button size="sm" variant="outline" onClick={list.refetch}>
            再取得（保留中は消えません）
          </Button>
          <span className="self-center text-xs text-muted-fg">
            保留中: {list.hasPending ? "あり" : "なし"}
          </span>
        </Inline>
      </Stack>
    </Panel>
  );
}
