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
import type { ValidationResult, Validator } from "@/lib/validation";
import { Panel } from "./Panel";
import { t } from "./lang";

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

interface DemoFormData {
  title: string;
  team: string;
  langs: string[];
  tags: string[];
  plan: string;
  due: string;
  agree: boolean;
}

function strings(value: FormValues[string]): string[] {
  if (Array.isArray(value)) return value.map(String);
  return value === undefined || value === "" ? [] : [String(value)];
}

const validateDemoForm: Validator<DemoFormData, FormValues> = (
  values,
): ValidationResult<DemoFormData> => {
  const title = String(values.title ?? "").trim();
  const plan = String(values.plan ?? "");
  const fields: Record<string, string[]> = {};
  if (title.length < 3) {
    fields.title = [t("件名は 3 文字以上で入力してください")];
  }
  if (!plan) fields.plan = [t("プランを選んでください")];
  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      message: t("入力内容を確認してください"),
      fields,
    };
  }
  return {
    ok: true,
    data: {
      title,
      team: String(values.team ?? ""),
      langs: strings(values.langs),
      tags: strings(values.tags),
      plan,
      due: String(values.due ?? ""),
      agree: values.agree !== "",
    },
  };
};

function InputsSection() {
  const [sent, setSent] = React.useState<DemoFormData | null>(null);
  const [actionCalls, setActionCalls] = React.useState(0);

  return (
    <Panel
      title={t("入力部品と validation contract")}
      description={t("AsyncForm は FormData を畳んで validate に渡します。failure なら field error を表示し、success なら変換済み data だけを action へ渡します。ブラウザ側の検査は早い feedback であり、server 側の正規の判定は置き換えません。")}
      code={t("const validate: Validator<Profile, FormValues> = (values) => {\n  if (!values.plan) {\n    return { ok: false, fields: { plan: [\"選んでください\"] } };\n  }\n  return { ok: true, data: {\n    title: String(values.title).trim(),\n    plan: String(values.plan),\n  } };\n};\n\n<AsyncForm validate={validate} action={(profile) => api.save(profile)}>\n  …\n</AsyncForm>")}
    >
      <Stack space="lg">
        <Box className="max-w-md" data-testid="validation-form" data-action-calls={actionCalls}>
          <AsyncForm
            validate={validateDemoForm}
            retry={2}
            action={async (values) => {
              setActionCalls((count) => count + 1);
              await new Promise((r) => setTimeout(r, 400));
              // server が返す field error も同じ表示先へ戻ります。
              if (values.team === "qa") {
                throw new ActionError("server validation", {
                  code: 422,
                  displayMessage: t("入力内容を確認してください"),
                  fields: { team: t("QA チームは現在選べません") },
                });
              }
              setSent(values);
              return values;
            }}
            submitLabel={t("送信して中身を見る")}
            successMessage={t("下に送信された値を出しました")}
            resetOnSuccess={false}
          >
            <Field name="title" label={t("件名")} required />

            <SelectField
              name="team"
              label={t("チーム")}
              placeholder={t("選択してください")}
              options={[
                { value: "design", label: t("デザイン") },
                { value: "dev", label: t("開発") },
                { value: "qa", label: "QA" },
              ]}
            />

            <SelectField
              name="langs"
              label={t("使う言語（複数選択）")}
              multiple
              hint={t("複数選べます（パソコンでは Ctrl / ⌘ を押しながらクリック）")}
              options={[
                { value: "ts", label: "TypeScript" },
                { value: "py", label: "Python" },
                { value: "rs", label: "Rust" },
                { value: "cs", label: "C#" },
              ]}
            />

            <CheckboxGroup
              name="tags"
              label={t("タグ（複数）")}
              inline
              options={[
                { value: "web", label: "Web" },
                { value: "game", label: t("ゲーム") },
                { value: "ml", label: t("機械学習") },
              ]}
            />

            <RadioGroup
              name="plan"
              label={t("プラン")}
              required
              options={[
                { value: "free", label: t("無料") },
                { value: "pro", label: "Pro" },
                { value: "team", label: t("チーム") },
              ]}
            />

            <DateField name="due" label={t("期限")} hint={t("ブラウザ標準の日付入力です")} />

            <CheckboxField name="agree" label={t("規約に同意する")} />
          </AsyncForm>
          <p className="mt-xs text-xs text-muted-fg">
            {t("見本です。押しても実際には何も送信されません。")}
          </p>
        </Box>

        {sent && (
          <Box padding="sm" background="muted" radius="md">
            <Stack space="2xs">
              <span className="text-xs font-medium text-muted-fg">
                {t("実際に送信された値")}
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
  title: t("案件 {0}").replace("{0}", String.fromCharCode(65 + i)),
  status: [t("進行中"), t("完了"), t("停止")][i % 3],
  amount: (i + 1) * 1300,
}));

const COLUMNS: TableColumn<Row>[] = [
  { key: "date", label: t("日付"), sortable: true },
  { key: "title", label: t("案件"), sortable: true },
  { key: "status", label: t("状態"), sortable: true },
  {
    key: "amount",
    label: t("金額"),
    sortable: true,
    align: "end",
    get: (r) => `¥${r.amount.toLocaleString("ja-JP")}`,
  },
];

function SelectionSection() {
  const toast = useToast();

  return (
    <Panel
      title={t("行選択")}
      description={
        <>
          {t("選択は")}<strong className="text-fg">{t("キーで保持")}</strong>{t("するので、\r\n          ページを移っても並べ替えても残ります。\r\n          ヘッダのチェックは「いま表示している行」だけが対象です。\r\n          他のページの分を含めた合計を「N 件選択中」に出します。\r\n          Shift+クリックで範囲選択、チェックのクリックは行クリックに伝播しません。")}
        </>
      }
      code={t("<DataTable\n  rows={rows}\n  columns={columns}\n  getKey={(r) => r.id}     // selectable のときは必須\n  selectable\n  selectionActions={(keys, clear) => (\n    <Button size=\"sm\" onClick={() => bulkDelete(keys)}>削除</Button>\n  )}\n/>")}
    >
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getKey={(r) => r.id}
        pageSize={5}
        selectable
        caption={t("案件の一覧")}
        onRowClick={(r) => toast.show({ tone: "info", title: r.title })}
        selectionActions={(keys, clear) => (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              toast.show({
                tone: "success",
                title: t("{0} 件を処理しました").replace("{0}", String(keys.size)),
              });
              clear();
            }}
          >
            {t("まとめて処理")}
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
  { id: 1, title: t("レイアウトを直す"), done: true },
  { id: 2, title: t("フォームを繋ぐ"), done: false },
  { id: 3, title: t("端末幅を確かめる"), done: false },
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
    getKey: (todo) => todo.id,
  });

  return (
    <Panel
      title="useOptimisticList"
      description={
        <>
          {t("追加・削除・更新をサーバーの応答を待たずに反映し、失敗したら")}
          <strong className="text-fg">{t("その操作だけ")}</strong>{t("取り消します。\r\n          「配列を控えて戻す」実装だと、同時に走った他の操作まで巻き戻ります。\r\n          保留中の行は薄く表示されます。")}
        </>
      }
      code={`const list = useOptimisticList({
  load: (_, ctx) => jsonRequest<Todo[]>("/api/todos", { ctx }),
  getKey: (todo) => todo.id,
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
            placeholder={t("やることを追加")}
            aria-label={t("やることの題名")}
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
                    displayMessage: t("「{0}」の追加に失敗しました").replace("{0}", i.title),
                  });
                }
                const saved = { ...i, id: nextServerId++ };
                serverTodos = [...serverTodos, saved];
                return saved;
              });
            }}
          >
            {t("追加")}
          </Button>
        </Inline>

        <Stack space="2xs" dividers>
          {list.items.map((todo) => {
            const state = list.pendingOf(todo.id);
            return (
              <Inline
                key={todo.id}
                space="xs"
                wrap={false}
                className={state ? "opacity-50" : undefined}
              >
                {/* 四角だけだと 20px ほどしかなく指で押せません。
                    題名まで含めて <label> で包み、44px の当たり判定にします。 */}
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-xs">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    className="size-5 shrink-0 accent-primary"
                    onChange={() =>
                      void list.update(todo, { done: !todo.done }, async (i) => {
                        await wait(700);
                        if (/fail/i.test(i.title)) {
                          throw new ActionError("update failed", {
                            displayMessage: t("「{0}」の更新に失敗しました").replace("{0}", i.title),
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
                    className={`min-w-0 flex-1 text-sm ${todo.done ? "text-muted-fg line-through" : ""}`}
                  >
                    {todo.title}
                  </span>
                </label>
                {state && (
                  <span className="shrink-0 text-[11px] text-muted-fg">
                    {state === "add"
                      ? t("追加中")
                      : state === "remove"
                        ? t("削除中")
                        : t("更新中")}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void list.remove(todo, async (i) => {
                      await wait(900);
                      if (/fail/i.test(i.title)) {
                        throw new ActionError("delete failed", {
                          displayMessage: t("「{0}」の削除に失敗しました").replace("{0}", i.title),
                        });
                      }
                      serverTodos = serverTodos.filter((x) => x.id !== i.id);
                    })
                  }
                >
                  {t("削除")}
                </Button>
              </Inline>
            );
          })}
        </Stack>

        <Inline space="xs">
          <Button size="sm" variant="outline" onClick={list.refetch}>
            {t("再取得（保留中は消えません）")}
          </Button>
          <span className="self-center text-xs text-muted-fg">
            {t("保留中:")} {list.hasPending ? t("あり") : t("なし")}
          </span>
        </Inline>

        <Inline space="xs">
          <span className="text-xs text-muted-fg">
            <strong className="text-fg">
              {t("このデモの偽サーバーは、題名に fail を含むものだけ拒否します。")}
            </strong>
            {t("部品の仕様ではありません。失敗したときの戻り方を見るための細工です。")}
          </span>
        </Inline>
      </Stack>
    </Panel>
  );
}
