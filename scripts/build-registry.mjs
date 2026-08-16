/**
 * registry.json を読み、shadcn CLI が取得できる形の JSON を
 * public/r/<name>.json として書き出します。
 *
 *   node scripts/build-registry.mjs
 *
 * 生成物をどこかに静的ホスティングすれば、利用者は
 *   npx shadcn@latest add https://<host>/r/action-button.json
 * でインストールできます。
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "r");

const registry = JSON.parse(
  await readFile(path.join(root, "registry.json"), "utf8"),
);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let count = 0;
const index = [];

for (const item of registry.items) {
  const files = [];

  for (const file of item.files ?? []) {
    const abs = path.join(root, file.path);
    if (!existsSync(abs)) {
      console.error(`✗ ファイルが見つかりません: ${file.path}`);
      process.exitCode = 1;
      continue;
    }
    files.push({
      path: file.path,
      type: file.type,
      ...(file.target ? { target: file.target } : {}),
      content: await readFile(abs, "utf8"),
    });
  }

  const payload = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.author ? { author: item.author } : {}),
    ...(item.dependencies ? { dependencies: item.dependencies } : {}),
    ...(item.devDependencies
      ? { devDependencies: item.devDependencies }
      : {}),
    ...(item.registryDependencies
      ? { registryDependencies: item.registryDependencies }
      : {}),
    ...(item.cssVars ? { cssVars: item.cssVars } : {}),
    ...(item.css ? { css: item.css } : {}),
    ...(item.categories ? { categories: item.categories } : {}),
    files,
  };

  await writeFile(
    path.join(outDir, `${item.name}.json`),
    JSON.stringify(payload, null, 2) + "\n",
    "utf8",
  );
  index.push({
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
  });
  count++;
}

await writeFile(
  path.join(outDir, "index.json"),
  JSON.stringify({ name: registry.name, items: index }, null, 2) + "\n",
  "utf8",
);

console.log(`✓ ${count} 件を public/r/ に出力しました`);
