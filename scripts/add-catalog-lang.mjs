/**
 * 訳を `lang.en.ts` へ足します。**書きかけを何度も足せるようにするだけの道具です。**
 *
 *   node scripts/add-catalog-lang.mjs <訳を書いた JSON>
 *
 * 手で 400 件を 1 つのファイルに書くと、途中で構文を壊したときに
 * **どこで壊れたか分からなくなります。** JSON で受け取って、
 * 既にある分と混ぜてから書き出します。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "apps/playground/src/lang.en.ts");
const input = process.argv[2];
if (!input) {
  console.error("使い方: node scripts/add-catalog-lang.mjs <訳を書いた JSON>");
  process.exit(2);
}

/** いま入っている訳。**構文木で読みます**（import せずに済みます）。 */
const sf = ts.createSourceFile(
  target,
  fs.readFileSync(target, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const current = new Map();
(function walk(n) {
  if (
    ts.isPropertyAssignment(n) &&
    ts.isStringLiteral(n.name) &&
    ts.isStringLiteral(n.initializer)
  ) {
    current.set(n.name.text, n.initializer.text);
  }
  ts.forEachChild(n, walk);
})(sf);

const before = current.size;
/* ソースが実際に `t()` へ渡している原文。**鍵はこれと 1 文字も違ってはいけません。**
   複数行の原文は CRLF で入っているので、LF で書いた鍵は当たりません
   （実際、63 件のうち 40 件が黙って外れました）。ここで丸めます。 */
const srcDir = path.join(root, "apps/playground/src");
const real = new Map();
for (const f of fs.readdirSync(srcDir)) {
  if (!/\.tsx?$/.test(f) || /^lang/.test(f)) continue;
  const p = path.join(srcDir, f);
  const s = ts.createSourceFile(
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
      const text = n.arguments[0].text;
      real.set(text.replace(/\r\n/g, "\n"), text);
    }
    ts.forEachChild(n, walk);
  })(s);
}

const added = JSON.parse(fs.readFileSync(input, "utf8"));
let remapped = 0;
for (const [k, v] of Object.entries(added)) {
  const key = real.get(k.replace(/\r\n/g, "\n")) ?? k;
  if (key !== k) remapped++;
  current.set(key, v);
}
if (remapped) console.log(`改行を合わせた鍵: ${remapped} 件`);

const header = fs.readFileSync(target, "utf8").split("export const EN")[0];
const body = [...current.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

fs.writeFileSync(
  target,
  `${header}export const EN: Record<string, string> = {\n${body}\n};\n`.replace(
    /\r?\n/g,
    "\r\n",
  ),
  "utf8",
);

console.log(`訳: ${before} → ${current.size} 件（足した ${current.size - before} 件）`);
