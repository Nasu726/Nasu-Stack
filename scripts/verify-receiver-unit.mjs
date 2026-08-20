/**
 * 受け口（examples/receivers/cloudflare-worker.ts）の単体検査。
 *
 *   node scripts/verify-receiver-unit.mjs
 *
 * ----------------------------------------------------------------
 * 外部のアカウントは要りません
 * ----------------------------------------------------------------
 * `fetch` を偽物に差し替えて、**メールが送られたかどうかを数えます。**
 * 「403 が返った」ではなく「送信が 0 回だった」を見るのが要点です。
 * 応答を読めなくても、副作用はサーバで起きているためです。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".verify-receiver");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    path.join(root, "examples", "receivers", "cloudflare-worker.ts"),
    "--outDir", out,
    "--module", "esnext",
    "--target", "es2022",
    "--moduleResolution", "bundler",
    "--skipLibCheck",
    "--lib", "es2022,dom",
  ],
  { stdio: "inherit", cwd: root },
);
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const worker = (
  await import(pathToFileURL(path.join(out, "cloudflare-worker.js")).href)
).default;

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}

const ORIGIN = "https://example.com";
const FULL = {
  ALLOWED_ORIGIN: ORIGIN,
  MAIL_API_KEY: "key",
  MAIL_TO: "to@example.com",
  MAIL_FROM: "form@verified.example",
};
const BODY = { name: "な", email: "a@b.example", message: "こんにちは" };

/** メール送信を数えながら worker を呼びます。 */
async function call({ env = FULL, origin = ORIGIN, type = "application/json", body = BODY, headers = {} } = {}) {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("{}", { status: 200 });
  };
  try {
    const req = new Request("https://worker.example/contact", {
      method: "POST",
      headers: { ...(origin ? { origin } : {}), ...(type ? { "content-type": type } : {}), ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    try {
      const res = await worker.fetch(req, env);
      return { status: res.status, sent, threw: null };
    } catch (threw) {
      return { status: null, sent, threw };
    }
  } finally {
    globalThis.fetch = real;
  }
}

/* ===== 設定が足りないとき ======================================== */
for (const key of ["ALLOWED_ORIGIN", "MAIL_API_KEY", "MAIL_TO", "MAIL_FROM"]) {
  const env = { ...FULL, [key]: undefined };
  const r = await call({ env });
  must(`${key} が無ければ 503`, r.status === 503, `HTTP ${r.status}`);
  must(`  そのときメールは送らない`, r.sent.length === 0, `${r.sent.length} 回`);
}

/* ===== 送信元 ==================================================== */
/**
 * **応答の CORS ヘッダだけでは止まりません。**
 * `text/plain` の単純リクエストはプリフライト無しで届き、
 * 攻撃者は応答を読めなくても**メールは送られます。**
 */
{
  const bad = await call({ origin: "https://evil.example" });
  must("違う送信元は 403", bad.status === 403, `HTTP ${bad.status}`);
  must("  そのときメールは送らない", bad.sent.length === 0, `${bad.sent.length} 回`);

  const plain = await call({ origin: "https://evil.example", type: "text/plain" });
  must("違う送信元 + text/plain でもメールは送らない", plain.sent.length === 0, `${plain.sent.length} 回`);

  const none = await call({ origin: null });
  must("送信元が無ければ 403", none.status === 403, `HTTP ${none.status}`);
}

/* ===== 中身の形 ================================================== */
{
  const r = await call({ type: "text/plain" });
  must("JSON でなければ 415", r.status === 415, `HTTP ${r.status}`);
  must("  そのときメールは送らない", r.sent.length === 0, `${r.sent.length} 回`);

  const jsonp = await call({ type: "application/jsonp" });
  must("application/jsonp は JSON として扱わない", jsonp.status === 415, `HTTP ${jsonp.status}`);
  must("  jsonp ではメールを送らない", jsonp.sent.length === 0, `${jsonp.sent.length} 回`);

  const vendor = await call({ type: "application/problem+json; charset=utf-8" });
  must("application/*+json は受け付ける", vendor.status === 200, `HTTP ${vendor.status}`);
}

/* ===== JSON として合法でも型が違う入力 ========================== */
{
  const cases = [
    ["null", null],
    ["array", []],
    ["name が number", { ...BODY, name: 1 }],
    ["email が array", { ...BODY, email: [] }],
    ["message が object", { ...BODY, message: {} }],
  ];
  for (const [label, body] of cases) {
    const r = await call({ body });
    must(`${label} は 400`, r.status === 400, `HTTP ${r.status}`);
    must(`  ${label} で例外を外へ投げない`, r.threw === null, String(r.threw ?? ""));
    must(`  ${label} でメールを送らない`, r.sent.length === 0, `${r.sent.length} 回`);
  }
}

/* ===== 大きさ ==================================================== */
{
  const big = "x".repeat(70 * 1024);
  const declared = await call({ body: JSON.stringify({ ...BODY, message: big }) });
  must("本文が大きすぎれば 413", declared.status === 413, `HTTP ${declared.status}`);
  must("  そのときメールは送らない", declared.sent.length === 0, `${declared.sent.length} 回`);
}

/* ===== 正常系 ==================================================== */
{
  const ok = await call();
  must("正しい要求は 200", ok.status === 200, `HTTP ${ok.status}`);
  must("  メールを 1 回送る", ok.sent.length === 1, `${ok.sent.length} 回`);
  must(
    "  差出人が MAIL_FROM と一致する",
    ok.sent[0]?.body.from === FULL.MAIL_FROM,
    ok.sent[0]?.body.from,
  );

  const invalid = await call({ body: { name: "", email: "x", message: "" } });
  must("検証エラーは 422", invalid.status === 422, `HTTP ${invalid.status}`);
  must("  そのときメールは送らない", invalid.sent.length === 0, `${invalid.sent.length} 回`);
}

/* ===== 外部サービスの失敗 ======================================== */
/** 相手の応答本文をログへ丸ごと出さないこと（P2-06）。 */
{
  const real = globalThis.fetch;
  const logged = [];
  const realErr = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  globalThis.fetch = async () =>
    new Response("内部の事情がここに入ります: db-prod-3.internal", { status: 500 });
  let status;
  try {
    const req = new Request("https://worker.example/contact", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(BODY),
    });
    status = (await worker.fetch(req, FULL)).status;
  } finally {
    globalThis.fetch = real;
    console.error = realErr;
  }
  must("外部サービスが失敗したら 502", status === 502, `HTTP ${status}`);
  must(
    "  相手の応答本文をログに出さない",
    !logged.join(" ").includes("db-prod-3.internal"),
    logged.join(" ").slice(0, 60),
  );
}

/* ================================================================ */
const failed = checks.filter((c) => !c.ok);
fs.rmSync(out, { recursive: true, force: true });
if (failed.length > 0) {
  console.error(`\n❌ ${checks.length} 件中 ${failed.length} 件が失敗しました`);
  for (const f of failed) console.error(`   ✗ ${f.label}  ${f.detail}`);
  process.exit(1);
}
console.log(`\n✅ 判定 ${checks.length} 件すべて成功`);
