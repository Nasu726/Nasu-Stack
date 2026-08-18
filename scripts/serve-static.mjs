/**
 * ビルド済みの中身を配ります。**別プロセスとして動かすための入口です。**
 *
 *   node scripts/serve-static.mjs <ディレクトリ> <ポート> [--spa] [--base=/Nasu Stack]
 *
 * ----------------------------------------------------------------
 * なぜ「別プロセス」なのか
 * ----------------------------------------------------------------
 * `verify.mjs` は各工程を **`spawnSync`（同期）** で回します。
 * サーバを同じプロセスに置くと、**子が走っている間はイベントループが
 * 止まるので、要求に応答できません。** 接続だけ受け付けて返事をしないので、
 * 検査側は `networkidle` を待ち続けて 30 秒で諦めます。
 *
 * 実際それで実ブラウザの工程が軒並み遅くなり、全体が 10 分を超えました。
 * **「サーバが落ちている」のではなく「返事ができない」**ので、
 * 原因が分かりにくい壊れ方でした。
 *
 * 道具の preview（astro 7 はデーモン）を使わない理由は _static.mjs に。
 */
import path from "node:path";
import { serveStatic } from "./_static.mjs";

const [dir, portArg, ...rest] = process.argv.slice(2);
if (!dir || !portArg) {
  console.error(
    "使い方: node scripts/serve-static.mjs <ディレクトリ> <ポート> [--spa] [--base=/x]",
  );
  process.exit(2);
}

const spa = rest.includes("--spa");
const basePath = rest.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "";

try {
  await serveStatic(path.resolve(dir), Number(portArg), { spa, basePath });
  console.log(`serving ${dir} → http://127.0.0.1:${portArg}${basePath}/`);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
