#!/usr/bin/env node
/**
 * create-webtemplate — 動くところから始める
 * ================================================================
 *
 *   npx create-webtemplate my-site
 *   npx create-webtemplate my-site --template astro --yes
 *
 * 部品をいくら揃えても、**始められなければ届きません。**
 * ここが「誰でも簡単に作れる」への最後の一段です。
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(here, "template");

const KINDS = [
  {
    key: "astro",
    label: "サイト（Astro）",
    hint: "静的なページ中心。ブログや会社サイト。JavaScript は必要な部分だけ",
  },
  {
    key: "vite",
    label: "アプリ（Vite + React）",
    hint: "画面の中で動く部分が多いもの。管理画面やツール",
  },
];

/* ================================================================
 * プロジェクト名の検証
 * ================================================================
 * package.json の `name` として使うので、通らない字があります。
 * **生成してから npm に怒られるより、ここで止めたほうが親切です。**
 * ============================================================== */

export function validateName(name) {
  if (!name || !name.trim()) return "プロジェクト名を入れてください";
  if (name !== name.trim()) return "前後の空白は使えません";
  if (/[A-Z]/.test(name)) return "大文字は使えません（小文字にしてください）";
  if (/\s/.test(name)) return "空白は使えません（- でつないでください）";
  if (name.startsWith(".") || name.startsWith("_")) {
    return ". や _ で始まる名前は使えません";
  }
  if (/[~'!()*/\\]/.test(name)) return "記号 ~ ' ! ( ) * / \\ は使えません";
  if (name.length > 214) return "名前が長すぎます";
  return null;
}

/**
 * 生成先が使えるか調べます。
 *
 * **既存のディレクトリを上書きしてはいけません。** create 系の道具で
 * 一番やってはいけない事故です。空なら使います。
 */
export function checkTarget(dir) {
  if (!fs.existsSync(dir)) return null;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return `${dir} は既にファイルとして存在します`;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return null;
  return `${dir} は空ではありません（${entries.length} 件）。別の名前にするか、中身を移してください`;
}

/** テンプレートを写して、名前だけ差し替えます。 */
export function scaffold(kind, dest, projectName) {
  const src = path.join(TEMPLATES, kind);
  if (!fs.existsSync(src)) {
    throw new Error(
      `テンプレートが見つかりません: ${src}\n` +
        "開発中なら `node scripts/build-create-template.mjs` を先に実行してください",
    );
  }
  fs.cpSync(src, dest, { recursive: true });

  // 名前を埋める対象。バイナリを壊さないよう、拡張子で絞ります。
  const REPLACE_IN = /\.(json|ts|tsx|astro|css|html|md|mjs)$/;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (REPLACE_IN.test(entry.name)) {
        const before = fs.readFileSync(p, "utf8");
        if (before.includes("__PROJECT_NAME__")) {
          fs.writeFileSync(p, before.replaceAll("__PROJECT_NAME__", projectName));
        }
      }
    }
  };
  walk(dest);

  // .gitignore はテンプレートに置けません（npm publish で消えるため）。
  // ここで書き出します。
  fs.writeFileSync(
    path.join(dest, ".gitignore"),
    ["node_modules/", "dist/", ".astro/", ".DS_Store", "*.local", ""].join("\n"),
  );

  fs.writeFileSync(path.join(dest, "README.md"), readme(kind, projectName));
  return true;
}

/**
 * 部品を足すときに使うレジストリの URL。
 *
 * **書き写しません。** 一緒に配る components.json から読みます。
 * 2 か所に書くと、公開先を変えた日に README だけ古い URL を指します。
 * 壊れるのはこちらの手元ではなく、利用者が打った瞬間なので気づけません。
 */
function registryUrl(kind) {
  try {
    const p = path.join(TEMPLATES, kind, "components.json");
    return JSON.parse(fs.readFileSync(p, "utf8")).registries?.["@nasu"] ?? "";
  } catch {
    return "";
  }
}

