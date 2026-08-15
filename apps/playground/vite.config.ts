import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const registry = fileURLToPath(new URL("../../registry/nasu", import.meta.url));

/**
 * ちらつき防止スクリプトを index.html へ差し込みます。
 *
 * 同じ処理を index.html に手書きすると、theme-provider.tsx 側と二重管理になり、
 * 片方だけ直し忘れたときに初回描画でちらつきます。
 * 唯一の定義である themeInitScript から取り出して埋め込みます。
 */
function injectThemeInit(): Plugin {
  return {
    name: "inject-theme-init",
    transformIndexHtml(html) {
      const src = readFileSync(
        `${registry}/components/ui/theme-provider.tsx`,
        "utf8",
      );
      const m = src.match(
        /export const themeInitScript = `([\s\S]*?)`\s*\.trim\(\);/,
      );
      const key = src.match(/const STORAGE_KEY = "([^"]+)"/);
      if (!m || !key) throw new Error("themeInitScript を取り出せませんでした");
      // テンプレートリテラル内の ${STORAGE_KEY} を実際の値へ差し替える
      const script = m[1].trim().replaceAll("${STORAGE_KEY}", key[1]);
      return html.replace("<!--theme-init-->", `<script>${script}</script>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), injectThemeInit()],
  resolve: {
    alias: {
      // レジストリのソースを直接参照する。
      // 利用者側のプロジェクトでは shadcn CLI が src/components 以下へ展開します。
      "@": registry,
    },
  },
});
