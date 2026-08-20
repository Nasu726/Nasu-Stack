/**
 * GitHub Releaseへ置くversioned assetを組み立てます。
 *
 *   pnpm release:build                 # package versionからtagを決める
 *   pnpm release:build -- v1.0.0       # tag workflowでは一致も検査する
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNasuStackVersion,
  packCreateNasuStack,
} from "./_pack-create.mjs";
import { RELEASE_VERSION, TARBALL_URL } from "./_site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const rootVersion = readJson("package.json").version;
const cliVersion = createNasuStackVersion();
if (rootVersion !== cliVersion) {
  throw new Error(
    `release versionがずれています: root=${rootVersion} / create-nasu-stack=${cliVersion}`,
  );
}
if (!/^\d+\.\d+\.\d+$/.test(rootVersion)) {
  throw new Error(`Stable releaseに使えないversionです: ${rootVersion}`);
}

// pnpmは環境や呼び出し方によって、引数区切りの`--`もscriptへ渡します。
// workflowと手元のどちらから実行しても、実際のtagだけを検査します。
const releaseArgs = process.argv.slice(2).filter((argument) => argument !== "--");
if (releaseArgs.length > 1) {
  throw new Error(`release:buildの引数が多すぎます: ${releaseArgs.join(" ")}`);
}
const tag = releaseArgs[0] || `v${rootVersion}`;
if (tag !== `v${rootVersion}`) {
  throw new Error(`tagとpackage versionがずれています: ${tag} / ${rootVersion}`);
}
if (RELEASE_VERSION !== rootVersion) {
  throw new Error(
    `Stable入口のversionがずれています: URL=${RELEASE_VERSION} / package=${rootVersion}`,
  );
}
const expectedTarballUrl =
  `https://github.com/Nasu726/Nasu-Stack/releases/download/v${rootVersion}/` +
  `create-nasu-stack-${rootVersion}.tgz`;
if (TARBALL_URL !== expectedTarballUrl) {
  throw new Error(`Stable入口のURLが違います: ${TARBALL_URL}`);
}

for (const file of [
  "README.md",
  "README.ja.md",
  "SECURITY.md",
  "SECURITY.ja.md",
  "docs/security.md",
  "docs/security.ja.md",
  "docs/shadcn-directory.md",
  "packages/create-nasu-stack/index.mjs",
]) {
  if (!fs.readFileSync(path.join(root, file), "utf8").includes(TARBALL_URL)) {
    throw new Error(`${file} がversion付きStable入口を案内していません`);
  }
}

const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## [${rootVersion}]`)) {
  throw new Error(`CHANGELOG.mdに${rootVersion}の項目がありません`);
}
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const readmeJa = fs.readFileSync(path.join(root, "README.ja.md"), "utf8");
if (!readme.includes("Nasu Stack 1.0 is Stable")) {
  throw new Error("README.mdがStable表記になっていません");
}
if (!readmeJa.includes("Nasu Stack 1.0 は Stable")) {
  throw new Error("README.ja.mdがStable表記になっていません");
}

const destination = path.join(root, "release");
if (path.dirname(destination) !== root || path.basename(destination) !== "release") {
  throw new Error(`release出力先がroot直下ではありません: ${destination}`);
}
fs.rmSync(destination, { recursive: true, force: true });

const filename = `create-nasu-stack-${rootVersion}.tgz`;
const packed = packCreateNasuStack({ destination, filename });
const manifestName = `nasu-stack-${rootVersion}-manifest.json`;
const manifest = {
  schemaVersion: 1,
  project: "Nasu Stack",
  version: rootVersion,
  tag,
  sourceCommit: process.env.GITHUB_SHA || null,
  artifacts: [{ name: filename, sha256: packed.sha256, size: packed.size }],
};
fs.writeFileSync(
  path.join(destination, manifestName),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`✓ release version: ${rootVersion}`);
console.log(`✓ tag: ${tag}`);
console.log(`✓ asset: ${filename} (${packed.size} bytes)`);
console.log(`✓ sha256: ${packed.sha256}`);
console.log(`✓ manifest: ${manifestName}`);
