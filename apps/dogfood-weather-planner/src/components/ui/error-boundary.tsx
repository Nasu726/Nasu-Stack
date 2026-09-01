"use client";

import * as React from "react";
import { Button } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

export interface ErrorBoundaryFallbackProps {
  /** React render 中に捕捉した error。 */
  error: Error;
  /** 子 subtree を新しく描画し直します。 */
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 独自 fallback。関数なら error と reset を受け取れます。 */
  fallback?:
    | React.ReactNode
    | ((props: ErrorBoundaryFallbackProps) => React.ReactNode);
  /** 値のどれかが Object.is で変わると、自動で reset します。 */
  resetKeys?: readonly unknown[];
  /** error reporting の口。ここで throw / reject しても fallback は維持します。 */
  onError?: (
    error: Error,
    info: React.ErrorInfo,
  ) => void | Promise<void>;
  /** 手動または resetKeys による復帰時の口。 */
  onReset?: () => void | Promise<void>;
  /** 既定 fallback の見出し。 */
  title?: React.ReactNode;
  /** 既定 fallback の説明。 */
  description?: React.ReactNode;
  /** 既定 fallback の retry button。 */
  retryLabel?: React.ReactNode;
  className?: string;
}

interface BoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "Unknown render error");
}

function keysChanged(
  previous: readonly unknown[] | undefined,
  current: readonly unknown[] | undefined,
): boolean {
  if (previous === current) return false;
  if (!previous || !current || previous.length !== current.length) return true;
  return previous.some((value, index) => !Object.is(value, current[index]));
}

function reportCallbackFailure(name: "onError" | "onReset", error: unknown) {
  // callback の失敗を render failure として再度投げると、fallback まで失います。
  // 報告先自体の監視は利用側の責任なので、ここでは console に隔離します。
  console.error(`[ErrorBoundary] ${name} callback threw`, error);
}

function callSafely(
  name: "onError" | "onReset",
  callback: (() => void | Promise<void>) | undefined,
) {
  if (!callback) return;
  try {
    void Promise.resolve(callback()).catch((error) =>
      reportCallbackFailure(name, error),
    );
  } catch (error) {
    reportCallbackFailure(name, error);
  }
}

class RenderErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { error: null };
  private fallbackElement: HTMLDivElement | null = null;

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    callSafely("onError", () => this.props.onError?.(error, info));
    this.focusFallback();
  }

  componentDidUpdate(
    previousProps: ErrorBoundaryProps,
    previousState: BoundaryState,
  ) {
    if (this.state.error && keysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset();
      return;
    }
    if (!previousState.error && this.state.error) this.focusFallback();
  }

  private focusFallback = () => {
    // componentDidCatch / componentDidUpdate の時点で fallback DOM は commit 済みです。
    this.fallbackElement?.focus();
  };

  private reset = () => {
    this.setState({ error: null });
    callSafely("onReset", this.props.onReset);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const fallbackProps: ErrorBoundaryFallbackProps = {
      error,
      reset: this.reset,
    };
    if (typeof this.props.fallback === "function") {
      return this.props.fallback(fallbackProps);
    }
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        ref={(node) => {
          this.fallbackElement = node;
        }}
        role="alert"
        tabIndex={-1}
        className={cn(
          "flex flex-col items-start gap-sm rounded-lg border border-danger/30",
          "bg-danger/5 p-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
          this.props.className,
        )}
        data-error-boundary-fallback=""
      >
        <p className="font-medium text-danger">
          {this.props.title ?? "This section could not be displayed"}
        </p>
        <p className="text-sm text-muted-fg">
          {this.props.description ??
            "The rest of the page is still available. Please try again."}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={this.reset}>
          {this.props.retryLabel ?? "Try again"}
        </Button>
      </div>
    );
  }
}

/** fallback 自体が throw したときだけ使う、依存のない最後の受け皿。 */
class FallbackGuard extends React.Component<
  { children: React.ReactNode; resetKeys?: readonly unknown[] },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary] fallback threw", error);
  }

  componentDidUpdate(previousProps: {
    children: React.ReactNode;
    resetKeys?: readonly unknown[];
  }) {
    if (
      this.state.failed &&
      keysChanged(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-danger/30 bg-danger/5 p-md text-sm text-danger"
          data-error-boundary-last-resort=""
        >
          This section could not be displayed.
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * React render failure を、この component subtree だけに閉じ込めます。
 *
 * event handler / async callback / Server Component / SSR の error は捕捉しません。
 * それらを ActionError や AsyncBoundary と混ぜないことが、この部品の境界です。
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <FallbackGuard resetKeys={props.resetKeys}>
      <RenderErrorBoundary {...props} />
    </FallbackGuard>
  );
}
