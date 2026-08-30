/**
 * v0.8 前半の検証。docs/plan-v08.md の「実測で確かめる項目」に対応します。
 *
 * **実際に HTTP を飛ばして測ります。** モックを差し替えるだけでは
 * 「本当に送られたか」「相手に何が届いたか」が分かりません。
 * `scripts/_endpoint.mjs` を立てて、そこへ本物の POST を送ります。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { stopTree } from "./_proc.mjs";
import { createCheckHarness, log } from "./_check.mjs";
import { compileTypeScriptFixture } from "./_compiled-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4399;
const API = `http://127.0.0.1:${PORT}`;

const { must, report } = createCheckHarness();

/* --- 受け口サーバを立てる ---------------------------------------- */
const server = spawn(process.execPath, [path.join(root, "scripts/_endpoint.mjs"), String(PORT)], {
  stdio: "ignore",
  detached: process.platform !== "win32",
});
const stop = () => stopTree(server);

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 100));
  const ok = await fetch(`${API}/received`).then(
    (r) => r.ok,
    () => false,
  );
  if (ok) break;
}

const received = () => fetch(`${API}/received`).then((r) => r.json());
const reset = () => fetch(`${API}/reset`, { method: "POST" });

/* --- ブラウザ ---------------------------------------------------- */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

/**
 * ブラウザの中で createSubmit を使います。
 * バンドル済みのカタログを土台にすると読み込みが要るので、
 * ここでは**ソースを tsc で JS に落として、その場で評価**します。
 * 実際の fetch とブラウザの挙動（CORS・中断）をそのまま試すためです。
 */
import fs from "node:fs";

