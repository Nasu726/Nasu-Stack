/**
 * 生成物が宣言している依存が、本当に npm から取れるかを見ます。
 *
 *   node scripts/check-scaffold-deps.mjs
 *
 * ----------------------------------------------------------------
 * なぜこれが要るのか
 * ----------------------------------------------------------------
 * 外部レビューで「astro のバージョンが npm に存在しない」と
 * **公開停止（P0）の判定**を受けました。実際には存在していたので誤報でしたが、
 * **こちらはそれを機械で否定できませんでした。**
 *
 * 手元には node_modules があるので、宣言が間違っていても気づけません。
 * 気づくのは「まっさらな環境の利用者が `npm install` で止まったとき」で、
 * そのとき利用者は「Nasu Stack が壊れている」と判断して離脱します。
 *
 * だから registry へ実際に問い合わせます。**手元の状態を見ません。**
 *
 * 手元でネットワークが無い場合は、理由を印字して飛ばします。
 * CIでは公開前の証拠なので必須にし、未実施をgreenにしません。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./fetch-with-retry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scaffolds = ["astro", "vite"];

const checks = [];
const must = (label, ok, detail = "") => {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
};

/** 範囲（`^7.2.2`）から、実際に取れる版があるかを見ます。 */
async function resolvable(name, range) {
  const res = await fetchWithRetry(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    { headers: { accept: "application/vnd.npm.install-v1+json" } },
    {
      fetchImpl: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  );
  if (!res.ok) return { ok: false, why: `HTTP ${res.status}` };
  const meta = await res.json();
  const versions = Object.keys(meta.versions ?? {});
  if (versions.length === 0) return { ok: false, why: "版が 1 つもありません" };

  /* semver の完全な解決はしません（そのための依存を増やしたくないため）。
     **見たいのは「宣言した下限が実在するか」**です。ここを間違えると
     `npm install` がその場で止まります。 */
  const base = String(range).replace(/^[\^~>=<\s]*/, "").trim();
  if (!base) return { ok: true, why: "範囲指定なし" };
  if (versions.includes(base)) return { ok: true, why: base };
  return {
    ok: false,
    why: `${base} が registry にありません（最新: ${meta["dist-tags"]?.latest ?? "?"}）`,
  };
}

const online = await fetchWithRetry("https://registry.npmjs.org/-/ping", {}, {
  fetchImpl: (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
}).then(
  (r) => r.ok,
  () => false,
);
if (!online) {
  console.log("· registry.npmjs.org に届きません。依存の存在確認は飛ばします。");
  if (process.env.CI) {
    console.error("✗ CIでは依存の存在確認を必須にします");
    process.exit(1);
  }
  process.exit(0);
}

for (const kind of scaffolds) {
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(root, "packages", "create-nasu-stack", "scaffold", kind, "package.json"),
      "utf8",
    ),
  );
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const results = await Promise.all(
    Object.entries(all).map(async ([name, range]) => {
      try {
        return [name, range, await resolvable(name, range)];
      } catch (e) {
        return [name, range, { ok: false, why: String(e).slice(0, 60) }];
      }
    }),
  );
  const bad = results.filter(([, , r]) => !r.ok);
  must(
    `${kind}: 宣言した依存 ${results.length} 件が registry で解決できる`,
    bad.length === 0,
    bad.map(([n, r, x]) => `${n}@${r} → ${x.why}`).join(" / "),
  );
}

const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(
  failed.length === 0
    ? `✅ 判定 ${checks.length} 件すべて成功`
    : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
);
process.exit(failed.length === 0 ? 0 : 1);
