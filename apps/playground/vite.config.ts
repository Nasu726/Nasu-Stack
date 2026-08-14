import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // レジストリのソースを直接参照する。
      // 利用者側のプロジェクトでは shadcn CLI が src/components 以下へ展開します。
      "@": fileURLToPath(new URL("../../registry/nasu", import.meta.url)),
    },
  },
});
