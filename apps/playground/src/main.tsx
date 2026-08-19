import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ActionProvider } from "@/components/ui/action-provider";
import { App } from "./App";
import "./index.css";
import { LANG } from "./lang";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* アプリの一番外側に 1 回置くだけ。
          onError を書かなかったアクションの失敗が、画面隅の通知になります。 */}
      <ActionProvider>
        <App />
      </ActionProvider>
    </ThemeProvider>
  </StrictMode>,
);

/* 表示している言語に合わせます。**読み上げの発音がここで決まります。**
   英語の本文に lang="ja" が付いていると、日本語として読まれます。 */
document.documentElement.lang = LANG;
