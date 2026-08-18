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
      rootDir: path.join(root, "registry", "nasu"),
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
      skipLibCheck: true,
      baseUrl: path.join(root, "registry", "nasu"),
      paths: { "@/*": ["./*"] },
      types: [],
      lib: ["es2022", "dom"],
      jsx: "react-jsx",
    },
    files: [
      path.join(root, "registry", "nasu", "lib", "action.ts"),
      path.join(root, "registry", "nasu", "lib", "upload.ts"),
      path.join(root, "registry", "nasu", "lib", "inline-script.ts"),
      /* theme-provider は React を import しますが、確かめたい
         makeThemeInitScript は React に触りません。**本物を測ります。**
         文字列を写して測ると、原本が変わったときに気づけません。 */
      path.join(root, "registry", "nasu", "lib", "utils.ts"),
      path.join(root, "registry", "nasu", "components", "ui", "theme-provider.tsx"),
    ],
  }),
);
execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
  { stdio: "inherit", cwd: root },
);
/* tsc は alias を出力に書き写すだけで、解決はしません。
   出力は元の木の形（lib/ と components/ui/）で出るので、
   **深さに合わせた相対パス**へ直します。 */
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(path.join(dir, e.name))
      : e.name.endsWith(".js")
        ? [path.join(dir, e.name)]
        : [],
  );
for (const jsPath of walk(out)) {
  const src = fs.readFileSync(jsPath, "utf8");
  fs.writeFileSync(
    jsPath,
    src.replace(/from "@\/([^"]+)"/g, (_, sub) => {
      const target = path.join(out, sub) + ".js";
      let rel = path
        .relative(path.dirname(jsPath), target)
        .split(path.sep)
        .join("/");
      if (!rel.startsWith(".")) rel = "./" + rel;
      return 'from "' + rel + '"';
    }),
  );
}
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const { jsonRequest, resolveAction } = await import(
  pathToFileURL(path.join(out, "lib", "action.js")).href
);
const { matchesAccept } = await import(
  pathToFileURL(path.join(out, "lib", "upload.js")).href
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

/* ===== P1-01. テーマ初期化スクリプトへの差し込み ================== */
/**
 * `makeThemeInitScript` は、値を **HTML に直接埋め込むスクリプト**へ渡します。
 * v0.9d では置き換え先が引用符の中にあり、`"` が 1 つ入るだけで
 * **データが実行コードになりました。**
 *
 * ここでは本物の関数を呼び、出てきたスクリプトを実際に走らせます。
 * 破れていれば `globalThis.__wt_pwned` が立ちます。
 */
{
  const { makeThemeInitScript } = await import(
    pathToFileURL(path.join(out, "components", "ui", "theme-provider.js")).href
  );

  const HOSTILE = [
    ['二重引用符', 'x");globalThis.__wt_pwned=1;//'],
    ["円記号", "x\\"],
    ['改行', 'a\nglobalThis.__wt_pwned=1;\n//'],
    ['スクリプトの閉じ', 'a</script><script>globalThis.__wt_pwned=1;</script>'],
    ['行区切り U+2028', 'a\u2028globalThis.__wt_pwned=1;\u2028//'],
    ['置換の指示 $&', "a$&b"],
  ];

  for (const [why, key] of HOSTILE) {
    const script = makeThemeInitScript({ storageKey: key });
    delete globalThis.__wt_pwned;

    /* 実際に走らせます。**文字列を目で見て判断しません。**
       localStorage などは引数で影を作って渡すので、
       突き抜けたときだけ本物の globalThis に触れます。 */
    let asked = null;
    const stubs = {
      localStorage: {
        getItem: (k) => {
          asked = k;
          return null;
        },
      },
      document: {
        documentElement: { dataset: {}, classList: { toggle() {} } },
      },
      matchMedia: () => ({ matches: false }),
    };
    try {
      new Function(
        "localStorage",
        "document",
        "matchMedia",
        script,
      )(stubs.localStorage, stubs.document, stubs.matchMedia);
    } catch (e) {
      /* 走らないこと自体は破れていない証拠にならないので、
         下の判定でまとめて見ます。 */
    }

    must(
      `${why}: スクリプトを破れない`,
      globalThis.__wt_pwned === undefined,
      globalThis.__wt_pwned !== undefined ? "突き抜けました" : "",
    );
    must(
      `  ${why}: 渡した値がそのまま届く`,
      asked === key,
      `渡した ${JSON.stringify(key)} / 届いた ${JSON.stringify(asked)}`,
    );
  }
  delete globalThis.__wt_pwned;

  /* `</script>` は HTML のパーサが先に読むので、
     **文字列としても出てはいけません。** */
  const withClose = makeThemeInitScript({
    storageKey: "a</script>b",
  });
  must(
    "生成物に </script> が出てこない",
    !/<\/script/i.test(withClose),
    withClose.slice(0, 80),
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
