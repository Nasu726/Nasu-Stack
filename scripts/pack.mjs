/**
 * 配布用アーカイブを作ります: node scripts/pack.mjs
 *
 * ⚠️ 要確認: `tar` を外部コマンドとして呼んでいます。
 * Windows 10 以降には `tar.exe`（bsdtar）が同梱されているので概ね動くはずですが、
 * **実機で確かめていません。**
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
