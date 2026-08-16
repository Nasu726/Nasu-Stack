/**
 * 公開されたものを、**外から実際に叩いて**確かめます。
 *
 *   node scripts/verify-published.mjs https://nasu726.github.io/WebTemplate
 *   node scripts/verify-published.mjs http://127.0.0.1:5055        （手元で）
 *
 * ----------------------------------------------------------------
 * なぜワークフローに直接書かないのか
 * ----------------------------------------------------------------
 * YAML に `run: |` で並べると、**手元で同じものを試せません。**
 * 「CI でだけ落ちる」ものを、push を繰り返して直すことになります。
 * ここに置けば、`serve-registry.mjs` で配って同じ判定を回せます。
 *
 * ----------------------------------------------------------------
 * なぜ手元の検査だけでは足りないのか
 * ----------------------------------------------------------------
 * 手元で配って通っても、公開ホストでは違うことがあります。
 *
 *   - content-type が違う（JSON を text/plain で返す等）
 *   - 末尾スラッシュでリダイレクトされる
 *   - **存在しない URL に 404 を返さない**（200 で index を返すところがあります）
 *
 * どれも「置いたから大丈夫」では分かりません。出してから測ります。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("使い方: node scripts/verify-published.mjs <公開先の URL>");
  process.exit(2);
}

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}
const log = (...a) => console.log("·", ...a);

console.log(`\n公開先: ${base}\n`);

/* --- 1. レジストリの一覧 ------------------------------------------- */
/** 期待する件数は registry.json から取ります。**書き写しません。** */
const expected = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
).items;

let index = null;
try {
  const res = await fetch(`${base}/r/index.json`);
  must("r/index.json が 200 で取れる", res.ok, `HTTP ${res.status}`);
  must(
    "content-type が JSON",
    /application\/json/.test(res.headers.get("content-type") ?? ""),
    res.headers.get("content-type") ?? "(無し)",
  );
  index = await res.json();
} catch (e) {
  must("r/index.json が JSON として読める", false, String(e).slice(0, 120));
}

must(
  `一覧の件数が registry.json と一致する`,
  index?.items?.length === expected.length,
  `公開 ${index?.items?.length ?? "?"} / 手元 ${expected.length}`,
);

/* --- 2. 全部の項目が取れるか --------------------------------------- */
/* 1 つだけ見ても足りません。**足したものが漏れるのはいつも「一覧の外」**です。
   一覧に載っている全部を実際に取りに行きます。 */
const broken = [];
for (const item of index?.items ?? []) {
  try {
    const res = await fetch(`${base}/r/${item.name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.files) || body.files.length === 0) {
      throw new Error("files が空");
    }
    // 中身が本当に入っているか。空文字でも JSON としては正しいので、そこを見ます。
    if (body.files.some((f) => !f.content)) throw new Error("content が空のファイルがある");
  } catch (e) {
    broken.push(`${item.name}: ${String(e).slice(0, 60)}`);
  }
}
must(
  `全 ${index?.items?.length ?? 0} 項目が取れて、中身が入っている`,
  broken.length === 0,
  broken.slice(0, 3).join(" / "),
);

/* --- 3. 入口の tarball ---------------------------------------------- */
/* 並べて置いたハッシュと、実際に落ちてくるものが一致するか。
   **経路の途中で差し替えられていないこと**を、利用者と同じ手順で確かめます。 */
try {
  const [tgz, sha] = await Promise.all([
    fetch(`${base}/create-webtemplate.tgz`),
    fetch(`${base}/create-webtemplate.tgz.sha256`),
  ]);
  must("create-webtemplate.tgz が 200 で取れる", tgz.ok, `HTTP ${tgz.status}`);
  must("sha256 が 200 で取れる", sha.ok, `HTTP ${sha.status}`);

  const bytes = Buffer.from(await tgz.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  const published = (await sha.text()).trim().split(/\s+/)[0];
  must("tarball のハッシュが公開されている値と一致する", actual === published,
    actual === published ? `${actual.slice(0, 16)}…` : `実物 ${actual.slice(0, 16)}… / 公開 ${published.slice(0, 16)}…`);

  // gzip なので 1f 8b で始まります。HTML のエラーページを掴んでいないかの確認。
  must("tarball が本当に gzip", bytes[0] === 0x1f && bytes[1] === 0x8b,
    `先頭 ${bytes.subarray(0, 2).toString("hex")}`);
} catch (e) {
  must("入口の tarball を確かめられた", false, String(e).slice(0, 120));
}

/* --- 4. 存在しない URL のステータス --------------------------------- */
/* handoff の「未検証」3 つ目。**404.html を置いても 404 を返さない**
   ホスティングがあります。そうなると検索エンジンが存在しないページを登録します。
   判定にはせず、**測った値を必ず印字**します（黙って通すと、
   「404 になっているつもり」で終わります）。 */
try {
  const res = await fetch(`${base}/r/does-not-exist.json`, { redirect: "manual" });
  log(`存在しない URL のステータス: ${res.status}`);
  must("存在しない URL に 404 が返る", res.status === 404, `HTTP ${res.status}`);
} catch (e) {
  must("存在しない URL を測れた", false, String(e).slice(0, 120));
}

/* --- まとめ --------------------------------------------------------- */
const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(
  failed.length === 0
    ? `✅ 判定 ${checks.length} 件すべて成功`
    : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
);
for (const f of failed) console.log(`   ✗ ${f.label}  ${f.detail}`);
process.exit(failed.length === 0 ? 0 : 1);