const out = path.join(root, ".verify-submit");
// `@/lib/action` の別名は tsconfig でしか解決できないので、その場で書きます
const compiled = compileTypeScriptFixture({
  root,
  out,
  compilerOptions: {
    rootDir: path.join(root, "registry", "nasu", "lib"),
    module: "esnext",
    target: "es2022",
    moduleResolution: "bundler",
    skipLibCheck: true,
    strict: true,
    baseUrl: root,
    paths: { "@/*": ["registry/nasu/*"] },
    lib: ["es2022", "dom"],
  },
  files: [
    path.join(root, "registry", "nasu", "lib", "action.ts"),
    path.join(root, "registry", "nasu", "lib", "submit.ts"),
  ],
});
// `@/lib/action` の別名をブラウザで解決できないので、相対に直します
const submitJs = fs
  .readFileSync(path.join(out, "submit.js"), "utf8")
  .replace(/from ["']@\/lib\/action["']/g, 'from "./action.js"');
fs.writeFileSync(path.join(out, "submit.js"), submitJs);

await page.goto(`${API}/received`, { waitUntil: "domcontentloaded" });
await page.addScriptTag({
  content:
    fs.readFileSync(path.join(out, "action.js"), "utf8").replace(/export /g, "") +
    "\nwindow.__action = { ActionError, toActionError, jsonRequest };",
});
await page.addScriptTag({
  content: submitJs
    .replace(/import[^;]+;/g, "")
    .replace(/export /g, "")
    .replace(/\bActionError\b/g, "window.__action.ActionError")
    .replace(/\bjsonRequest\b/g, "window.__action.jsonRequest")
    .replace(/window\.__action\.jsonRequest<[^>]*>/g, "window.__action.jsonRequest") +
    "\nwindow.__submit = { createSubmit, HONEYPOT_NAME };",
});

/** ブラウザ内で 1 回送って、結果かエラーを返します。 */
const send = (opts, input) =>
  page.evaluate(
    async ({ opts, input }) => {
      const submit = window.__submit.createSubmit(opts);
      const ctrl = new AbortController();
      try {
        const data = await submit(input, { signal: ctrl.signal });
        return { ok: true, data: data ?? null };
      } catch (e) {
        return {
          ok: false,
          name: e?.name,
          code: e?.code,
          displayMessage: e?.displayMessage,
          fields: e?.fields ?? null,
          message: String(e?.message ?? "").slice(0, 80),
        };
      }
    },
    { opts, input },
  );

/* ===== 1〜2. 正常系 ============================================= */
await reset();
{
  const r = await send({ url: `${API}/ok` }, { name: "なす", message: "こんにちは" });
  const got = await received();
  must("1. 実際に POST が飛ぶ", got.length === 1, `${got.length} 件`);
  must(
    "   送った内容がそのまま届く",
    got[0]?.body?.name === "なす" && got[0]?.body?.message === "こんにちは",
    JSON.stringify(got[0]?.body),
  );
  must(
    "2. Content-Type が application/json",
    (got[0]?.contentType ?? "").includes("application/json"),
    got[0]?.contentType,
  );
  must("   応答が返る", r.ok && r.data?.ok === true, JSON.stringify(r));
}

/* ===== 3. おとりの欄 ============================================ */
await reset();
{
  const r = await send(
    { url: `${API}/ok` },
    { name: "bot", wt_company_url: "http://spam.example" },
  );
  const got = await received();
  // 弾いたことを知らせると学習されるので、成功に見せます
  must("3. おとりに値があると送信しない", got.length === 0, `${got.length} 件`);
  must("   それでも成功として扱う（bot に教えない）", r.ok, JSON.stringify(r));
}
await reset();
{
  await send({ url: `${API}/ok` }, { name: "人間", wt_company_url: "" });
  const got = await received();
  must("   空のおとりは通す", got.length === 1);
  must(
    "   おとりの欄は送信先に届けない",
    got[0] && !("wt_company_url" in got[0].body),
    JSON.stringify(got[0]?.body),
  );
}

/* ===== 4〜5. 検証エラーの形 ===================================== */
{
  const r = await send({ url: `${API}/errors` }, { name: "" });
  must(
    "4. 422 の {errors:{…}} をフィールドエラーにする",
    r.fields?.name === "お名前を入力してください",
    JSON.stringify(r.fields),
  );
}
{
  const r = await send({ url: `${API}/fields` }, { email: "x" });
  must(
    "5. 422 の {fields:{…}} も同じように扱う",
    r.fields?.email === "この形式では受け取れません",
    JSON.stringify(r.fields),
  );
}

/* ===== 6〜8. おかしな応答 ======================================= */
{
  const r = await send({ url: `${API}/html500` }, { a: 1 });
  must(
    "6. 500 + HTML でも SyntaxError が漏れない",
    !r.ok && !/Unexpected token|JSON/.test(r.message),
    `${r.code} / ${r.displayMessage}`,
  );
  must(
    "   日本語のメッセージになる",
    /[ぁ-んァ-ヶ一-龠]/.test(r.displayMessage ?? ""),
    r.displayMessage,
  );
}
{
  const r = await send({ url: `${API}/empty` }, { a: 1 });
  must("7. 200 + 空の本文を成功として扱う", r.ok, JSON.stringify(r));
}
{
  const r = await send({ url: `${API}/html` }, { a: 1 });
  must(
    "8. 200 + HTML は成功にせず BAD_RESPONSE にする",
    !r.ok && r.code === "BAD_RESPONSE",
    JSON.stringify(r).slice(0, 100),
  );
}

/* ===== 8.5. JSON化とnetwork failureを混ぜない =================== */
await reset();
{
  const r = await page.evaluate(async (api) => {
    const submit = window.__submit.createSubmit({
      url: `${api}/ok`,
      transform: () => ({ id: 1n }),
    });
    try {
      await submit({}, { signal: new AbortController().signal });
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        code: e?.code,
        displayMessage: e?.displayMessage,
      };
    }
  }, API);
  const got = await received();
  must(
    "8.5 JSON化できないtransform結果はSERIALIZATIONになる",
    !r.ok && r.code === "SERIALIZATION",
    JSON.stringify(r),
  );
  must(
    "    serialization failureをNETWORK/CORSと誤案内せず送信もしない",
    !/CORS|通信状況/.test(r.displayMessage ?? "") && got.length === 0,
    `${r.displayMessage} / ${got.length}件`,
  );
}

/* ===== 9. 通信できない ========================================== */
{
  // 誰も listen していないポートへ送ります
  const r = await send({ url: "http://127.0.0.1:4498/nowhere" }, { a: 1 });
  must("9. 通信できないとき、英語が出ない", !/Failed to fetch/.test(r.displayMessage ?? ""), r.displayMessage);
  must("   CORS の可能性にも触れる（断定しない）", /CORS/.test(r.displayMessage ?? ""));
  must("   code が NETWORK", r.code === "NETWORK", String(r.code));
}

/* ===== 10. タイムアウト ========================================= */
{
  const r = await send({ url: `${API}/slow`, timeout: 300 }, { a: 1 });
  must("10. タイムアウトすると専用の文言になる", r.code === "TIMEOUT", r.displayMessage);
  must(
    "    「中断しました」とは言わない（原因が違う）",
    !/中断/.test(r.displayMessage ?? ""),
    r.displayMessage,
  );
}

/* ===== 11. 外からの中断 ========================================= */
{
  const r = await page.evaluate(async (api) => {
    const submit = window.__submit.createSubmit({ url: `${api}/slow` });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 150);
    try {
      await submit({ a: 1 }, { signal: ctrl.signal });
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e?.code, displayMessage: e?.displayMessage };
    }
  }, API);
  must("11. 画面から消えたときは ABORTED になる", r.code === "ABORTED", JSON.stringify(r));
}

