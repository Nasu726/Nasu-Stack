/**
 * 書いてはいけない文字列を探します。
 *
 *   node scripts/check-forbidden.mjs
 *
 * ----------------------------------------------------------------
 * なぜ機械で見張るのか
 * ----------------------------------------------------------------
 * `npx create-webtemplate` は npm で**空いている名前**です。
 * 第三者が取れば、その名前を打った人には他人のコードが動きます。
 *
 * README を直しても、**コードの中に残っていれば同じこと**です。
 * とくに CLI のエラーメッセージは危険で、詰まっている人ほど
 * そこに書いてあるコマンドをそのまま打ちます。
 *
 * v0.9a では README だけ直して、`index.mjs` の冒頭コメントと
 * エラー例に残っていました。**人の目では見つかりません。**
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGET_DIRS = ["scripts", "registry", "apps", "packages", "examples", ".github"];
const TARGET_EXT = new Set([
  ".mjs", ".js", ".ts", ".tsx", ".astro", ".css", ".html", ".json", ".yml", ".yaml", ".md",
]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", "template", ".shots"]);

const RULES = [
  {
    re: /npx\s+create-webtemplate/g,
    why:
      "npm で空いている名前です。第三者が取ると、打った人に他人のコードが動きます。\n" +
      "      tarball の URL を指す形だけを書いてください",
  },
  {
    re: /npx\s+shadcn@latest/g,
    why:
      "@latest は、その時点で publish されているものを無条件に実行します。\n" +
      "      lockfile も minimumReleaseAge も素通りします。版を固定してください",
  },
];

/**
 * 説明のために引用している場所。
 *
 * **「使うな」と書くには、その文字列を書く必要があります。**
 * 全部を禁止すると説明できなくなるので、文書だけ除外します。
 * コード（実行される場所）には一切残しません。
 */
const ALLOW = [
  /^docs[\\/]/,
  /^README\.md$/,
  /^ROADMAP\.md$/,
  // この検査自身。**禁止する文字列を書かないと、何を探すのか説明できません。**
  /^scripts[\\/]check-forbidden\.mjs$/,
];

const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (!TARGET_EXT.has(path.extname(entry.name))) continue;

    const rel = path.relative(ROOT, p);
    if (ALLOW.some((a) => a.test(rel))) continue;

    const src = fs.readFileSync(p, "utf8");
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split("\n").length;
        problems.push({ rel, line, hit: m[0], why: rule.why });
      }
    }
  }
}

for (const d of TARGET_DIRS) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) walk(abs);
}
// リポジトリ直下も見ます（ALLOW で README / ROADMAP は外れます）
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && TARGET_EXT.has(path.extname(entry.name))) {
    const rel = entry.name;
    if (ALLOW.some((a) => a.test(rel))) continue;
    const src = fs.readFileSync(path.join(ROOT, entry.name), "utf8");
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(src)) !== null) {
        problems.push({
          rel,
          line: src.slice(0, m.index).split("\n").length,
          hit: m[0],
          why: rule.why,
        });
      }
    }
  }
}

if (problems.length === 0) {
  console.log("✅ 書いてはいけない文字列はありません");
  process.exit(0);
}

console.error(`❌ 危険なコマンドが ${problems.length} 件残っています\n`);
for (const p of problems) {
  console.error(`  ・${p.rel}:${p.line}  "${p.hit}"`);
  console.error(`      ${p.why}`);
}
console.error(
  "\n説明として引用したい場合は docs/ に書いてください（そこだけ除外しています）。",
);
process.exit(1);
