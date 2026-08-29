import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireWorkspaceLockSync,
  workspaceLockPath,
} from "./_workspace-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv[2] === "--lock-worker") {
  const [, , , scope, trace, id] = process.argv;
  const release = acquireWorkspaceLockSync(scope, { root, pollMs: 10 });
  fs.appendFileSync(trace, `${JSON.stringify({ id, event: "start", at: Date.now() })}\n`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 180);
  fs.appendFileSync(trace, `${JSON.stringify({ id, event: "end", at: Date.now() })}\n`);
  release();
  process.exit(0);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
}

function readDirectory(directory) {
  return fs
    .readdirSync(path.join(root, directory), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".mjs"))
    .sort()
    .map((file) => read(path.join(directory, file)))
    .join("\n");
}

/* main pushはPagesだけが受け、Pages内で唯一のverify定義を呼びます。 */
{
  const verify = read(".github/workflows/verify.yml");
  const pages = read(".github/workflows/pages.yml");
  const release = read(".github/workflows/release.yml");
  const verifyMain = read("scripts/verify.mjs");
  const verifyCreate = [
    read("scripts/verify-create.mjs"),
    readDirectory("scripts/verify-create"),
  ].join("\n");
  const installReal = read("scripts/verify-install-real.mjs");
  const scaffoldDeps = read("scripts/check-scaffold-deps.mjs");
  const registryDeps = read("scripts/check-registry-deps.mjs");

  assert.equal(
    verify.includes("\n  push:"),
    false,
    "verify.ymlがmain pushも受けるとPages内のverifyと二重実行になる",
  );
  for (const trigger of ["  pull_request:", "  schedule:", "  workflow_dispatch:", "  workflow_call:"]) {
    assert.ok(verify.includes(trigger), `verify.ymlに${trigger.trim()}が必要`);
  }
  assert.ok(verify.includes("\n  verify:\n"), "required check verifyを維持する");
  assert.ok(verify.includes("\n  verify-create:\n"), "required check verify-createを維持する");
  assert.ok(pages.includes("\n  push:\n    branches: [main]"), "main pushはPagesが受ける");
  assert.ok(pages.includes("uses: ./.github/workflows/verify.yml"), "Pagesはverifyを再利用する");
  assert.ok(release.includes("uses: ./.github/workflows/verify.yml"), "tag releaseもverifyを再利用する");
  assert.ok(
    verify.includes(`run: pnpm release:build "v$(node -p "require('./package.json').version")"`),
    "PR CIでrelease workflowと同じtag引数経路を検査する",
  );
  assert.ok(
    verifyMain.includes('name: "Astro sitemapから検査対象を取得"'),
    "sitemap取得失敗をtop pageだけのgreenへ縮退させない",
  );
  assert.ok(
    verifyCreate.includes('false,\n        "local registryを配れませんでした"'),
    "full create検査でlocal registry不在をskipしない",
  );
  assert.ok(
    registryDeps.includes("checkRegistryContract(root)"),
    "Stableのpublic registry契約をverifyから外さない",
  );
  for (const [name, source] of [
    ["本物のshadcn", installReal],
    ["scaffold依存", scaffoldDeps],
  ]) {
    assert.ok(
      source.includes("if (process.env.CI)") && source.includes("process.exit(1)"),
      `CIで${name}のnetwork検査をskipしない`,
    );
  }
}

/* 同じworkspaceのwriterはprocessが別でも重ならないことを実測します。 */
{
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nasu-lock-test-"));
  const trace = path.join(fixture, "trace.ndjson");
  const scope = `fixture-${process.pid}`;
  const worker = (id) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "--lock-worker", scope, trace, id],
        { cwd: root, stdio: "inherit" },
      );
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`lock worker ${id}: exit ${code}`)),
      );
    });

  await Promise.all([worker("a"), worker("b")]);
  const events = fs
    .readFileSync(trace, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.equal(events.length, 4);
  assert.deepEqual(
    events.map(({ event }) => event),
    ["start", "end", "start", "end"],
    "2 processのcritical sectionが重なっている",
  );

  // crash後のownerを模したlockは、永続的な手詰まりにせず回収します。
  const staleScope = `stale-fixture-${process.pid}`;
  const stalePath = workspaceLockPath(staleScope, root);
  fs.mkdirSync(stalePath);
  fs.writeFileSync(
    path.join(stalePath, "owner.json"),
    `${JSON.stringify({ token: "dead", pid: 2_147_483_647 })}\n`,
  );
  const release = acquireWorkspaceLockSync(staleScope, { root, timeoutMs: 500 });
  release();
  assert.equal(fs.existsSync(stalePath), false, "dead ownerのlockを回収できない");

  // mkdir直後にkillされowner.jsonが無い場合も、猶予後は回収できます。
  const ownerlessScope = `ownerless-fixture-${process.pid}`;
  const ownerlessPath = workspaceLockPath(ownerlessScope, root);
  fs.mkdirSync(ownerlessPath);
  const old = new Date(Date.now() - 10_000);
  fs.utimesSync(ownerlessPath, old, old);
  const releaseOwnerless = acquireWorkspaceLockSync(ownerlessScope, {
    root,
    timeoutMs: 500,
  });
  releaseOwnerless();
  assert.equal(fs.existsSync(ownerlessPath), false, "owner不明の古いlockを回収できない");

  fs.rmSync(fixture, { recursive: true, force: true });
}

console.log("✓ main pushのverifyはPages内の1経路だけで、PR / schedule / tag経路を保つ");
console.log("✓ sitemap / local registry / public contract / CI network検査をgreenから外さない");
console.log("✓ workspace writerはprocess間で直列化し、dead / owner不明のlockを回収する");