function readme(kind, name) {
  const dev = kind === "astro" ? "http://localhost:4321" : "http://localhost:5173";
  return `# ${name}

WebTemplate から作りました。

## 動かす

\`\`\`bash
npm install
npm run dev      # ${dev}
\`\`\`

## 次にやること

1. ${kind === "astro" ? "`src/site.config.ts` と `astro.config.mjs` の `site`" : "`index.html` の title"} を書き換える
2. ${kind === "astro" ? "`src/pages/index.astro`" : "`src/App.tsx`"} を書き換える
3. 部品が足りなくなったら足す（下を見てください）

## 覚えることは 2 つだけ

**余白は段階から選びます。** 迷わないためです。段階の外の値も書けます。

\`\`\`tsx
<Stack space="lg">…</Stack>
<Stack space="13px">…</Stack>   {/* 必要ならこれも通ります */}
\`\`\`

**非同期は関数を 1 つ渡すだけです。** 送信中・成功・失敗・二重送信の防止は
部品が持っています。

\`\`\`tsx
import { ActionButton } from "@/components/ui/action-button";

<ActionButton action={async () => api.save(値)}>保存する</ActionButton>
\`\`\`

押している間のスピナー、連打の防止、失敗時の表示と押し直し、
成功時のチェックマーク——全部この 1 行に入っています。

## 部品を足す

最初から入っているのは、よく使うものだけです。表・タブ・通知などは
必要になったときに足します。**設定は済んでいるので、コマンド 1 つです。**

\`\`\`bash
npx shadcn@latest add @nasu/data-table
\`\`\`

依存する部品も一緒に入ります。入る先は \`src/components/ui/\` です。
**入った後のコードはあなたのものです。** 好きに書き換えてください
（そのために npm パッケージではなくコピーで配っています）。

> **「すでにあります。上書きしますか？」と聞かれます。**
> \`action.ts\` のように最初から入っているファイルが、新しい部品の依存にも
> なっているためです。**そのまま Enter（N）で構いません。**
> あなたが書き換えたコードを守るための確認です。

足せるものの一覧は ${registryUrl(kind).replace("/r/{name}.json", "/")} にあります。

> \`@nasu\` がどこを指すかは \`components.json\` の \`registries\` に書いてあります。
> 公開先を自分のものに変えたいときは、そこだけ書き換えてください。

## 崩れていないか確かめる

\`\`\`bash
npm run build && npm run preview
npx playwright install chromium
node src/scripts/check-responsive.mjs ${dev.replace(/\\d+$/, kind === "astro" ? "4321" : "4173")}/
\`\`\`

スマホ幅での崩れ・タップ領域・画像の場所取りを、目視ではなく数値で見ます。
`;
}

/* ================================================================
 * CLI
 * ============================================================== */

function parseArgs(argv) {
  const args = { name: undefined, template: undefined, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--template" || a === "-t") args.template = argv[++i];
    else if (a.startsWith("--template=")) args.template = a.split("=")[1];
    else if (!a.startsWith("-")) args.name ??= a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("");
  console.log("  WebTemplate — 動くところから始めます");
  console.log("");

  // 対話できない環境（CI など）でも動く必要があります
  const interactive = process.stdin.isTTY && !args.yes;
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

  let name = args.name;
  if (!name && rl) name = (await rl.question("  プロジェクト名: ")).trim();
  if (!name) {
    console.error("  ✗ プロジェクト名を指定してください");
    console.error("    例: npx create-webtemplate my-site");
    rl?.close();
    process.exit(2);
  }

  const nameError = validateName(name);
  if (nameError) {
    console.error(`  ✗ ${nameError}`);
    rl?.close();
    process.exit(2);
  }

  let kind = args.template;
  if (!kind && rl) {
    console.log("");
    KINDS.forEach((k, i) => {
      console.log(`    ${i + 1}. ${k.label}`);
      console.log(`       ${k.hint}`);
    });
    console.log("");
    const answer = (await rl.question("  どちらにしますか？ [1] ")).trim();
    kind = KINDS[Number(answer || "1") - 1]?.key;
  }
  kind ??= "astro";

  if (!KINDS.some((k) => k.key === kind)) {
    console.error(`  ✗ 知らないテンプレートです: ${kind}`);
    console.error(`    使えるのは: ${KINDS.map((k) => k.key).join(" / ")}`);
    rl?.close();
    process.exit(2);
  }

  const dest = path.resolve(process.cwd(), name);
  const targetError = checkTarget(dest);
  if (targetError) {
    console.error(`  ✗ ${targetError}`);
    rl?.close();
    process.exit(2);
  }

  scaffold(kind, dest, name);
  rl?.close();

  const dev = kind === "astro" ? "4321" : "5173";
  console.log("");
  console.log(`  ✅ ${name} を作りました（${KINDS.find((k) => k.key === kind).label}）`);
  console.log("");
  console.log(`     cd ${name}`);
  console.log("     npm install");
  console.log(`     npm run dev        → http://localhost:${dev}`);
  console.log("");
}

// 直接実行されたときだけ CLI として動きます（検査からは関数を呼びます）
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
