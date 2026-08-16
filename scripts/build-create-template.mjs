/**
 * create-webtemplate のテンプレートを組み立てます。
 *
 *   node scripts/build-create-template.mjs
 *
 * ----------------------------------------------------------------
 * なぜ生成物にするのか
 * ----------------------------------------------------------------
 * テンプレートに部品をコピーして commit すると、
 * **同じファイルが registry/nasu と 2 か所に存在します。**
 *
 * このリポジトリは「同じ値が 2 か所にある」で何度も壊れました。
 * ヘッダの高さ、タブの一覧、下書きの除外、入力欄の class——
 * 全部そこが原因です。
 *
 * だからテンプレートは**必ずここで生成し、リポジトリには置きません**
 * （.gitignore 済み）。手で編集する余地が無ければ、ずれようがありません。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryRoot = path.join(root, "registry", "nasu");
const pkg = path.join(root, "packages", "create-webtemplate");
const out = path.join(pkg, "template");

const registry = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
);

/**
 * 最初から入れておく部品。
 *
 * **全部入れません。** 使わない部品が並んでいると、
 * 「これは何？」から始まってしまいます。依存は自動で辿ります。
 */
const STARTER = {
  common: [
    "tokens",
    "theme",
    "prose",
    "utils",
    "action",
    "layout",
    "site-nav",
    "site-footer",
    "frame",
    "check-responsive",
  ],
  astro: ["seo", "feed", "submit", "honeypot-field", "async-form", "form-fields"],
  vite: [
    "theme-provider",
    "action-provider",
    "action-button",
    "async-form",
    "form-fields",
    "async-boundary",
    "use-action",
    "use-resource",
    "toast",
    "dialog",
    "tabs",
    "disclosure",
    "submit",
    "honeypot-field",
  ],
};

const byName = new Map(registry.items.map((i) => [i.name, i]));

/** 依存を辿って、必要なアイテムを全部集めます。 */
function resolve(names, seen = new Set()) {
  for (const name of names) {
    if (seen.has(name)) continue;
    const item = byName.get(name);
    if (!item) throw new Error(`registry.json に ${name} がありません`);
    seen.add(name);
    resolve(
      (item.registryDependencies ?? []).map((d) => d.replace(/^@nasu\//, "")),
      seen,
    );
  }
  return seen;
}

function copyItems(names, destSrc) {
  const items = resolve(names);
  let count = 0;
  for (const name of items) {
    for (const file of byName.get(name).files ?? []) {
      const from = path.join(root, file.path);
      // target は "components/ui/x.tsx" のような相対パス。src/ の下へ置きます。
      const to = path.join(destSrc, file.target);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return { items: items.size, files: count };
}

/** 足場（設定ファイルなど）をそのまま写します。 */
function copyScaffold(kind, dest) {
  const from = path.join(pkg, "scaffold", kind);
  fs.cpSync(from, dest, { recursive: true });
}

fs.rmSync(out, { recursive: true, force: true });

const report = [];
for (const kind of ["astro", "vite"]) {
  const dest = path.join(out, kind);
  fs.mkdirSync(dest, { recursive: true });
  copyScaffold(kind, dest);
  const r = copyItems([...STARTER.common, ...STARTER[kind]], path.join(dest, "src"));
  report.push({ kind, ...r });
}

// 生成物であることを、開いた人にも分かるようにしておきます
fs.writeFileSync(
  path.join(out, "README.md"),
  [
    "# 生成物です",
    "",
    "このディレクトリは `scripts/build-create-template.mjs` が作ります。",
    "**手で編集しないでください。**原本は `registry/nasu` です。",
    "",
  ].join("\n"),
);

for (const r of report) {
  console.log(`  ${r.kind}: ${r.items} アイテム / ${r.files} ファイル`);
}
console.log(`✅ テンプレートを生成しました: ${path.relative(root, out)}`);
