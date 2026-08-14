import * as React from "react";
import { ActionButton, Button } from "@/components/ui/action-button";
import { AsyncForm, Field } from "@/components/ui/async-form";
import { DataList } from "@/components/ui/data-list";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { ThemeSwitcher, useTheme } from "@/components/ui/theme-provider";
import { useAction } from "@/hooks/use-action";
import * as api from "./fake-api";

export function App() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-5 pb-24 pt-10">
        <Intro />
        <ButtonSection />
        <FormSection />
        <ListSection />
        <AbortSection />
      </main>
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Header() {
  const { theme } = useTheme();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg">WebTemplate</span>
          <span className="text-xs text-muted-fg">/ {theme}</span>
        </div>
        <ThemeSwitcher />
      </div>
    </header>
  );
}

function Intro() {
  return (
    <section className="flex flex-col gap-3 pt-4">
      <h1 className="text-3xl leading-tight sm:text-4xl">
        関数をひとつ渡すだけで、
        <br />
        状態のあるUIが完成する。
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-fg">
        読込中・成功・失敗・空・二重送信・中断。
        これらを毎回書くのをやめるためのコンポーネント群です。
        上のスイッチでトンマナを切り替えると、色だけでなく角丸・影・書体まで一斉に変わります。
      </p>
    </section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-fg">{description}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-fg">
      <code>{children}</code>
    </pre>
  );
}

/* ---------------------------------------------------------------- */

function ButtonSection() {
  return (
    <Section
      title="ActionButton"
      description={
        <>
          <code className="text-fg">action</code> に関数を渡すだけ。
          押している間の無効化、連打の防止、成功の表示、失敗時のメッセージ、
          自動リトライが最初から入っています。
        </>
      }
    >
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-fg">成功する</span>
          <ActionButton action={api.save} labels={{ success: "保存しました" }}>
            保存する
          </ActionButton>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-fg">失敗する</span>
          <ActionButton action={api.alwaysFail}>送信する</ActionButton>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-fg">
            2回失敗→自動で3回目
          </span>
          <ActionButton action={api.flaky} retry={3} retryDelay={400}>
            同期する
          </ActionButton>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-fg">確認つき</span>
          <ActionButton
            action={api.save}
            variant="danger"
            confirm="本当に削除しますか？"
            labels={{ success: "削除しました" }}
          >
            削除する
          </ActionButton>
        </div>
      </div>

      <Code>{`<ActionButton action={() => api.save(form)}>
  保存する
</ActionButton>`}</Code>
    </Section>
  );
}

/* ---------------------------------------------------------------- */

function FormSection() {
  return (
    <Section
      title="AsyncForm + Field"
      description={
        <>
          送信関数を 1 つ渡すだけ。
          <code className="text-fg">ActionError</code> の{" "}
          <code className="text-fg">fields</code> に入れたエラーは、
          対応する入力欄の下へ自動で表示され、打ち直すと消えます。
          <br />
          <span className="text-xs">
            （メールを空欄や <code>a@example.com</code>{" "}
            にすると挙動が確認できます）
          </span>
        </>
      }
    >
      <div className="max-w-md">
        <AsyncForm
          action={api.signup}
          submitLabel="アカウントを作成"
          successMessage="登録が完了しました"
        >
          <Field name="name" label="お名前" placeholder="なす" required />
          <Field
            name="email"
            label="メールアドレス"
            type="email"
            placeholder="you@example.jp"
            hint="確認メールを送ります"
            required
          />
          <Field
            name="password"
            label="パスワード"
            type="password"
            hint="8 文字以上"
            required
          />
        </AsyncForm>
      </div>

      <Code>{`<AsyncForm action={api.signup} submitLabel="アカウントを作成">
  <Field name="email" label="メールアドレス" type="email" required />
</AsyncForm>`}</Code>
    </Section>
  );
}

/* ---------------------------------------------------------------- */

function ListSection() {
  const [which, setWhich] = React.useState<"ok" | "empty" | "error">("ok");
  const loader =
    which === "ok"
      ? api.listTasks
      : which === "empty"
        ? api.listEmpty
        : api.listBroken;

  return (
    <Section
      title="DataList / AsyncBoundary"
      description="取得・スケルトン・空状態・失敗と再試行を 1 コンポーネントに閉じ込めています。下のボタンで各状態を確認できます。"
    >
      <div className="mb-4 flex gap-2">
        {(["ok", "empty", "error"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={which === k ? "primary" : "outline"}
            onClick={() => setWhich(k)}
          >
            {k === "ok" ? "データあり" : k === "empty" ? "空" : "失敗"}
          </Button>
        ))}
      </div>

      <DataList
        key={which}
        title="タスク"
        loader={loader}
        deps={[which]}
        getKey={(t) => t.id}
        renderItem={(t) => (
          <div className="flex items-center justify-between gap-3">
            <span className={t.done ? "text-muted-fg line-through" : ""}>
              {t.title}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg">
              {t.owner}
            </span>
          </div>
        )}
      />

      <Code>{`<DataList
  loader={(_, ctx) => jsonRequest<Task[]>("/api/tasks", { ctx })}
  renderItem={(t) => <span>{t.title}</span>}
/>`}</Code>
    </Section>
  );
}

/* ---------------------------------------------------------------- */

function AbortSection() {
  const slow = useAction(api.slow, { resetAfter: 3000 });

  return (
    <Section
      title="中断とスケルトン"
      description="6 秒かかる処理です。実行中に「中断」を押すとリクエストが止まり、状態が idle に戻ります。ctx.signal を fetch に渡すだけで実現できます。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void slow.run(undefined)}
          disabled={slow.isPending}
        >
          {slow.isPending ? "処理中…" : "重い処理を実行"}
        </Button>
        <Button
          variant="outline"
          onClick={slow.abort}
          disabled={!slow.isPending}
        >
          中断
        </Button>
        <span className="text-xs text-muted-fg">status: {slow.status}</span>
      </div>

      <div className="mt-5">
        <AsyncBoundary
          state={slow}
          loading={
            slow.isPending ? undefined : (
              <p className="text-sm text-muted-fg">
                実行するとここに結果が出ます
              </p>
            )
          }
          skeletonRows={3}
          isEmpty={() => false}
        >
          {() => (
            <p className="text-sm text-success">処理が完了しました</p>
          )}
        </AsyncBoundary>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-muted-fg">
        WebTemplate — MIT License
      </div>
    </footer>
  );
}
