/**
 * 配布用アーカイブを作ります: node scripts/pack.mjs
 *
 * `tar` を外部コマンドとして呼んでいます。Windows 11 の実機で確認しました
 * （bsdtar 3.8.4 / `C:\WINDOWS\system32\tar.exe`。`--exclude` も効きます）。
 * Windows 10 1803 より前には同梱されていないので、そこでは動きません。
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parent = path.dirname(root);
const name = path.basename(root);
const out = path.join(parent, `${name}-v0.1.tar.gz`);

execFileSync(
  "tar",
  [
    "czf",
    out,
    "--exclude=node_modules",
    "--exclude=dist",
    "--exclude=.astro",
    "--exclude=.verify-install",
    "-C",
    parent,
    name,
  ],
  { stdio: "inherit" },
);

console.log("→", out);
