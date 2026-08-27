/**
 * カタログの訳し漏れを数えます。
 *
 *   node scripts/check-catalog-lang.mjs
 *
 * ----------------------------------------------------------------
 * なぜ判定にするのか
 * ----------------------------------------------------------------
 * 訳が無い文字列は**日本語のまま出ます**（`lang.ts` の設計）。壊れて
 * 見えないのが利点ですが、そのぶん**日本語話者は永久に気づきません。**
 * 英語で開いている人にだけ、日本語が混ざって見えます。
 *
 * だから機械で数えます。
 *
 * ----------------------------------------------------------------
 * 何を見るか
 * ----------------------------------------------------------------
 *   1. `t("…")` に渡している原文が、全部 lang.en.ts にあるか
 *   2. lang.en.ts に、もう使われていない訳が残っていないか
 *   3. 訳したはずのものに日本語が残っていないか（貼り間違い）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "apps/playground/src");
const JP = /[぀-ゟ゠-ヿ一-龯]/;

/** src直下だけに限定すると、責務ごとのmodule分割が翻訳検査を無効にします。 */
function sourceFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /^lang/.test(entry.name)) {
        return [];
      }
      return [target];
    })
    .sort();
}

/** ソースが実際に `t()` へ渡している原文。**一覧を書き写しません。** */
const used = new Set();
for (const p of sourceFiles(srcDir)) {
  const sf = ts.createSourceFile(
    p,
    fs.readFileSync(p, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  (function walk(n) {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "t" &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      used.add(n.arguments[0].text);
    }
    ts.forEachChild(n, walk);
  })(sf);
}

/* タブの見出しは tabs.mjs にあり、catalog shellが `t(tab.label)` で通します。
   **変数越しなので上の走査には出てきません。** ここで足します。 */
const tabs = fs.readFileSync(path.join(srcDir, "tabs.mjs"), "utf8");
for (const m of tabs.matchAll(/label: "([^"]+)"/g)) used.add(m[1]);

/** 訳。`lang.en.ts` を構文木で読みます（import せずに済みます）。 */
const enPath = path.join(srcDir, "lang.en.ts");
const enSf = ts.createSourceFile(
  enPath,
  fs.readFileSync(enPath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const translated = new Map();
(function walk(n) {
  if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name) && ts.isStringLiteral(n.initializer)) {
    translated.set(n.name.text, n.initializer.text);
  }
  ts.forEachChild(n, walk);
})(enSf);

const missing = [...used].filter((s) => !translated.has(s));
const stale = [...translated.keys()].filter((s) => !used.has(s));
const notEnglish = [...translated].filter(([, v]) => JP.test(v)).map(([k]) => k);

const pct = Math.round(((used.size - missing.length) / used.size) * 100);
console.log(`  訳: ${used.size - missing.length} / ${used.size} 件 (${pct}%)`);

const problems = [];
for (const s of missing) problems.push(`訳が無い: ${s.replace(/\s+/g, " ").slice(0, 70)}`);
for (const s of stale) problems.push(`使われていない訳: ${s.replace(/\s+/g, " ").slice(0, 70)}`);
for (const s of notEnglish) problems.push(`訳に日本語が残っている: ${s.replace(/\s+/g, " ").slice(0, 70)}`);

if (problems.length === 0) {
  console.log(`✅ カタログの訳し漏れはありません (${used.size} 件)`);
  process.exit(0);
}

console.error(`\n❌ カタログの訳 ${problems.length} 件\n`);
for (const p of problems.slice(0, 40)) console.error("  ・" + p);
if (problems.length > 40) console.error(`  … ほか ${problems.length - 40} 件`);
console.error(
  "\n**訳が無いと、英語で開いた人にだけ日本語が出ます。**" +
    "\n日本語で見ている限り気づけないので、ここで止めます。",
);
process.exit(1);
