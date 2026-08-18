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
        /const THEME_INIT_TEMPLATE = `([\s\S]*?)`\s*\.trim\(\);/,
      );
      const key = src.match(/const STORAGE_KEY = "([^"]+)"/);
      if (!m || !key) throw new Error("THEME_INIT_TEMPLATE を取り出せませんでした");
      /* 目印を実際の値へ差し替えます（makeThemeInitScript と同じ置換）。
         カタログは自分でトンマナを切り替えるので lockTheme は使いません。 */
      const script = m[1]
        .trim()
        .replaceAll("__WT_STORAGE_KEY__", key[1])
        .replace(
          "__WT_SET_THEME__",
          "document.documentElement.dataset.theme=t;",
        );
      return html.replace("<!--theme-init-->", `<script>${script}</script>`);
    },
  };
}

export default defineConfig({
  /* 公開先がサブパスのときに合わせます。
     ----------------------------------------------------------------
     GitHub Pages の project site は `https://<user>.github.io/<repo>/` の
     下に出ます。`base` を合わせないと、HTML は取れるのに **JS と CSS が
     404 になり、真っ白な画面**になります。deploy 自体は成功するので、
     「公開できたのに何も出ない」といういちばん困る壊れ方をします。

     利用者にも同じ問題が出ます（HowToUse の公開手順に書きました）。
     ここで自分が先に踏んでおくことで、実測した内容を案内に書けます。 */
  base: process.env.PUBLIC_BASE ?? "/",
  plugins: [react(), tailwindcss(), injectThemeInit()],
  resolve: {
    alias: {
      // レジストリのソースを直接参照する。
      // 利用者側のプロジェクトでは shadcn CLI が src/components 以下へ展開します。
      "@": registry,
    },
  },
});
