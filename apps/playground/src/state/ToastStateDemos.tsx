import * as React from "react";
import { ActionButton, Button } from "@/components/ui/action-button";
import { useToast } from "@/components/ui/action-provider";
import { Inline } from "@/components/ui/layout";
import { Panel } from "../Panel";
import { t } from "../lang";

export function ToastDurationProbe() {
  const toast = useToast();
  return (
    <div hidden data-testid="toast-duration-probe">
      <button
        type="button"
        data-testid="toast-duration-run"
        onClick={() =>
          toast.show({
            title: "explicit-duration-probe",
            duration: 200,
            action: { label: "probe-action", onClick: () => {} },
          })
        }
      >
        run
      </button>
    </div>
  );
}

/** 見出しつきの縦組み。デモで「何を試しているか」を示すためだけの薄い包み。 */
export function ToastSection() {
  const toast = useToast();
  const [undoCount, setUndoCount] = React.useState(0);

  return (
    <Panel
      title={t("ActionProvider — 書き忘れの受け皿")}
      description={
        <>
          <code className="text-fg">onError</code> {t("を書かなかったアクションが失敗すると、\r\n          画面隅に通知が出ます。エラー処理の書き忘れが握り潰されなくなります。\r\n          個別に")} <code className="text-fg">onError</code> {t("を書いた場合はそちらが優先され、通知は出ません。")}
        </>
      }
      code={`<ActionProvider>\n  <App />\n</ActionProvider>`}
    >
      <Inline space="sm">
        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error(t("在庫の取得に失敗しました"));
          }}
          showError={false}
          variant="outline"
        >
          {t("onError を書かずに失敗させる")}
        </ActionButton>

        <ActionButton
          action={async () => {
            await new Promise((r) => setTimeout(r, 600));
            throw new Error(t("これは通知されない"));
          }}
          onError={(e) => {
            toast.show({
              tone: "warning",
              title: t("自前で処理しました"),
              description: e.displayMessage,
            });
          }}
          showError={false}
          variant="outline"
        >
          {t("onError を自分で書く")}
        </ActionButton>

        <Button
          variant="ghost"
          onClick={() =>
            toast.show({
              tone: "success",
              title: t("保存しました"),
              description: t("3 件の変更を反映しました"),
              action: {
                label: t("元に戻す"),
                onClick: () => setUndoCount((count) => count + 1),
              },
            })
          }
        >
          {t("通知を直接出す")}
        </Button>
        <span hidden data-testid="toast-undo-count">{undoCount}</span>
      </Inline>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
