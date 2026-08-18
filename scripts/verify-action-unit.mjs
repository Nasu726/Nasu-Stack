/**
 * 部品の「契約」の単体検査。
 *
 *   node scripts/verify-action-unit.mjs
 *
 * ここで見ているのは、**画面を見ても分からないもの**です。
 *
 *   - サーバのエラー文言を、そのまま画面に出していないか（P2-06）
 *   - `EndpointSpec.defaults` と入力の勝ち負け（P2-05）
 *   - `FileDrop` の `accept` が、落とした経路でも効くか（P2-04）
 *
 * どれも「動いているように見える」ので、実ブラウザの検査では出ません。
 * 内部の文言が漏れていても画面には何か出ますし、既定値が上書きされても
 * 送信そのものは成功します。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".verify-action");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/* upload.ts は `@/lib/action` を import するので、
   alias を持った tsconfig を一時的に作って渡します。
   （コマンドラインの引数では paths を渡せません。） */
const tsconfig = path.join(out, "tsconfig.json");
fs.writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      outDir: ".",
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
      skipLibCheck: true,
      baseUrl: path.join(root, "registry", "nasu"),
      paths: { "@/*": ["./*"] },
      types: [],
      lib: ["es2022", "dom"],
    },
    files: [
      path.join(root, "registry", "nasu", "lib", "action.ts"),
      path.join(root, "registry", "nasu", "lib", "upload.ts"),
    ],
  }),
);
execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
  { stdio: "inherit", cwd: root },
);
/* tsc は alias を出力に書き写すだけで、解決はしません。
   Node がそのまま読めるよう、ここで相対パスに直します。 */
const emitted = fs.readdirSync(out).filter((f) => f.endsWith(".js"));
for (const f of emitted) {
  const jsPath = path.join(out, f);
  let src = fs.readFileSync(jsPath, "utf8");
  for (const other of emitted) {
    const base = other.slice(0, -3);
    src = src
      .split('"@/lib/' + base + '"')
      .join('"./' + base + '.js"');
  }
  fs.writeFileSync(jsPath, src);
}
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const { jsonRequest, resolveAction } = await import(
  pathToFileURL(path.join(out, "action.js")).href
);
const { matchesAccept } = await import(
  pathToFileURL(path.join(out, "upload.js")).href
);

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}

const ctx = { signal: new AbortController().signal };

/* ===== P2-06. サーバの文言が画面に出ていないか =================== */
/**
 * サーバが返す `message` には、DB のエラーや内部の URL が入ります。
 * **利用者に見せる前提で書かれていません。**
 */
const realFetch = globalThis.fetch;
function fakeFetch(status, body) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

fakeFetch(500, {
  message: "PG::UniqueViolation on users.email at db-prod-3.internal:5432",
});
let caught;
try {
  await jsonRequest("/x", { ctx });
} catch (e) {
  caught = e;
}
must(
  "サーバの message を画面に出さない",
  !caught.displayMessage.includes("PG::UniqueViolation") &&
    !caught.displayMessage.includes("db-prod-3"),
  caught.displayMessage,
);
must(
  "  それでも開発者からは読める（message と cause に残る）",
  caught.message.includes("PG::UniqueViolation") &&
    JSON.stringify(caught.cause).includes("db-prod-3"),
);

fakeFetch(422, {
  message: "validation failed at UserValidator#call",
  userMessage: "入力内容を確認してください",
  fields: { email: "形式が正しくありません" },
});
try {
  await jsonRequest("/x", { ctx });
} catch (e) {
  caught = e;
}
must(
  "userMessage を入れたときはそれを出す",
  caught.displayMessage === "入力内容を確認してください",
  caught.displayMessage,
);
must("  fields はそのまま通る", caught.fields?.email === "形式が正しくありません");

/* ===== P2-05. defaults と入力の勝ち負け ========================== */
/**
 * 名前が `body`（「必ず混ぜる固定値」）のままだと、
 * **認可に使う値を置いても大丈夫だと読めてしまいます。**
 */
let sent;
globalThis.fetch = async (_url, init) => {
  sent = JSON.parse(init.body);
  return new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
const action = resolveAction({
  url: "/x",
  defaults: { source: "web", role: "guest" },
});
await action({ role: "admin", name: "a" }, ctx);
must(
  "defaults は入力に上書きされる（名前どおりの挙動）",
  sent.role === "admin" && sent.source === "web",
  JSON.stringify(sent),
);

globalThis.fetch = realFetch;

/* ===== P2-04. accept が落とした経路でも効くか ==================== */
/* 判定そのものは lib/upload.ts に置いてあります。**React に依存させません。**
   部品の中に書くと、ここで確かめるために写す必要が出て、
   写した瞬間に原本が 2 つになります。 */
{
  const f = (name, type) => ({ name, type });

  const cases = [
    ["image/* に png は通る", f("a.png", "image/png"), "image/*", true],
    ["image/* に pdf は通らない", f("a.pdf", "application/pdf"), "image/*", false],
    [".pdf に pdf は通る", f("a.pdf", "application/pdf"), ".pdf", true],
    [".pdf に png は通らない", f("a.png", "image/png"), ".pdf", false],
    ["完全一致", f("a.csv", "text/csv"), "text/csv", true],
    ["複数指定のどれかに合えば通る", f("a.pdf", "application/pdf"), "image/*,.pdf", true],
    ["accept が無ければ全部通る", f("a.exe", ""), undefined, true],
    ["大文字の拡張子も通る", f("A.PDF", ""), ".pdf", true],
    ["種類が空でも拡張子で判断できる", f("a.pdf", ""), ".pdf", true],
  ];
  for (const [label, file, accept, want] of cases) {
    must(`  ${label}`, matchesAccept(file, accept) === want);
  }
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
