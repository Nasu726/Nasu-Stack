import * as React from "react";
import { Box, Inline, Stack } from "@/components/ui/layout";
import { ActionButton, Button } from "@/components/ui/action-button";
import { useConfirm, useToast } from "@/components/ui/action-provider";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { AsyncSelect } from "@/components/ui/async-select";
import { FileDrop } from "@/components/ui/file-drop";
import { ActionError } from "@/lib/action";
import type { UploadContext } from "@/lib/upload";
import { Panel } from "./Panel";

export function PartsDemo() {
  return (
    <Stack space="3xl">
      <ConfirmSection />
      <TableSection />
      <SelectSection />
      <UploadSection />
    </Stack>
  );
}

/* ================================================================
 * ConfirmDialog
 * ============================================================== */

function ConfirmSection() {
  const confirm = useConfirm();
  const toast = useToast();

  return (
    <Panel
      title="ConfirmDialog"
      description={
        <>
          ブラウザ標準の <code className="text-fg">&lt;dialog&gt;</code> を使っています。
          フォーカスの閉じ込め・背景の暗転・Esc で閉じる・最前面表示・
          閉じたあとのフォーカス復帰が、全部ブラウザ任せになります。
          Provider が無いときは <code className="text-fg">window.confirm</code>{" "}
          に落ちるので、置かなくても壊れません。
        </>
      }
      code={`// ボタンから出すなら、これだけです。await も if も要りません。
<ActionButton
  variant="danger"
  confirm={{
    title: "この記事を削除しますか？",
    description: "元に戻せません。",
    confirmLabel: "削除する",
    tone: "danger",
  }}
  action={() => api.remove(id)}
>
  削除する
</ActionButton>

// ボタン以外（メニューの項目など）から出したいときだけ、直接呼びます
const confirm = useConfirm();
if (!(await confirm("下書きを破棄しますか？"))) return;`}
    >
      <Inline space="sm">
        {/* 確認は ActionButton の confirm に任せます。
            取り消したら action は呼ばれません。 */}
        <ActionButton
          variant="danger"
          confirm={{
            title: "この記事を削除しますか？",
            description: "元に戻せません。",
            confirmLabel: "削除する",
            tone: "danger",
          }}
          action={() => new Promise((r) => setTimeout(r, 400))}
          labels={{ success: "削除しました" }}
        >
          削除する
        </ActionButton>

        <Button
          variant="outline"
          onClick={async () => {
            const ok = await confirm("下書きを破棄しますか？");
            toast.show({
              tone: ok ? "warning" : "info",
              title: ok ? "破棄しました" : "取り消しました",
            });
          }}
        >
          文字列だけ渡す
        </Button>
      </Inline>
      <p className="text-xs text-muted-fg">
        見本です。押しても実際には何も消えません。
      </p>
    </Panel>
  );
}

/* ================================================================
 * DataTable
 * ============================================================== */

interface Row {
  id: number;
  date: string;
  title: string;
  stack: string;
  status: string;
  owner: string;
  count: number;
  amount: number;
}

/* 見本の中身は**誰のものでもない値**にします。
   実在の案件名や氏名を置くと、そのまま公開ページに載ります。 */
const ROWS: Row[] = [
  { id: 1, date: "2026-08-01", title: "案件 A", stack: "Unity / C#", status: "進行中", owner: "me", count: 3, amount: 12400 },
  { id: 2, date: "2026-07-18", title: "案件 B", stack: "TypeScript", status: "完了", owner: "me", count: 8, amount: 8900 },
  { id: 3, date: "2026-07-02", title: "案件 C", stack: "Python", status: "完了", owner: "me", count: 21, amount: 24100 },
  { id: 4, date: "2026-06-20", title: "案件 D", stack: "React / Astro", status: "進行中", owner: "me", count: 5, amount: 3300 },
  { id: 5, date: "2026-06-11", title: "案件 E", stack: "Astro", status: "完了", owner: "collaborator", count: 2, amount: 5600 },
  { id: 6, date: "2026-05-30", title: "案件 F", stack: "Rust", status: "停止", owner: "me", count: 13, amount: 18200 },
  { id: 7, date: "2026-05-14", title: "案件 G", stack: "Python", status: "完了", owner: "me", count: 34, amount: 9700 },
  { id: 8, date: "2026-04-28", title: "案件 H", stack: "Godot", status: "完了", owner: "collaborator", count: 1, amount: 2100 },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: "date", label: "日付", sortable: true },
  { key: "title", label: "案件", sortable: true },
  { key: "stack", label: "技術" },
  { key: "status", label: "状態", sortable: true },
  { key: "owner", label: "担当", hideOnCard: true },
  { key: "count", label: "件数", sortable: true, align: "end" },
  {
    key: "amount",
    label: "金額",
    sortable: true,
    align: "end",
    get: (r) => `¥${r.amount.toLocaleString("ja-JP")}`,
  },
];

function TableSection() {
  const toast = useToast();
  return (
    <Panel
      title="DataTable"
      description={
        <>
          320px で 8 列の表は、横スクロールできても実用に耐えません。
          なので<strong className="text-fg">タブレット幅未満では 1 行 = 1 カード</strong>に組み替え、
          各値に列名を付けます。列定義の{" "}
          <code className="text-fg">label</code>{" "}
          が必須なのはそのためです。ウィンドウを狭めると切り替わります。
        </>
      }
      code={`<DataTable rows={rows} columns={columns} pageSize={5} />

// 列定義。label はカード表示で唯一の手がかりになるので必須
{ key: "amount", label: "金額", sortable: true, align: "end",
  get: (r) => \`¥\${r.amount.toLocaleString("ja-JP")}\` }`}
    >
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getKey={(r) => r.id}
        pageSize={5}
        caption="案件の一覧"
        onRowClick={(r) => toast.show({ tone: "info", title: r.title })}
      />
    </Panel>
  );
}

