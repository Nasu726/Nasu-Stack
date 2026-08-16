import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// 静的サイト。動的な部分だけ React の island として差し込みます。
export default defineConfig({
  // 絶対 URL の起点。**これが無いと canonical も OGP も sitemap も作れません。**
  // 設定し忘れると相対パスのまま出て、静かに壊れます（Seo.astro が止めます）。
  // src/site.config.ts の SITE.url と同じ値にしてください。
  site: "https://example.com",
  image: {
    // 実測用: sharp を入れずに寸法だけ付くか確かめる
    service: passthroughImageService(),
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../../registry/nasu", import.meta.url)),
      },
    },
  },
});