/* ===== 12. プリフライト ========================================= */
{
  const res = await fetch(`${API}/ok`, {
    method: "OPTIONS",
    headers: {
      origin: "http://example.test",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  must(
    "12. 受け口が OPTIONS（プリフライト）に応える",
    res.status === 204 || res.status === 200,
    `status ${res.status}`,
  );
  must(
    "    content-type の送信を許可している",
    (res.headers.get("access-control-allow-headers") ?? "").includes("content-type"),
    res.headers.get("access-control-allow-headers"),
  );
}

/* ===== 13. HoneypotField の到達不能性 =========================== */
{
  const p2 = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await p2.goto(process.env.SITE_URL || "http://127.0.0.1:4321/contact/", {
    waitUntil: "networkidle",
  });
  const hp = await p2.evaluate(() => {
    const input = document.querySelector('input[name="wt_company_url"]');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return {
      ある: true,
      tabIndex: input.tabIndex,
      画面内: r.right > 0 && r.left < window.innerWidth,
      親がariaHidden: !!input.closest("[aria-hidden=true]"),
      display: getComputedStyle(input).display,
    };
  });
  must("13. おとりの欄がフォームにある", hp?.ある === true, JSON.stringify(hp));
  must("    Tab で到達できない", hp?.tabIndex === -1, String(hp?.tabIndex));
  must("    読み上げの対象外", hp?.親がariaHidden === true);
  must("    画面の外に出ている（display:none は使わない）", hp?.画面内 === false);
  must("    display は none にしない（bot に見抜かれる）", hp?.display !== "none", hp?.display);

  // 実際に Tab を押して、到達しないことを確かめます
  await p2.locator('input[name="name"]').focus();
  const reached = [];
  for (let i = 0; i < 6; i++) {
    await p2.keyboard.press("Tab");
    const n = await p2.evaluate(() => document.activeElement?.getAttribute("name") ?? "");
    reached.push(n);
  }
  must(
    "    Tab を 6 回押しても到達しない",
    !reached.includes("wt_company_url"),
    JSON.stringify(reached),
  );
  await p2.close();
}

/* ================================================================ */

compiled.cleanup();
await page.close();
await browser.close();
stop();

process.exit(report({ pageErrors }).ok ? 0 : 1);
