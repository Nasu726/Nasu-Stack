/**
 * create-nasu-stack のtemplate生成・pack・SHA-256を1か所で行います。
 *
 * Pagesのmutableな入口とGitHub Releaseのversioned assetが別々にpackすると、
 * 同じversionなのに中身が違う配布物を作れます。両方がこの関数を呼びます。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pnpm } from "./_proc.mjs";
import { buildCreateTemplate } from "./build-create-template.mjs";
import { acquireWorkspaceLockSync } from "./_workspace-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages", "create-nasu-stack");

export function createNasuStackVersion() {
  return JSON.parse(
    fs.readFileSync(path.join(cli, "package.json"), "utf8"),
  ).version;
}

export function packCreateNasuStack({ destination, filename }) {
  if (!path.isAbsolute(destination)) {
    throw new Error("pack先は絶対pathで指定してください");
  }
  if (path.basename(filename) !== filename || !filename.endsWith(".tgz")) {
    throw new Error(`安全でないasset名です: ${filename}`);
  }

  /* buildからpack完了までtemplateを他processに作り直させません。
     途中だけlockすると、pnpm packが半分だけ新しいtreeを読めます。 */
  const release = acquireWorkspaceLockSync("create-template", {
    root,
    onWait: (owner) =>
      console.log(`· create templateの利用を待っています${owner?.pid ? ` (pid ${owner.pid})` : ""}`),
  });
  try {
    // template/は生成物なので、packの直前に必ず原本から作ります。
    buildCreateTemplate();

    // Windowsでpnpm.cmdを直接spawnしないため、既存の唯一の起動経路を使います。
    const pack = pnpm(["pack"]);
    const packed = execFileSync(pack.cmd, pack.args, {
      cwd: cli,
      encoding: "utf8",
      ...pack.options,
    })
      .trim()
      .split(/\r?\n/)
      .pop()
      .trim();

    fs.mkdirSync(destination, { recursive: true });
    const target = path.join(destination, filename);
    fs.renameSync(path.resolve(cli, packed), target);

    const sha256 = createHash("sha256")
      .update(fs.readFileSync(target))
      .digest("hex");
    fs.writeFileSync(`${target}.sha256`, `${sha256}  ${filename}\n`, "utf8");

    return { target, sha256, size: fs.statSync(target).size };
  } finally {
    release();
  }
}
