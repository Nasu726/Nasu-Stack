/**
 * 「利用者のプロジェクトに入れたら本当にコンパイルが通るか」を検証します。
 *
 *   node scripts/verify-install.mjs
 *
 * shadcn CLI と同じ解決規則（registryDependencies を辿って target へ展開）を
 * 再現し、まっさらな TypeScript プロジェクトへ материализ… 展開したうえで
 * tsc を通します。CLI 本体を使わないのは、オフライン環境でも回せるようにするためです。
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rDir = path.join(root, "public", "r");
const work = path.join(root, ".verify-install");

/* --- 1. レジストリを読み込む ------------------------------------- */
const index = JSON.parse(
  await readFile(path.join(rDir, "index.json"), "utf8"),
);
const items = new Map();
for (const meta of index.items) {
  items.set(
    meta.name,
    JSON.parse(await readFile(path.join(rDir, `${meta.name}.json`), "utf8")),
  );
}

/* --- 2. 依存を辿って必要なアイテムを集める ------------------------ */
const wanted = process.argv.slice(2);
const roots = wanted.length ? wanted : [...items.keys()];
const resolved = new Set();
const npmDeps = new Set();

function collect(name) {
  if (resolved.has(name)) return;
  const item = items.get(name);
  if (!item) throw new Error(`未知のレジストリアイテム: ${name}`);
  resolved.add(name);
  for (const d of item.dependencies ?? []) npmDeps.add(d);
  for (const dep of item.registryDependencies ?? []) {
    // "@nasu/use-action" → "use-action"
    const local = dep.startsWith("@") ? dep.split("/").slice(1).join("/") : dep;
    if (items.has(local)) collect(local);
    else console.warn(`  ! 外部依存はスキップ: ${dep}`);
  }
}
roots.forEach(collect);

/* --- 3. まっさらなプロジェクトへ展開する -------------------------- */
await rm(work, { recursive: true, force: true });
await mkdir(path.join(work, "src"), { recursive: true });

let fileCount = 0;
for (const name of resolved) {
  for (const f of items.get(name).files) {
    if (!f.target) continue;
    const dest = path.join(work, "src", f.target);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, f.content, "utf8");
    fileCount++;
  }
}

await writeFile(
  path.join(work, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        // 利用者側の components.json が生成する、標準的な alias
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  `展開: ${resolved.size} アイテム / ${fileCount} ファイル → .verify-install/src`,
);
console.log(`npm 依存: ${[...npmDeps].join(", ") || "(なし)"}`);

/* --- 4. 型検査 ---------------------------------------------------- */
try {
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "-p",
      path.join(work, "tsconfig.json"),
    ],
    { stdio: "inherit", cwd: root },
  );
  console.log("✓ 利用者プロジェクトでの型検査に成功しました");
} catch {
  console.error("✗ 型検査に失敗しました（上の出力を参照）");
  process.exitCode = 1;
}
