import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { npm, stopTree } from "../_proc.mjs";
import { log } from "../_check.mjs";
import { verifyPackedCli } from "./packed-cli.mjs";
import { verifyProjects } from "./projects.mjs";

export async function verifyFull({ root, work, CASES, PAGES, must }) {
  /* **利用者が打つのは npm です。** 生成物の README も CLI の出力も
     `npm install` と書いています。pnpm で確かめても、その経路を
     確かめたことになりません（外部レビュー P1-06b）。
     起動の仕方は scripts/_proc.mjs が唯一の定義です。 */
  const run = (dir, args) => {
    const p = npm(args);
    try {
      execFileSync(p.cmd, p.args, {
        cwd: dir,
        stdio: "pipe",
        encoding: "utf8",
        ...p.options,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, out: (String(e.stdout ?? "") + String(e.stderr ?? "")).slice(-400) };
    }
  };


  await verifyPackedCli({ root, work, must, run });

  /**
   * shadcn CLI は**このリポジトリに固定した版**を直接動かします。
   * `pnpm dlx shadcn@latest` にすると、毎回「その時点で publish されている
   * もの」を実行することになり、minimumReleaseAge と lockfile を素通りします。
   */
  const shadcn = (dir, args) => {
    try {
      execFileSync(
        process.execPath,
        [path.join(root, "node_modules", "shadcn", "dist", "index.js"), ...args],
        { cwd: dir, stdio: "pipe", encoding: "utf8" },
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, out: (String(e.stdout ?? "") + String(e.stderr ?? "")).slice(-400) };
    }
  };


  /* レジストリを配ります。公開先ではなく手元の public/ を使うのは、
     この判定を「公開先が生きているか」に依存させないためです。 */
  let registryServer = null;
  let registryPort = 0;
  if (fs.existsSync(path.join(root, "public", "r", "index.json"))) {
    registryPort = 5088;
    registryServer = spawn(
      process.execPath,
      [path.join(root, "scripts/serve-registry.mjs"), String(registryPort)],
      { stdio: "ignore", detached: process.platform !== "win32" },
    );
    let ok = false;
    for (let n = 0; n < 40; n++) {
      await new Promise((r) => setTimeout(r, 250));
      ok = await fetch(`http://127.0.0.1:${registryPort}/r/index.json`).then(
        (r) => r.ok,
        () => false,
      );
      if (ok) break;
    }
    if (!ok) {
      log("レジストリを配れませんでした。本物のCLI判定を失敗にします");
      stopTree(registryServer);
      registryServer = null;
      registryPort = 0;
    }
  } else {
    log("public/r がありません。先に `pnpm registry:build` を走らせてください");
    log("（本物のCLI判定を失敗にします）");
  }


  await verifyProjects({ root, work, CASES, PAGES, must, run, shadcn, registryPort });

  stopTree(registryServer);
}
