import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ActionProvider } from "@/components/ui/action-provider";
import { App } from "./App";
import "./index.css";

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
