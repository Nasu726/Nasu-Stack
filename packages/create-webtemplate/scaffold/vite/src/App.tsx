import * as React from "react";
import { ActionProvider } from "@/components/ui/action-provider";
import { ThemeProvider, ThemeSwitcher } from "@/components/ui/theme-provider";
import { ActionButton, Button } from "@/components/ui/action-button";
import { AsyncForm, Field } from "@/components/ui/async-form";
import { Dialog } from "@/components/ui/dialog";
import { SiteHeader, SkipLink } from "@/components/ui/site-nav";
import { SiteFooter } from "@/components/ui/site-footer";
import { PageBlock, Stack, Section, Inline } from "@/components/ui/layout";

const NAV = [{ href: "#form", label: "フォーム" }];

export function App() {
  const [open, setOpen] = React.useState(false);

  return (
    // ActionProvider があると、部品が投げたエラーが自動で通知に出ます。
    // 無くても壊れません（「無くても動く。あると良くなる」）。
    <ThemeProvider>
      <ActionProvider>
        <SkipLink />
        <SiteHeader
          brand="__PROJECT_NAME__"
          brandHref="/"
          items={NAV}
          actions={<ThemeSwitcher />}
        />

        <PageBlock width="content" gutter="md" as="main" id="main" tabIndex={-1} className="py-3xl">
          <Stack space="3xl">
            <Section space="md">
              <h1 className="text-3xl leading-tight">
                ここから始めます
              </h1>
              <p className="max-w-prose text-sm leading-relaxed text-muted-fg">
                余白は段階から選ぶだけ、非同期の状態は部品が持ちます。
                この画面を書き換えて、自分のものにしてください。
              </p>
              <Inline space="sm">
                <Button onClick={() => setOpen(true)}>ダイアログを開く</Button>
                {/* 押している間のスピナー・二重送信の防止・失敗時の再実行は
                    ActionButton が持っています。渡すのは関数 1 つだけです。
                    （ふつうの Button に action はありません。用途で分かれています） */}
                <ActionButton
                  variant="outline"
                  action={async () => {
                    await new Promise((r) => setTimeout(r, 900));
                    return { ok: true };
                  }}
                >
                  1 秒かかる処理
                </ActionButton>
              </Inline>
            </Section>

            <Section space="md" id="form">
              <h2 className="text-2xl">フォーム</h2>
              <div className="max-w-md">
                <AsyncForm
                  action={async (values) => {
                    await new Promise((r) => setTimeout(r, 700));
                    return values;
                  }}
                  submitLabel="送信する"
                >
                  <Field name="name" label="お名前" required />
                  <Field name="message" label="ひとこと" multiline rows={4} />
                </AsyncForm>
              </div>
              <p className="max-w-prose text-xs text-muted-fg">
                実際の送信先へ繋ぐときは <code>createSubmit</code> を使います
                （<code>src/lib/submit.ts</code>）。
              </p>
            </Section>
          </Stack>
        </PageBlock>

        <SiteFooter brand="__PROJECT_NAME__" note="Built with WebTemplate" />

        <Dialog open={open} onOpenChange={setOpen} title="ダイアログ">
          <p className="text-sm text-muted-fg">
            Esc で閉じます。背面はスクロールしません。
          </p>
        </Dialog>
      </ActionProvider>
    </ThemeProvider>
  );
}
