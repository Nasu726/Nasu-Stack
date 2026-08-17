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

/* ------------------------------------------------------------------
 * tokens.css が配っている class の名前
 * ------------------------------------------------------------------
 * import 文からは絶対に辿れない依存です。`className="wt-tap gap-sm"` と
 * 書いても、TypeScript から見ればただの文字列だからです。
 *
 * **黙って壊れる形が最悪でした。** `@nasu/tokens` を入れていない利用者の
 * プロジェクトでは、この class が単に何も定義されていない文字列になります。
 * エラーも警告も出ません。余白が詰まるだけなら気づけますが、
 * `wt-tap`（押せるものの最低寸法）が消えても**見た目はほとんど変わりません。**
 * 気づくのは指で押せないと言われたときです。
 *
 * v0.9a の時点で 7 項目が宣言漏れでした。人の目では見つかりません。
 * ---------------------------------------------------------------- */
const tokensCss = fs.readFileSync(
  path.join(root, "registry/nasu/lib/tokens.css"),
  "utf8",
);
/** `@utility wt-tap` のような、名前が固定のもの */
const bareUtilities = [...tokensCss.matchAll(/@utility\s+([a-z0-9-]+)\s*\{/g)].map(
  (m) => m[1],
);
/** `.wt-gap` のように直接書かれている class */
const wtClasses = [...tokensCss.matchAll(/\.(wt-[a-z0-9-]+)/g)].map((m) => m[1]);
/** `@utility gap-*` は段階の名前と組み合わせて初めて class になります */
const spaceSteps = [...tokensCss.matchAll(/--space-([a-z0-9]+):/g)].map((m) => m[1]);
const scaledUtilities = [...tokensCss.matchAll(/@utility\s+([a-z0-9-]+)-\*\s*\{/g)]
  .flatMap((m) => spaceSteps.map((s) => `${m[1]}-${s}`));

const TOKEN_CLASSES = [
  ...new Set([...bareUtilities, ...wtClasses, ...scaledUtilities]),
];
/** class 名は単語として一致させます（`gap-sm` が `gap-small` に当たらないように） */
const TOKEN_RE = TOKEN_CLASSES.map((c) => [c, new RegExp(`(?<![\\w-])${c}(?![\\w-])`)]);

const problems = [];

for (const item of registry.items) {
  const declared = new Set(item.registryDependencies ?? []);
  const used = new Set();
  const tokenHits = new Set();

  for (const f of item.files ?? []) {
    const src = fs.readFileSync(path.join(root, f.path), "utf8");

    if (/\.(ts|tsx|css)$/.test(f.path) && item.name !== "tokens") {
      for (const [name, re] of TOKEN_RE) if (re.test(src)) tokenHits.add(name);
    }

    if (!/\.(ts|tsx)$/.test(f.path)) continue;
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

  if (tokenHits.size && !declared.has("@nasu/tokens")) {
    problems.push(
      `${item.name}: tokens.css の class（${[...tokenHits].sort().join(", ")}）を` +
        `使っているのに @nasu/tokens が registryDependencies にありません`,
    );
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
