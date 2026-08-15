/**
 * registry.json の依存漏れを検出します。
 *
 *   node scripts/check-registry-deps.mjs
 *
 * ----------------------------------------------------------------
 * なぜ要るのか
 * ----------------------------------------------------------------
 * `registryDependencies` は「この部品を入れるとき一緒に入るもの」の宣言です。
 * ここに書き忘れても、開発中のこのリポジトリでは全ファイルが揃っているので
 * 何も起きません。壊れるのは**利用者が 1 つだけ入れたとき**です。
 *
 *   npx shadcn add @nasu/data-table
 *   → data-table.tsx は入る
 *   → その中の `import { cn } from "@/lib/utils"` は入らない
 *   → 利用者の手元だけでビルドが落ちる
 *
 * verify-install.mjs は全部まとめて入れて型検査するので、これを見つけられません。
 * そこで「ソースが実際に import しているもの」と「宣言」を突き合わせます。
 *
 * CSS（@nasu/tokens など）は import 文から辿れないので、宣言側にだけ
 * あっても余分とは見なしません。足りない側だけを失敗にします。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
);

/** ファイルのパス → それを配っている項目名 */
const owner = new Map();
for (const item of registry.items) {
  for (const f of item.files ?? []) owner.set(f.path, item.name);
}

/** `@/lib/utils` のような別名を、配っている項目名へ解決する */
function resolve(alias) {
  for (const ext of [".ts", ".tsx", ".css"]) {
    const p = `registry/nasu/${alias}${ext}`;
    if (owner.has(p)) return owner.get(p);
  }
  return null;
}

const problems = [];

for (const item of registry.items) {
  const declared = new Set(item.registryDependencies ?? []);
  const used = new Set();

  for (const f of item.files ?? []) {
    if (!/\.(ts|tsx)$/.test(f.path)) continue;
    const src = fs.readFileSync(path.join(root, f.path), "utf8");
    for (const m of src.matchAll(/from\s+"@\/([^"]+)"/g)) {
      const name = resolve(m[1]);
      if (!name) {
        problems.push(
          `${item.name}: import "@/${m[1]}" は registry.json のどの項目にも属していません`,
        );
        continue;
      }
      if (name !== item.name) used.add(`@nasu/${name}`);
    }
  }

  for (const need of used) {
    if (!declared.has(need)) {
      problems.push(
        `${item.name}: ${need} を import しているのに registryDependencies にありません`,
      );
    }
  }
}

if (problems.length === 0) {
  console.log(
    `✅ registryDependencies の漏れはありません (${registry.items.length} 項目)`,
  );
  process.exit(0);
}

console.error(`❌ 依存の宣言漏れ ${problems.length} 件\n`);
for (const p of problems) console.error("  ・" + p);
console.error(
  "\n利用者が 1 つだけ入れたときに壊れます。registry.json に足してください。",
);
process.exit(1);
