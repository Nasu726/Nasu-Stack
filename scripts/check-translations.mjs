/**
 * 英語版と日本語版がずれていないか。
 *
 *   node scripts/check-translations.mjs
 *
 * ----------------------------------------------------------------
 * なぜ要るのか
 * ----------------------------------------------------------------
 * 同じことを 2 つの言語で書いた時点で、**同じ値が 2 か所にあります。**
 * このリポジトリが繰り返し踏んだ失敗そのものです。
 *
 * しかも今回は**日本語側だけ直る**方向にずれます。書いている人が
 * 日本語話者だからです。そして**英語版は外から来た人が最初に読む面**なので、
 * 古いコマンドが載っていると、その人は入口で詰まります。
 *
 * 文章の意味までは機械で見られません。見るのは
 * **打てば動くもの**（コマンドと URL）と、**片方しか無い状態**だけです。
 * ここが一致していれば、翻訳が古くても「動かない」にはなりません。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 対にする文書。**ここが一覧の唯一の定義です。** */
const PAIRS = [
  ["README.md", "README.ja.md"],
  ["SECURITY.md", "SECURITY.ja.md"],
  ["docs/boundaries.md", "docs/boundaries.ja.md"],
  ["docs/overview.md", "docs/overview.ja.md"],
  ["docs/security.md", "docs/security.ja.md"],
  ["docs/astro-and-react.md", "docs/astro-and-react.ja.md"],
  ["docs/validation.md", "docs/validation.ja.md"],
  ["docs/field-array.md", "docs/field-array.ja.md"],
  ["docs/error-boundary.md", "docs/error-boundary.ja.md"],
  ["docs/autosave.md", "docs/autosave.ja.md"],
  ["docs/popover.md", "docs/popover.ja.md"],
];

const problems = [];
/**
 * **改行を先に揃えます。** このリポジトリの文書は CRLF です。
 * 揃えずに ```bash\n を探すと 1 件も当たらず、
 * **コマンドを 1 つも比べないまま緑になります**（実際そうなっていました）。
 */
const read = (p) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

/**
 * 打てば動くもの。**説明文ではなくこれだけを比べます。**
 *
 * - ```bash ブロックの中身（そのまま貼られる行）
 * - 本文中の https:// の URL
 */
function runnables(text) {
  /* 片方にしか無くてよい範囲。**外すなら、外したと書いてある場所だけ。**
     暗黙に無視すると、本当のずれも一緒に消えます。 */
  const SKIP = new RegExp(
    "<!-- translate:skip -->[^]*?<!-- /translate:skip -->",
    "g",
  );
  text = text.replace(SKIP, "");
  const cmds = [];
  for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const line of m[1].split("\n")) {
      // 行末のコメントも訳し分けてよい。**打つのはその手前まで**です。
      const s = line.replace(/\s+#.*$/, "").trim();
      if (s && !s.startsWith("#")) cmds.push(s);
    }
  }
  const urls = [...text.matchAll(/https:\/\/[^\s)"'`<>]+/g)]
    .map((m) => m[0].replace(/[.,]$/, ""))
    // 相手先の文書は言語で変わってよい（例: ja のページを指す）
    .filter((u) => !/(docs\.github\.com|ui\.shadcn\.com|developer\.mozilla)/.test(u));
  return { cmds, urls: [...new Set(urls)] };
}

/** 言語版への導線だけを、同じ行き先として比較します。 */
function comparableUrl(url) {
  return url
    .replace("/Nasu-Stack/catalog/?lang=ja", "/Nasu-Stack/catalog/")
    .replace("/Nasu-Stack/demo/ja/", "/Nasu-Stack/demo/");
}

for (const [en, ja] of PAIRS) {
  for (const f of [en, ja]) {
    if (!fs.existsSync(path.join(root, f))) {
      problems.push(`${f} がありません（対になる文書が片方だけです）`);
    }
  }
  if (problems.length) continue;

  const [a, b] = [read(en), read(ja)];

  /* 互いへのリンク。**辿れないと、片方の言語しか無いように見えます。** */
  const link = (from, to) => from.includes(`(${path.basename(to)})`);
  if (!link(a, ja)) problems.push(`${en} から ${path.basename(ja)} へのリンクがありません`);
  if (!link(b, en)) problems.push(`${ja} から ${path.basename(en)} へのリンクがありません`);

  const ra = runnables(a);
  const rb = runnables(b);

  if (en === "README.md") {
    if (!b.includes("https://nasu726.github.io/Nasu-Stack/catalog/?lang=ja")) {
      problems.push("README.ja.md のcatalogが日本語表示を指定していません");
    }
    if (!b.includes("https://nasu726.github.io/Nasu-Stack/demo/ja/")) {
      problems.push("README.ja.md のdemoが日本語routeを指していません");
    }
  }

  for (const [label, xa, xb] of [
    ["コマンド", ra.cmds, rb.cmds],
    ["URL", ra.urls.map(comparableUrl), rb.urls.map(comparableUrl)],
  ]) {
    const only = (x, y) => x.filter((v) => !y.includes(v));
    for (const v of only(xa, xb)) problems.push(`${en} にしかない${label}: ${v}`);
    for (const v of only(xb, xa)) problems.push(`${ja} にしかない${label}: ${v}`);
  }
}

if (problems.length === 0) {
  console.log(`✅ 英語版と日本語版はずれていません (${PAIRS.length} 対)`);
  process.exit(0);
}

console.error(`❌ 翻訳のずれ ${problems.length} 件\n`);
for (const p of problems) console.error("  ・" + p);
console.error(
  "\n**英語版は外から来た人が最初に読む面です。**" +
    "\n片方だけ直すと、そこで詰まります。",
);
process.exit(1);
