import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { CopyButton } from "@/components/ui/copy-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAutosave } from "@/hooks/use-autosave";
import { ContentBlock, Inline, Stack } from "@/components/ui/layout";
import { Panel } from "../Panel";
import { t } from "../lang";

export function CopySection() {
  const [text, setText] = React.useState("https://example.com/articles/42");
  const [unmountProbe, setUnmountProbe] = React.useState(true);
  const labels = {
    copying: t("コピー中…"),
    success: t("コピーしました"),
    error: t("もう一度コピー"),
  };
  const announcements = {
    copying: t("コピーしています"),
    success: t("クリップボードにコピーしました"),
    error: t("コピーできませんでした"),
  };

  return (
    <Panel
      title="CopyButton / useCopy"
      description={t("Clipboard APIの成功・失敗・fallback・resetだけを扱います。コピーしてよい情報かは判断しません。秘密情報や個人情報を渡してよいかはapplication側で決めます。")}
      code={t("<CopyButton text={shareUrl}>リンクをコピー</CopyButton>\n\n// 独自の見た目や処理なら1段下へ\nconst copy = useCopy({ resetAfter: 2000 });\nawait copy.copy(text);")}
    >
      <Stack space="sm" align="start">
        <label className="flex w-full max-w-lg flex-col gap-xs text-sm font-medium">
          {t("コピーする文字")}
          <input
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            className="w-full rounded-md border border-input bg-bg px-sm py-xs text-base text-fg"
            data-testid="copy-text"
          />
        </label>
        <CopyButton
          text={text}
          labels={labels}
          announcements={announcements}
          resetAfter={300}
          data-testid="copy-main"
        >
          {t("リンクをコピー")}
        </CopyButton>

        {/* custom render / unmount timerは通常の見本と混ぜずDOMで測ります。 */}
        <div hidden data-testid="copy-probes">
          <CopyButton
            text="custom child"
            resetAfter={null}
            data-testid="copy-custom"
          >
            {({ status }) => `custom-${status}`}
          </CopyButton>
          <CopyButton
            text="callback failure"
            resetAfter={null}
            onCopied={() => {
              throw new Error("intentional copy callback failure");
            }}
            data-testid="copy-callback-failure"
          >
            callback copy
          </CopyButton>
          <button
            type="button"
            data-testid="copy-unmount-toggle"
            onClick={() => setUnmountProbe((mounted) => !mounted)}
          >
            toggle copy probe
          </button>
          {unmountProbe && (
            <CopyButton
              text="unmount timer"
              resetAfter={777}
              data-testid="copy-unmount"
            >
              unmount copy
            </CopyButton>
          )}
        </div>
      </Stack>
    </Panel>
  );
}

/** render failure と async failure を同じ箱へ押し込まないための見本。 */
export function ErrorBoundarySection() {
  const [caught, setCaught] = React.useState(0);

  return (
    <Panel
      title="ErrorBoundary"
      description={t("Reactのrender failureだけをこの範囲へ閉じ込めます。失敗するとfallbackへfocusし、siblingはそのまま残ります。event handlerやasync errorはuseAction / AsyncBoundaryの責任です。")}
      code={t("<ErrorBoundary\n  title=\"この部分を表示できませんでした\"\n  retryLabel=\"もう一度試す\"\n  onError={reportRenderFailure}\n>\n  <Dashboard />\n</ErrorBoundary>")}
    >
      <Inline space="md" alignY="start">
        <ErrorBoundary
          title={t("この見本を表示できませんでした")}
          description={t("ページのほかの部分はそのまま利用できます。")}
          retryLabel={t("もう一度試す")}
          onError={() => setCaught((count) => count + 1)}
        >
          <RenderFailureDemo />
        </ErrorBoundary>
        <p
          className="text-sm text-muted-fg"
          data-testid="error-boundary-sibling"
        >
          {t("境界の外側は利用できます。捕捉回数:")} {caught}
        </p>
      </Inline>
      <ErrorBoundaryFailureProbes />
    </Panel>
  );
}

function RenderFailureDemo() {
  const [broken, setBroken] = React.useState(false);
  if (broken) throw new Error("intentional render failure probe");
  return (
    <Button type="button" variant="outline" onClick={() => setBroken(true)}>
      {t("この範囲だけを壊す")}
    </Button>
  );
}

function AlwaysBroken({ message }: { message: string }): never {
  throw new Error(message);
}

function BrokenFallback(): never {
  throw new Error("intentional fallback failure probe");
}

