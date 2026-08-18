"use client";

import * as React from "react";
import { toInlineScriptJson } from "@/lib/inline-script";
import { cn } from "@/lib/utils";

export const THEMES = ["neutral", "warm", "editorial", "vivid"] as const;
export type ThemeName = (typeof THEMES)[number];
export type ColorMode = "light" | "dark" | "system";

export const THEME_LABELS: Record<ThemeName, string> = {
  neutral: "Neutral",
  warm: "Warm",
  editorial: "Editorial",
  vivid: "Vivid",
};

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  /** system を解決した実際の見た目。 */
  resolvedMode: "light" | "dark";
}

const ThemeContext = React.createContext<ThemeCtx | null>(null);

/**
 * 保存先の既定。
 *
 * **同じドメインに 2 つのサイトを置くとぶつかります。** localStorage は
 * origin 単位なので、`/app/` と `/docs/` は同じ入れ物を共有します。
 * 片方で選んだトンマナが、もう片方にもそのまま出ます。
 *
 * v0.9d で実際に起きました。カタログ（`/catalog/`）で vivid を選ぶと、
 * `data-theme="warm"` と書いてあるデモの LP まで vivid になりました。
 * **デモ側には切り替えボタンが無いので、見た人は戻せません。**
 *
 * 分けたいときは `storageKey` を渡してください。
 */
const STORAGE_KEY = "nasu-stack.theme";

/**
 * トンマナ切り替えの提供者。
 * `data-theme` と `.dark` を <html> に付け替えるだけで、
 * 色・角丸・影・フォントが一斉に切り替わります。
 */
export function ThemeProvider({
  children,
  defaultTheme = "neutral",
  defaultMode = "system",
  /** localStorage を使うか。Astro の静的ページでも安全に動きます。 */
  persist = true,
  /** 保存先。**同じドメインに別のサイトを置くときは分けてください。** */
  storageKey = STORAGE_KEY,
  /**
   * true にすると `data-theme` を書き換えません。明暗だけを切り替えます。
   *
   * **完成したサイトはこちらです。** HTML に書いたトンマナがそのまま残ります。
   * `makeThemeInitScript({ lockTheme: true })` と対で使ってください
   * （片方だけだと、初回描画の直後に上書きされます）。
   */
  lockTheme = false,
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  defaultMode?: ColorMode;
  persist?: boolean;
  storageKey?: string;
  lockTheme?: boolean;
}) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme);
  const [mode, setModeState] = React.useState<ColorMode>(defaultMode);
  const [systemDark, setSystemDark] = React.useState(false);

  // 初回に保存値を復元（SSR 中は実行されないので hydration mismatch を避けられる）
  React.useEffect(() => {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { theme?: ThemeName; mode?: ColorMode };
      if (saved.theme && THEMES.includes(saved.theme)) setThemeState(saved.theme);
      if (saved.mode) setModeState(saved.mode);
    } catch {
      /* 壊れた値は無視 */
    }
  }, [persist, storageKey]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

  React.useEffect(() => {
    const root = document.documentElement;
    if (!lockTheme) root.dataset.theme = theme;
    root.classList.toggle("dark", resolvedMode === "dark");
  }, [theme, resolvedMode, lockTheme]);

  const save = React.useCallback(
    (next: { theme?: ThemeName; mode?: ColorMode }) => {
      if (!persist) return;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ theme, mode, ...next }),
        );
      } catch {
        /* プライベートモード等は無視 */
      }
    },
    [persist, storageKey, theme, mode],
  );

  const setTheme = React.useCallback(
    (t: ThemeName) => {
      setThemeState(t);
      save({ theme: t });
    },
    [save],
  );

  const setMode = React.useCallback(
    (m: ColorMode) => {
      setModeState(m);
      save({ mode: m });
    },
    [save],
  );

  const value = React.useMemo(
    () => ({ theme, setTheme, mode, setMode, resolvedMode }),
    [theme, setTheme, mode, setMode, resolvedMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme は <ThemeProvider> の内側で呼んでください");
  }
  return ctx;
}

