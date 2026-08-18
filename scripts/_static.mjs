/**
 * ビルド済みの中身を配る、最小の静的サーバ。**ここが唯一の定義です。**
 *
 * ----------------------------------------------------------------
 * なぜ道具の `preview` を使わないのか
 * ----------------------------------------------------------------
 * astro 7 で `astro preview` が**デーモンになりました。**
 *
 *   - 自分を子プロセスとして起動し直し、親はすぐ終了する
 *   - 既に動いていると「もう動いています」と言って**別のポートに逃げる**
 *   - 止めるには `astro preview stop` という別の口が要る
 *
 * 検査の土台は「指定したポートで、前面で動くサーバ」を前提にしていたので、
 * これで 8 工程がまとめて「接続できません」になりました。しかも
 * **握っている PID は既に死んでいる**ので、止めることもできません。
 *
 * こちらが見たいのは「ビルドした中身が正しく出るか」であって、
 * 「その道具の preview が動くか」ではありません。静的な出力を自分で配れば、
 * 相手の都合に振り回されずに済みます。**動く部品が 1 つ減ります。**
 *
 * 代わりに失うもの: 利用者が打つ `npm run preview` そのものは検査しません。
 * そこは道具側の責任なので、こちらでは持ちません。
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".tgz": "application/gzip",
  ".sha256": "text/plain; charset=utf-8",
};

async function readIf(file) {
  try {
    if ((await stat(file)).isFile()) return await readFile(file);
  } catch {
    /* 無い */
  }
  return null;
}

/**
 * `root` を `port` で配ります。
 *
 * @param {object} [opts]
 * @param {string} [opts.basePath]  本番がサブパス配信のときに合わせる（例 "/WebTemplate"）
 * @param {boolean} [opts.spa]      見つからないときに index.html を返す（Vite の SPA 用）
 * @returns {Promise<import("node:http").Server>} listen 済みのサーバ
 */
export function serveStatic(root, port, { basePath = "", spa = false } = {}) {
  const dir = path.resolve(root);
  const base = basePath.replace(/\/$/, "");

  const server = createServer(async (req, res) => {
    /* **decode は try の中で行います。**
       壊れた percent-encoding（`/%`）が 1 回来ると decodeURIComponent が
       投げ、**サーバのプロセスごと落ちます。** 検査中に落ちると、
       原因が「接続できません」としてしか出ないので追いにくい。
       Copilot の指摘（v0.9b）。 */
    let rel;
    try {
      rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    } catch {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      return void res.end("bad request");
    }
    /* **basePath の外は 404 にします。**
       ここを素通しにすると、`public/` が `/` と `/WebTemplate/` の
       両方に生えます。本番（GitHub Pages）で `/` にあるのは
       **別のサイト**なので、手元だけ `/index.html` が 200 で返り、
       「root を指したリンク」が通ってしまいます。

       v0.9c で実際にこれに騙されました。端末プレビューの iframe が
       `/?embed=1` を指したまま、公開先では 404 なのに、
       手元の判定は緑でした。**サーバの側が本番と違っていたためです。** */
    if (base) {
      if (rel === base) rel = "/";
      else if (rel.startsWith(`${base}/`)) rel = rel.slice(base.length);
      else rel = null;
    }

    const target = rel === null ? null : path.join(dir, rel);
    // ディレクトリを外に出る指定（../）を弾きます
    if (target !== null && !target.startsWith(dir))
      return void res.writeHead(403).end();

    // そのまま → ディレクトリなら index.html → 拡張子なしなら .html
    let body = target === null || rel.endsWith("/") ? null : await readIf(target);
    let file = target;
    if (!body && target !== null) {
      file = path.join(target, "index.html");
      body = await readIf(file);
    }
    if (!body && target !== null && !path.extname(target)) {
      file = `${target}.html`;
      body = await readIf(file);
    }
    if (!body && spa) {
      file = path.join(dir, "index.html");
      body = await readIf(file);
    }

    if (body) {
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      });
      return void res.end(body);
    }

    /* 見つからないときは **404 のステータスで** 404.html を返します。
       200 で返す静的ホスティングがありますが、それをこちらで真似ると
       「404 になっているつもり」の検査になります。 */
    const notFound = await readIf(path.join(dir, "404.html"));
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(notFound ?? "not found");
  });

  return new Promise((resolve, reject) => {
    server.once("error", (e) => {
      /* **埋まっているポートを黙って諦めてはいけません。**
         道具によっては次の番号へ勝手にずれるので、こちらが気づかないまま
         「前の実行が残したサーバ」に判定を当てることになります。
         理由を名指しで出して、そこで止めます。 */
      if (e.code === "EADDRINUSE") {
        reject(
          new Error(
            `ポート ${port} は既に使われています。前の実行が残したサーバを止めてください。\n` +
              `  Windows: netstat -ano -p TCP | findstr :${port} → taskkill /pid <PID> /F\n` +
              `  macOS/Linux: lsof -ti tcp:${port} | xargs kill -9`,
          ),
        );
      } else {
        reject(e);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
