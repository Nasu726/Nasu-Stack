import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // tsconfig.json の paths と同じ対応にしてください。
      // ここがずれると、型は通るのに実行時に見つからない、が起きます。
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
