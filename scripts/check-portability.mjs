/**
 * その環境でしか通らない書き方を探します。
 *
 *   node scripts/check-portability.mjs
 *
 * ----------------------------------------------------------------
 * なぜこの検査があるのか
 * ----------------------------------------------------------------
 * `verify-states.mjs` に `/home/claude/shots/...` と書いてありました。
 * 開発コンテナでは root で動くので通ります。**CI では落ちます。**
 * GitHub Actions の runner は root ではなく、`/home` は root の 755 なので
 * `/home/claude` を作れません（EACCES）。
 *
 * 厄介なのは壊れ方です。判定は 1 つも落ちていないのに、
 * スクリーンショットの保存で例外が飛んでスクリプトが死に、
 * 「✗ 実ブラウザ: 非同期の状態」とだけ出ます。**原因が書いてありません。**
 *
 * この種の間違いは、書いた本人の環境では絶対に再現しません。
 * だから人のレビューではなく機械で捕まえます。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 見に行く場所。生成物や依存は見ません。 */
const TARGET_DIRS = ["scripts", "registry", "apps", "packages", ".github"];
const TARGET_EXT = new Set([".mjs", ".js", ".ts", ".tsx", ".astro", ".yml", ".yaml"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".astro",
  "template", // packages/create-nasu-stack/template は生成物
  ".shots",
]);

/**
 * 禁止する書き方。
 * 「そのマシンにしか無い場所」を指す絶対パスだけを対象にします。
 * `/tmp` は POSIX ならどこにでもあるので対象外です
 * （Windows 用には os.tmpdir() を使ってください）。
 */
const RULES = [
  {
    // /home/<誰か>/ — 開発コンテナのホームを直に書いたもの
    re: new RegExp("[\"'`]" + "/home/" + "[^\"'`\\s$]+", "g"),
    why: "特定ユーザのホームを直接指しています。CI の実行ユーザには作れません",
  },
  {
    // /Users/<誰か>/ — macOS のホーム
    re: new RegExp("[\"'`]" + "/Users/" + "[^\"'`\\s$]+", "g"),
    why: "macOS のホームを直接指しています。他の OS で存在しません",
  },
  {
    // C:\Users\... — Windows のホーム
    re: /[A-Za-z]:\\\\?Users\\\\?/g,
    why: "Windows のホームを直接指しています",
  },
];

/** この検査自身は、上のパターンを文字列として持っているので除外します。 */
const SELF = path.join(ROOT, "scripts", "check-portability.mjs");

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (TARGET_EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = TARGET_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter(
  (f) => f !== SELF,
);

const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      // 説明文の中で触れているだけの行は見逃します
      if (/^\s*(\*|\/\/|#)/.test(line)) return;
      rule.re.lastIndex = 0;
      const m = rule.re.exec(line);
      if (m) {
        hits.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          text: m[0].slice(0, 80),
          why: rule.why,
        });
      }
    });
  }
}

console.log(`· ${files.length} ファイルを見ました`);
if (hits.length === 0) {
  console.log("✅ 環境に張り付いた絶対パスはありません");
  process.exit(0);
}
console.log(`❌ ${hits.length} 件`);
for (const h of hits) {
  console.log(`   ✗ ${h.file}:${h.line}  ${h.text}`);
  console.log(`      ${h.why}`);
}
console.log("");
console.log("直し方: リポジトリからの相対にしてください。");
console.log("  画面の記録なら scripts/_browser.mjs の SHOTS_DIR / shot() を使います。");
console.log("  一時ファイルなら fs.mkdtempSync(path.join(os.tmpdir(), ...)) を使います。");
process.exit(1);
