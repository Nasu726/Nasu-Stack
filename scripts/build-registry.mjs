/**
 * registry.json を読み、shadcn CLI が取得できる形の JSON を
 * public/r/<name>.json として書き出します。
 *
 *   node scripts/build-registry.mjs
 *
 * 生成物をどこかに静的ホスティングすれば、利用者は
 *   npx shadcn@<検証済みの版> add @nasu/action-button
 * でインストールできます。
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNamespace } from "./_deps.mjs";

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
    /* **公開用だけ `@nasu/…` へ直します。** 理由は scripts/_deps.mjs に。 */
    ...(item.registryDependencies
      ? { registryDependencies: item.registryDependencies.map(toNamespace) }
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
    /* 一覧には**中身を入れません。** content まで入れると 1 ファイルが
       数百 KB になり、しかも個別 JSON と同じものが 2 か所に出ます。
       shadcn のディレクトリの要件でもあります（files は要る、content は入れない）。 */
    files: (item.files ?? []).map((f) => ({
      path: f.path,
      type: f.type,
      ...(f.target ? { target: f.target } : {}),
    })),
  });
  count++;
}

/**
 * 一覧。**2 つの名前で出します。**
 *
 *   registry.json … shadcn のディレクトリに載せるための名前。
 *                   $schema / name / homepage / items[].files が要ります
 *   index.json    … これまで配ってきた名前。**消しません。**
 *                   既に読んでいる人がいるかもしれないためです
 *
 * 中身は同じものです（下で 1 回だけ組み立てます）。
 */
const listing = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: registry.name,
  homepage: registry.homepage,
  items: index,
};

for (const file of ["registry.json", "index.json"]) {
  await writeFile(
    path.join(outDir, file),
    JSON.stringify(listing, null, 2) + String.fromCharCode(10),
    "utf8",
  );
}

console.log(`✓ ${count} 件を public/r/ に出力しました`);
