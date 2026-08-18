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

        {/*
          幅の指定は **PageBlock だけ**が持ちます。
          器を広くして中の <p> に max-w-prose を付けると、見出しは器いっぱいに
          伸びるのに本文だけ半分で止まり、画面を広げたときに右側が大きく空きます。
          **1 本の柱で幅を決めます。**
        */}
        <PageBlock width="prose" gutter="md" as="main" id="main" tabIndex={-1} className="py-3xl">
          <Stack space="3xl">
            <Section space="md">
              <h1 className="text-3xl leading-tight">
                ここから始めます
              </h1>
              <p className="text-base leading-relaxed">
                画面の土台はもうできています。あとは中身を自分のものに書き換えるだけです。
              </p>
              <p className="leading-relaxed text-muted-fg">
                この画面のファイルは <code className="text-fg">src/App.tsx</code> です。
                開いて書き換えると、ブラウザにすぐ反映されます。
                手順は <code className="text-fg">HowToUse.md</code> に書いてあります。
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
              <p className="leading-relaxed text-muted-fg">
                いまは送信しても、その場で結果を返しているだけです。
                実際に届くようにする手順は <code>HowToUse.md</code> にあります。
              </p>
            </Section>
          </Stack>
        </PageBlock>

        <SiteFooter brand="__PROJECT_NAME__" note="Built with Nasu Stack" />

        <Dialog open={open} onOpenChange={setOpen} title="ダイアログ">
          <p className="text-sm text-muted-fg">
            Esc で閉じます。背面はスクロールしません。
          </p>
        </Dialog>
      </ActionProvider>
    </ThemeProvider>
  );
}
