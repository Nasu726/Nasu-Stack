/** public/ を静的配信する最小サーバ。公開物の動作確認用。
 *
 *   node scripts/serve-registry.mjs [port]
 *
 * 本番（GitHub Pages）はリポジトリ名の下に出るので、こちらも同じ形に
 * 揃えられるようにしてあります。
 *
 *   BASE_PATH=/WebTemplate node scripts/serve-registry.mjs
 */
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
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

/**
 * content-type は拡張子から決めます。
 *
 * 以前はすべて `application/json` で返していました。レジストリしか
 * 置いていなかった頃は合っていましたが、**tarball も配るようになった今は嘘です。**
 * 嘘の content-type は、手元では動くのに公開先で落ちる類の差を隠します。
 */
const TYPES = {
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".tgz": "application/gzip",
  ".sha256": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (basePath && rel.startsWith(basePath)) rel = rel.slice(basePath.length) || "/";
  if (rel.endsWith("/")) rel += "index.html";

  const file = path.join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    // 本番と同じように、404 のときは 404.html を 404 のまま返します。
    const body = await readFile(path.join(root, "404.html")).catch(() => "not found");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" }).end(body);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`registry: http://127.0.0.1:${port}${basePath}/r/<name>.json`);
});
