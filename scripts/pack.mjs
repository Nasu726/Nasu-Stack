/** 配布用アーカイブを作ります: node scripts/pack.mjs */
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
    "--exclude=.git",
    "-C",
    parent,
    name,
  ],
  { stdio: "inherit" },
);

console.log("→", out);
