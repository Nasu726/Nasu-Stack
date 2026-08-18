import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  /**
   * 絶対 URL の起点。**これが無いと canonical も OGP も sitemap も作れません。**
   * 公開するドメインに書き換えてください。
   */
  site: "https://example.com",

  /**
   * 既定の画像サービスは sharp（native モジュール）を要求します。
   * passthrough なら sharp なしでも **width / height は付く**ので、
   * 「読み込みで本文がずれる」は防げます（変換はされません）。
   * 最適化が要るようになったら sharp を入れて、この行を消してください。
   */
  image: { service: passthroughImageService() },

  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // tsconfig.json の paths と同じ対応にしてください
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
