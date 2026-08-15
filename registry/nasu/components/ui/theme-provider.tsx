"use client";

import * as React from "react";
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

const STORAGE_KEY = "webtemplate.theme";

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
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  defaultMode?: ColorMode;
  persist?: boolean;
}) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme);
  const [mode, setModeState] = React.useState<ColorMode>(defaultMode);
  const [systemDark, setSystemDark] = React.useState(false);

  // 初回に保存値を復元（SSR 中は実行されないので hydration mismatch を避けられる）
  React.useEffect(() => {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { theme?: ThemeName; mode?: ColorMode };
      if (saved.theme && THEMES.includes(saved.theme)) setThemeState(saved.theme);
      if (saved.mode) setModeState(saved.mode);
    } catch {
      /* 壊れた値は無視 */
    }
  }, [persist]);

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
    root.dataset.theme = theme;
    root.classList.toggle("dark", resolvedMode === "dark");
  }, [theme, resolvedMode]);

  const save = React.useCallback(
    (next: { theme?: ThemeName; mode?: ColorMode }) => {
      if (!persist) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme, mode, ...next }),
        );
      } catch {
        /* プライベートモード等は無視 */
      }
    },
    [persist, theme, mode],
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
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, resolvedMode, setMode } = useTheme();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div
        role="radiogroup"
        aria-label="デザインテーマ"
        className="flex gap-1 rounded-lg border border-border bg-card p-1"
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
export const themeInitScript = `
(function(){try{
  var s=localStorage.getItem("${STORAGE_KEY}");
  var v=s?JSON.parse(s):{};
  var t=v.theme||"neutral";
  var m=v.mode||"system";
  var dark=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme=t;
  document.documentElement.classList.toggle("dark",dark);
}catch(e){}})();
`.trim();