/** callback / fallback 自身の failure を、通常の見本から分けて測る治具。 */
function ErrorBoundaryFailureProbes() {
  const [callbackProbe, setCallbackProbe] = React.useState(false);
  const [fallbackProbe, setFallbackProbe] = React.useState(false);
  const [resetProbe, setResetProbe] = React.useState(false);
  const [resetRevision, setResetRevision] = React.useState(0);
  return (
    <div hidden data-testid="error-boundary-probes">
      <button type="button" onClick={() => setCallbackProbe(true)}>
        callback probe
      </button>
      <button type="button" onClick={() => setFallbackProbe(true)}>
        fallback probe
      </button>
      <button type="button" onClick={() => setResetProbe(true)}>
        reset probe
      </button>
      <button type="button" onClick={() => setResetRevision((value) => value + 1)}>
        change reset key
      </button>
      {callbackProbe && (
        <ErrorBoundary
          onError={() => {
            throw new Error("intentional onError failure probe");
          }}
        >
          <AlwaysBroken message="intentional callback boundary probe" />
        </ErrorBoundary>
      )}
      {fallbackProbe && (
        <ErrorBoundary fallback={() => <BrokenFallback />}>
          <AlwaysBroken message="intentional last resort probe" />
        </ErrorBoundary>
      )}
      {resetProbe && (
        <ErrorBoundary resetKeys={[resetRevision]}>
          {resetRevision === 0 ? (
            <AlwaysBroken message="intentional reset key probe" />
          ) : (
            <span data-testid="error-boundary-reset-recovered">recovered</span>
          )}
        </ErrorBoundary>
      )}
    </div>
  );
}

interface DraftInput {
  text: string;
  wait: number;
}

/** debounce / coalescing / stale response を状態そのもので見られる見本。 */
export function AutosaveSection() {
  const [text, setText] = React.useState("");
  const [calls, setCalls] = React.useState<string[]>([]);
  const [aborts, setAborts] = React.useState(0);
  const [probeMounted, setProbeMounted] = React.useState(true);
  const [unmountAborts, setUnmountAborts] = React.useState(0);

  const draft = useAutosave<DraftInput, string>(
    async (input, context) => {
      setCalls((current) => [...current, input.text]);
      await waitForDraft(input.wait, context.signal, () =>
        setAborts((count) => count + 1),
      );
      if (input.text.includes("fail")) {
        throw new Error(t("下書きの保存に失敗しました"));
      }
      return input.text;
    },
    { delay: 250 },
  );

  const status = draft.isSaving
    ? t("保存中…")
    : draft.isError
      ? t("保存できませんでした")
      : draft.isDirty
        ? t("未保存の変更あり")
        : draft.isSaved
          ? t("保存済み")
          : t("まだ変更はありません");

  return (
    <Panel
      title="useAutosave"
      description={t("高速入力をdebounceし、保存中に増えた変更は途中の値を捨てて最新値だけを次へ送ります。cancelはUIへ古い結果を戻さないだけで、serverのwriteを取り消す保証ではありません。")}
      code={t("const draft = useAutosave(saveArticle, { delay: 800 });\n\n<textarea\n  onChange={(event) => draft.schedule(event.currentTarget.value)}\n  onBlur={draft.flush}\n/>\n<output aria-live=\"polite\">{draft.status}</output>")}
    >
      <ContentBlock width="32rem" align="start">
        <Stack space="sm">
          <label className="flex flex-col gap-xs text-sm font-medium">
            {t("下書き")}
            <textarea
              value={text}
              rows={3}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setText(next);
                draft.schedule({
                  text: next,
                  wait: next.startsWith("slow:") ? 600 : 80,
                });
              }}
              className="min-h-24 w-full rounded-md border border-border bg-bg px-sm py-xs text-base text-fg"
              data-testid="autosave-input"
            />
          </label>
          <Inline space="xs" alignY="center">
            <Button type="button" size="sm" variant="outline" onClick={draft.flush}>
              {t("今すぐ保存")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={draft.retry}
              disabled={!draft.isError}
            >
              {t("再試行")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={draft.cancel}
              disabled={!draft.isDirty && !draft.isSaving}
            >
              {t("未保存を破棄")}
            </Button>
          </Inline>
          <output
            aria-live="polite"
            className="text-sm text-muted-fg"
            data-testid="autosave-state"
            data-status={draft.status}
            data-dirty={draft.isDirty ? "true" : "false"}
            data-calls={JSON.stringify(calls)}
            data-saved={draft.data ?? ""}
            data-aborts={aborts}
          >
            {status}
            {draft.error ? `: ${draft.error.displayMessage}` : ""}
          </output>
          <button
            type="button"
            hidden
            data-testid="autosave-reset"
            onClick={draft.reset}
          >
            reset
          </button>
        </Stack>
      </ContentBlock>

      <div hidden data-testid="autosave-unmount-probe">
        {probeMounted && (
          <AutosaveUnmountProbe
            onAbort={() => setUnmountAborts((count) => count + 1)}
          />
        )}
        <button type="button" onClick={() => setProbeMounted(false)}>
          unmount
        </button>
        <output data-testid="autosave-unmount-aborts">{unmountAborts}</output>
      </div>
    </Panel>
  );
}

function waitForDraft(
  milliseconds: number,
  signal: AbortSignal,
  onAbort: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        onAbort();
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function AutosaveUnmountProbe({ onAbort }: { onAbort: () => void }) {
  const draft = useAutosave<string, string>(
    async (input, context) => {
      await waitForDraft(5_000, context.signal, () => queueMicrotask(onAbort));
      return input;
    },
    { delay: 0 },
  );
  return (
    <button type="button" onClick={() => draft.schedule("unmount")}>
      start
    </button>
  );
}

/**
 * 不正な retryDelay が run() の未処理 rejection にならないことを測る治具。
 * 見本として見せる UI ではないので hidden にし、検査は DOM から直接起動します。
 * 例外 callback は上の実例で、値の境界はここでそれぞれ退行を止めます。
 */
