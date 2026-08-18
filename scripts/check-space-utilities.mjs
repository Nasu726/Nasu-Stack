/**
 * 余白トークンのクラスが、本当に定義されているかを確かめます。
 *
 *   node scripts/check-space-utilities.mjs
 *
 * ----------------------------------------------------------------
 * なぜ機械で見張るのか
 * ----------------------------------------------------------------
 * 余白の段階（`md` `2xl` …）は **Tailwind 標準の名前空間に入れていません。**
 * `max-w-sm` のような t シャツサイズと衝突するためです（tokens.css の説明）。
 *
 * その代わり、使いたい形ごとに `@utility` を書く必要があります。
 * **書き忘れても、何のエラーも出ません。** クラス名は残り、
 * ブラウザはそれを知らないので、ただ 0px になります。
 *
 * v0.9c で実測したところ、次が全部 0px でした。
 *
 *   pt-2xl / pb-3xl / mt-xs / mt-xl / mb-2xs
 *
 * `p-*` `px-*` `py-*` `gap-*` しか定義されていなかったためです。
 * **配っている site-footer.tsx の中にもありました。**
 * 見た目が少しずれるだけなので、目では見つかりません。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = path.join(ROOT, "registry", "nasu", "lib", "tokens.css");

const css = fs.readFileSync(TOKENS, "utf8");

/** `--space-md: …` の定義から、段階の名前を集めます。 */
const steps = new Set(
  [...css.matchAll(/--space-([a-z0-9]+)\s*:/g)].map((m) => m[1]),
);
/** `@utility pt-*` から、使える接頭辞を集めます。 */
const defined = new Set(
  [...css.matchAll(/@utility\s+([a-z-]+)-\*/g)].map((m) => m[1]),
);

if (steps.size === 0 || defined.size === 0) {
  console.error("tokens.css から段階か @utility を読み取れませんでした");
  process.exit(2);
}

/** 余白を指しているとみなす接頭辞。ここに無い形は対象外です。 */
const SPACING_PREFIX =
  /^(m|p)(t|b|l|r|s|e|x|y)?$|^gap(-x|-y)?$|^space(-x|-y)?$/;

const TARGET_DIRS = ["registry", "apps", "packages", "examples"];
const TARGET_EXT = new Set([".ts", ".tsx", ".astro", ".css", ".html", ".mdx"]);
const SKIP_DIRS = new Set([
  "node_modules", "dist", ".astro", "template", ".shots", "public",
]);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
    } else if (TARGET_EXT.has(path.extname(e.name))) {
      files.push(path.join(dir, e.name));
    }
  }
};
for (const d of TARGET_DIRS) {
  const p = path.join(ROOT, d);
  if (fs.existsSync(p)) walk(p);
}

/* `sm:pt-lg` のような画面幅つきも見ます。段階名は tokens.css から
   取っているので、`p-4`（Tailwind 標準）は対象になりません。 */
const stepAlt = [...steps].sort((a, b) => b.length - a.length).join("|");
const re = new RegExp(
  `(?<![\w-])(?:[a-z]+:)*([a-z]+(?:-[xy])?)-(${stepAlt})(?![\w-])`,
  "g",
);

const bad = [];
for (const file of files) {
  // tokens.css 自身は定義そのものなので飛ばします
  if (path.resolve(file) === TOKENS) continue;
  const text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      const [, prefix] = m;
      if (!SPACING_PREFIX.test(prefix)) continue;
      if (defined.has(prefix)) continue;
      bad.push({
        file: path.relative(ROOT, file),
        line: i + 1,
        cls: m[0],
        prefix,
      });
    }
  });
}

if (bad.length > 0) {
  console.error(`\n❌ 定義されていない余白のクラスが ${bad.length} 件あります\n`);
  for (const b of bad) {
    console.error(`  ${b.file}:${b.line}  ${b.cls}`);
  }
  console.error(
    `\n  これらは**エラーにならずに 0px になります。**\n` +
      `  registry/nasu/lib/tokens.css に @utility を足すか、クラスを変えてください。\n`,
  );
  process.exit(1);
}

console.log(
  `✅ 余白のクラスは全部定義されています（段階 ${steps.size} / 形 ${defined.size} / ファイル ${files.length}）`,
);
