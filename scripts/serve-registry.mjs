/** public/ を静的配信します。公開物の動作確認用。
 *
 *   node scripts/serve-registry.mjs [port]
 *   BASE_PATH=/WebTemplate node scripts/serve-registry.mjs
 *
 * 本番（GitHub Pages）はリポジトリ名の下に出るので、同じ形に揃えられます。
 *
 * 配信そのものは scripts/_static.mjs が唯一の定義です。
 * ここに書き写すと、404 の扱いや content-type が 2 か所に分かれます。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "./_static.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);
const port = Number(process.argv[2] ?? 5055);
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

try {
  await serveStatic(root, port, { basePath });
  console.log(`registry: http://127.0.0.1:${port}${basePath}/r/<name>.json`);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
