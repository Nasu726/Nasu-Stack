/**
 * 検証用の受け口サーバ。
 *
 *   node scripts/_endpoint.mjs 4399
 *
 * **モックを差し替えるだけでは「本当に飛んだか」が分かりません。**
 * 実際に HTTP を受けて、何が届いたかを記録します。
 *
 * 経路ごとに違う応答を返します。
 *   POST /ok          → 200 { ok: true }
 *   POST /empty       → 200 本文なし（JSON ではない）
 *   POST /html        → 200 だが HTML（プロキシの挙動を模す）
 *   POST /html500     → 500 で HTML
 *   POST /errors      → 422 { errors: { name: "…" } }
 *   POST /fields      → 422 { fields: { name: "…" } }
 *   POST /slow        → 3 秒待ってから 200
 *   GET  /received    → これまでに受けた POST の一覧（検査用）
 *   POST /reset       → 記録を消す
 */
import http from "node:http";

const port = Number(process.argv[2] || 4399);
const received = [];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // プリフライト。ここが無いとブラウザは本体を送りません。
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/received") {
    res.writeHead(200, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify(received));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  if (url.pathname === "/reset") {
    received.length = 0;
    res.writeHead(200, { ...CORS, "content-type": "application/json" });
    res.end("{}");
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* JSON でなければ生のまま記録する */
  }
  received.push({
    path: url.pathname,
    method: req.method,
    contentType: req.headers["content-type"] ?? null,
    body: parsed ?? body,
    at: received.length,
  });

  const json = (status, obj) => {
    res.writeHead(status, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  switch (url.pathname) {
    case "/ok":
      return json(200, { ok: true, id: 1 });
    case "/empty":
      // 200 だが本文なし。res.json() は落ちます。
      res.writeHead(200, CORS);
      return res.end();
    case "/html":
      res.writeHead(200, { ...CORS, "content-type": "text/html" });
      return res.end("<!doctype html><h1>OK</h1>");
    case "/html500":
      res.writeHead(500, { ...CORS, "content-type": "text/html" });
      return res.end("<!doctype html><h1>502 Bad Gateway</h1>");
    case "/errors":
      return json(422, { errors: { name: "お名前を入力してください" } });
    case "/fields":
      return json(422, {
        message: "入力内容を確認してください",
        fields: { email: "この形式では受け取れません" },
      });
    case "/slow":
      await new Promise((r) => setTimeout(r, 3000));
      return json(200, { ok: true, slow: true });
    default:
      return json(404, { message: "not found" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`受け口サーバ: http://127.0.0.1:${port}`);
});
