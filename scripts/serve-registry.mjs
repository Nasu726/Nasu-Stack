/** public/ を静的配信する最小サーバ。レジストリの動作確認用。 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);
const port = Number(process.argv[2] ?? 5055);

createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`registry: http://127.0.0.1:${port}/r/<name>.json`);
});