/** テーマ選択 UI。そのまま置くだけで使えます。 */
export function ThemeSwitcher({
  className,
  /**
   * トンマナ（4 種）のボタンも出すか。既定 true。
   *
   * **完成したサイトでは false にしてください。** 見に来た人が変えるのは
   * 明るさだけで、配色の系統は作った側が決めたものです。
   */
  themes = true,
}: {
  className?: string;
  themes?: boolean;
}) {
  const { theme, setTheme, resolvedMode, setMode } = useTheme();

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {/* テーマの数だけボタンが並ぶので、狭い画面では 1 行に収まりません。
          **折り返せるようにしておく必要があります。**
          flex の子は既定で min-width:auto なので、min-w-0 が無いと
          縮むことも折り返すこともできず、画面の外へ突き抜けます
          （実測: 320px のヘッダに置いて 15px はみ出し）。 */}
      {themes && (
        <div
          role="radiogroup"
          aria-label="デザインテーマ"
          className="flex min-w-0 flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
        >
          {THEMES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                theme === t
                  ? "bg-primary text-primary-fg"
                  : "text-muted-fg hover:bg-muted hover:text-fg",
              )}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setMode(resolvedMode === "dark" ? "light" : "dark")}
        aria-label={
          resolvedMode === "dark" ? "ライトモードにする" : "ダークモードにする"
        }
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-muted hover:text-fg"
      >
        {resolvedMode === "dark" ? "☾ Dark" : "☀ Light"}
      </button>
    </div>
  );
}

/**
 * ちらつき防止スクリプト。**必ずこれを参照してください。**
 *
 * 同じ処理を HTML 側へ手書きでコピーすると、片方だけ直し忘れたときに
 * そのページだけ初回描画でちらつきます（気づきにくい類のバグです）。
 *
 * React / Next.js:
 * ```tsx
 * <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 * ```
 *
 * Astro:
 * ```astro
 * <script is:inline set:html={themeInitScript} />
 * ```
 *
 * 素の HTML しか使えない場合は、ビルド時にこの文字列を差し込んでください
 * （Vite なら vite.config.ts の transformIndexHtml が使えます）。
 */
/**
 * 差し込む中身の**唯一の定義**です。目印を置き換えて使います。
 * （`apps/playground/vite.config.ts` もここを読んで index.html に埋めます。）
 */
const THEME_INIT_TEMPLATE = `
(function(){try{
  var s=localStorage.getItem(__WT_STORAGE_KEY__);
  var v=s?JSON.parse(s):{};
  var t=v.theme||"neutral";
  var m=v.mode||"system";
  var dark=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  __WT_SET_THEME__
  document.documentElement.classList.toggle("dark",dark);
}catch(e){}})();
`.trim();

/**
 * ちらつき防止スクリプトを組み立てます。
 *
 * @param storageKey 保存先。**同じドメインに別のサイトを置くなら分けてください。**
 * @param lockTheme  true にすると `data-theme` を書き換えません。
 *   HTML に書いたトンマナがそのまま残り、明暗だけが切り替わります。
 *   **完成したサイトはこちらです。** 見に来た人が変えるのは明るさだけで、
 *   配色の系統は作った側が決めたものだからです。
 */
export function makeThemeInitScript({
  storageKey = STORAGE_KEY,
  lockTheme = false,
}: { storageKey?: string; lockTheme?: boolean } = {}): string {
  /* **置換は関数で渡します。** 文字列で渡すと $& や $` が
     「一致した部分」などの指示として解釈されます。値に $ が 1 つ
     入るだけで、意図しない中身が入り込む余地ができます。 */
  return THEME_INIT_TEMPLATE.replaceAll(
    "__WT_STORAGE_KEY__",
    () => toInlineScriptJson(storageKey),
  ).replace(
    "__WT_SET_THEME__",
    () => (lockTheme ? "" : "document.documentElement.dataset.theme=t;"),
  );
}

/** 既定の設定で組み立てたもの。 */
export const themeInitScript = makeThemeInitScript();
