import * as React from "react";
import { ActionButton, Button } from "@/components/ui/action-button";
import { AsyncForm, Field } from "@/components/ui/async-form";
import { DataList } from "@/components/ui/data-list";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { ThemeSwitcher, useTheme } from "@/components/ui/theme-provider";
import { useAction } from "@/hooks/use-action";
import {
  Column,
  Columns,
  ContentBlock,
  Inline,
  PageBlock,
  Spread,
  Stack,
  Tiles,
} from "@/components/ui/layout";
import { LayoutDemo } from "./LayoutDemo";
import { ResponsiveDemo } from "./ResponsiveDemo";
import * as api from "./fake-api";

type Tab = "layout" | "responsive" | "state";

/** 端末プレビューの iframe から読まれているときは、入れ子を避けて簡略表示にする。 */
const isEmbedded =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("embed");

export function App() {
  const [tab, setTab] = React.useState<Tab>("layout");

  if (isEmbedded) return <EmbeddedPreview />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Header tab={tab} onTab={setTab} />
      <PageBlock width="content" gutter="md" as="main" className="pb-3xl pt-xl">
        <Stack space="3xl">
          <Intro />
          {tab === "layout" ? (
            <LayoutDemo />
          ) : tab === "responsive" ? (
            <ResponsiveDemo />
          ) : (
            <Stack space="3xl">
              <ButtonSection />
              <FormSection />
              <ListSection />
              <AbortSection />
            </Stack>
          )}
        </Stack>
      </PageBlock>
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { theme } = useTheme();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur-md">
      <PageBlock width="content" gutter="md" className="py-sm">
        <Spread space="sm">
          <Inline space="sm" alignY="baseline">
            <span className="font-display text-lg">WebTemplate</span>
            <span className="text-xs text-muted-fg">/ {theme}</span>
          </Inline>
          <Inline space="sm">
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {(
                [
                  ["layout", "レイアウト"],
                  ["responsive", "端末幅"],
                  ["state", "状態"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => onTab(k)}
                  aria-pressed={tab === k}
                  className={
                    tab === k
                      ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg"
                      : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-fg hover:bg-muted hover:text-fg"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <ThemeSwitcher />
          </Inline>
        </Spread>
      </PageBlock>
    </header>
  );
}

function Intro() {
  return (
    <Stack space="sm">
      <h1 className="text-3xl leading-tight sm:text-4xl">
        余白は迷わせない。
        <br />
        状態は書かせない。
      </h1>
      <ContentBlock width="prose" align="start" className="text-sm">
        <p className="leading-relaxed text-muted-fg">
          余白は 9 段階が既定なので配置で迷いません。ただし壁ではなく、
          段階に無い値もそのまま書けます。
          非同期処理は関数を 1 つ渡すだけで、読込中・成功・失敗・空・二重送信・中断が付いてきます。
          上のスイッチでトンマナを切り替えると、色・角丸・影・書体・余白の広さまで一斉に変わります。
        </p>
      </ContentBlock>
    </Stack>
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
        <ContentBlock width="prose" align="start" className="text-sm">
          <p className="leading-relaxed text-muted-fg">{description}</p>
        </ContentBlock>
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

/** 端末プレビュー用の簡略ページ。実際のレイアウト部品だけで組んであります。 */
function EmbeddedPreview() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <PageBlock width="content" gutter="md" className="py-lg">
        <Stack space="lg">
          <Spread space="sm">
            <span className="font-display text-base">Studio Nasu</span>
            <Inline space="xs">
              <span className="text-xs text-muted-fg">Works</span>
              <span className="text-xs text-muted-fg">About</span>
            </Inline>
          </Spread>

          <Stack space="xs">
            <h1 className="text-2xl leading-tight">
              幅を変えても崩れません
            </h1>
            <ContentBlock width="prose" align="start" className="text-sm">
              <p className="leading-relaxed text-muted-fg">
                段組は狭い画面で自動的に縦へ畳み、タイルは列数が変わり、
                タグは折り返します。長い URL も折れます。
                https://example.com/very/long/path/that/never/breaks/anywhere
              </p>
            </ContentBlock>
          </Stack>

          <Columns space="md">
            <Column width="1/3">
              <div className="rounded-md bg-accent px-sm py-xs text-xs text-accent-fg">
                1/3
              </div>
            </Column>
            <Column>
              <div className="rounded-md bg-accent px-sm py-xs text-xs text-accent-fg">
                auto
              </div>
            </Column>
          </Columns>

          <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="sm">
            {["A", "B", "C"].map((t) => (
              <div
                key={t}
                className="rounded-md border border-border bg-card px-sm py-xs text-xs"
              >
                カード {t}
              </div>
            ))}
          </Tiles>

          <Inline space="xs">
            {["TypeScript", "React", "Astro", "Tailwind", "アクセシビリティ"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-fg"
                >
                  {t}
                </span>
              ),
            )}
          </Inline>
        </Stack>
      </PageBlock>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <PageBlock width="content" gutter="md" className="py-lg">
        <p className="text-xs text-muted-fg">WebTemplate — MIT License</p>
      </PageBlock>
    </footer>
  );
}
