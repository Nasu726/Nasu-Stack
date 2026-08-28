import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { packCreateNasuStack } from "../_pack-create.mjs";

export async function verifyPackedCli({ root, work, must, run }) {
  /* ソースのindex.mjsだけを動かしても、配布対象のfiles設定漏れは見えません。
     利用者が受け取るtgzそのものをnpmで起動し、内部moduleも本当に同梱された
     ことを確認します。PagesとGitHub Releaseも同じpack関数を使います。 */
  const packedDir = path.join(work, "packed-cli");
  let packedResult = { ok: false, out: "packを実行できませんでした" };
  try {
    const packed = packCreateNasuStack({
      destination: packedDir,
      filename: "create-nasu-stack-test.tgz",
    });
    const runner = path.join(work, "packed-runner");
    fs.mkdirSync(runner);
    fs.writeFileSync(
      path.join(runner, "package.json"),
      `${JSON.stringify({ private: true }, null, 2)}\n`,
    );
    const installed = run(runner, [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      packed.target,
    ]);
    if (!installed.ok) throw new Error(installed.out);

    const installedRoot = path.join(runner, "node_modules", "create-nasu-stack");
    const installedPackage = JSON.parse(
      fs.readFileSync(path.join(installedRoot, "package.json"), "utf8"),
    );
    const binTarget = installedPackage.bin?.["create-nasu-stack"];
    if (binTarget !== "index.mjs") {
      throw new Error(`配布packageのbinが不正です: ${JSON.stringify(binTarget)}`);
    }
    const out = execFileSync(process.execPath, [
      path.join(installedRoot, binTarget),
      "packed-site",
      "--template",
      "astro",
      "--lang",
      "en",
      "--yes",
    ], {
      cwd: runner,
      encoding: "utf8",
      stdio: "pipe",
    });
    packedResult = { ok: true, out };
  } catch (e) {
    packedResult = {
      ok: false,
      out: (String(e.stdout ?? "") + String(e.stderr ?? "") + String(e.message ?? "")).slice(-600),
    };
  }
  must(
    "7.49 npmで展開した配布tgzのbinを起動できる",
    packedResult.ok && fs.existsSync(path.join(work, "packed-runner", "packed-site", "HowToUse.md")),
    packedResult.out,
  );


}
