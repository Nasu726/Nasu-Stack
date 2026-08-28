/**
 * TypeScript原本を検査用のESMへ落とす共通準備。
 *
 * 各verifierは「何をcompileするか」とcompiler optionだけを持ち、出力directoryの
 * 初期化、tsconfig生成、tsc起動、ESM境界の用意はここへ集約する。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function compileTypeScriptFixture({ root, out, compilerOptions, files }) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const tsconfig = path.join(out, "tsconfig.json");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ compilerOptions: { outDir: ".", ...compilerOptions }, files }),
  );
  execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
    { stdio: "inherit", cwd: root },
  );
  fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

  return {
    cleanup() {
      fs.rmSync(out, { recursive: true, force: true });
    },
  };
}

const javascriptFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? javascriptFiles(path.join(dir, entry.name))
      : entry.name.endsWith(".js")
        ? [path.join(dir, entry.name)]
        : [],
  );

/** `@/…`を、registry treeと同じ形で出力されたJS間の相対importへ直す。 */
export function rewriteRegistryAliases(out) {
  for (const jsPath of javascriptFiles(out)) {
    const source = fs.readFileSync(jsPath, "utf8");
    fs.writeFileSync(
      jsPath,
      source.replace(/from ["']@\/([^"']+)["']/g, (_, subpath) => {
        const target = path.join(out, subpath) + ".js";
        let relative = path
          .relative(path.dirname(jsPath), target)
          .split(path.sep)
          .join("/");
        if (!relative.startsWith(".")) relative = `./${relative}`;
        return `from "${relative}"`;
      }),
    );
  }
}