/* ================================================================
 * AsyncSelect
 * ============================================================== */

interface User {
  id: number;
  name: string;
  team: string;
}

const USERS: User[] = [
  { id: 1, name: "me", team: "自分" },
  { id: 2, name: "Aoi Tanaka", team: "デザイン" },
  { id: 3, name: "Bob Carter", team: "開発" },
  { id: 4, name: "千葉 みなと", team: "開発" },
  { id: 5, name: "Diego Alvarez", team: "QA" },
  { id: 6, name: "Emi Nakagawa", team: "デザイン" },
  { id: 7, name: "藤本 かえで", team: "開発" },
  { id: 8, name: "Grace Liu", team: "PM" },
  { id: 9, name: "橋本 そら", team: "QA" },
  { id: 10, name: "Ivan Petrov", team: "開発" },
];

function SelectSection() {
  const [picked, setPicked] = React.useState<User | null>(null);

  return (
    <Panel
      title="AsyncSelect"
      description={
        <>
          入力のたびに投げないよう 250ms の debounce を入れ、
          打ち直すと<strong className="text-fg">前のリクエストは自動で中断</strong>されます
          （検索語を <code className="text-fg">useResource</code>{" "}
          の依存キーにしているため）。古い応答が新しい応答を上書きする競合は、
          この層で既に解けています。↑↓ Enter Esc Home End で操作できます。
        </>
      }
      code={`<AsyncSelect
  label="担当者"
  loader={(q, ctx) => jsonRequest<User[]>(\`/api/users?q=\${q}\`, { ctx })}
  getKey={(u) => u.id}
  getLabel={(u) => u.name}
  onChange={setOwner}
/>`}
    >
      <Stack space="sm">
        <div className="max-w-sm">
          <AsyncSelect<User>
            label="担当者"
            placeholder="名前で検索"
            hint="入力すると絞り込みます（応答に 350ms かかる想定にしてあります）"
            loader={async (q, ctx) => {
              await new Promise((r) => setTimeout(r, 350));
              if (ctx.signal.aborted) return [];
              const s = q.trim().toLowerCase();
              return s
                ? USERS.filter(
                    (u) =>
                      u.name.toLowerCase().includes(s) || u.team.includes(s),
                  )
                : USERS;
            }}
            getKey={(u) => u.id}
            getLabel={(u) => u.name}
            renderItem={(u) => (
              <span className="flex items-baseline justify-between gap-2">
                <span>{u.name}</span>
                <span className="text-xs text-muted-fg">{u.team}</span>
              </span>
            )}
            value={picked}
            onChange={setPicked}
          />
        </div>
        <p className="text-xs text-muted-fg">
          選択中: {picked ? `${picked.name}（${picked.team}）` : "なし"}
        </p>
      </Stack>
    </Panel>
  );
}

/* ================================================================
 * FileDrop
 * ============================================================== */

/** 進捗つきアップロードの偽物。実際は uploadWithProgress を渡します。 */
function fakeUpload(file: File, ctx: UploadContext): Promise<{ ok: true }> {
  return new Promise((resolve, reject) => {
    // 名前に "fail" が入っていたら失敗させる（再送を試せるように）
    const willFail = /fail/i.test(file.name);
    let sent = 0;
    const step = () => {
      if (ctx.signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      sent += 0.08 + Math.min(0.06, file.size / 5_000_000);
      ctx.onProgress(Math.min(1, sent));
      if (sent >= 1) {
        if (willFail) {
          reject(
            new ActionError("upload failed", {
              displayMessage: "サーバーが受け取りを拒否しました",
              code: 422,
            }),
          );
        } else {
          resolve({ ok: true });
        }
        return;
      }
      setTimeout(step, 120);
    };
    setTimeout(step, 120);
  });
}

function UploadSection() {
  return (
    <Panel
      title="FileDrop"
      description={
        <>
          <strong className="text-fg">fetch はアップロードの進捗を取れません。</strong>
          ストリームで測れるのは「ブラウザがデータを引き取った時点」で、
          送信完了ではないためです。なので内部では XHR を使いますが、
          <code className="text-fg">uploadWithProgress</code>{" "}
          が隠すので利用者が XHR を書くことはありません。
          1 ファイルずつ送るので、失敗した分だけ再送できます。
        </>
      }
      code={`<FileDrop
  action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)}
  accept="image/*"
  maxSize={5 * 1024 * 1024}
/>`}
    >
      <Box className="max-w-lg">
        <FileDrop
          action={fakeUpload}
          maxSize={2 * 1024 * 1024}
          hint="1 ファイル 2 MB まで"
        />
        <p className="mt-xs text-xs text-muted-fg">
          見本です。選んだファイルはどこにも送られません（進捗は偽物です）。
          <strong className="text-fg">
            このデモの偽サーバーは、名前に <code>fail</code> を含むファイルだけ拒否します。
          </strong>
          部品の仕様ではありません。
        </p>
      </Box>
    </Panel>
  );
}
