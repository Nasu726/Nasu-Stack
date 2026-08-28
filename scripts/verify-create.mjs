/**
 * 入口（create-nasu-stack）の検証。
 *
 *   node scripts/verify-create.mjs          軽い検査だけ（pnpm verify に入る）
 *   node scripts/verify-create.mjs --full   install → build → 実ブラウザまで
 *
 * **「生成できた」では足りません。** 生成物が本当に動くかを測ります。
 * 実際、この検査を書いている途中で足場のコードが型検査に通らないこと
 * （`Button` に `action` は無い）が見つかりました。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireWorkspaceLockSync } from "./_workspace-lock.mjs";
import { createCheckHarness, log } from "./_check.mjs";
import { verifyGeneration } from "./verify-create/generation.mjs";
import { verifySafety } from "./verify-create/safety.mjs";
import { verifyConfiguration } from "./verify-create/configuration.mjs";
import { verifyGuidance } from "./verify-create/guidance.mjs";
import { verifyFull } from "./verify-create/full.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "packages", "create-nasu-stack", "index.mjs");
const FULL = process.argv.includes("--full");
/*
 * light/fullの2 verifierとpackが同じtemplate/を作り直します。
 * templateから生成先へcopyし終わるまでlockし、半分だけ別processの生成物に
 * なるraceを防ぎます。以後のinstall / buildは独立したtemp dirなので並列にできます。
 */
const releaseTemplateLock = acquireWorkspaceLockSync("create-template", {
  root,
  onWait: (owner) =>
    console.log(`· create templateの利用を待っています${owner?.pid ? ` (pid ${owner.pid})` : ""}`),
});

const { must, report } = createCheckHarness();
const work = fs.mkdtempSync(path.join(os.tmpdir(), "wt-create-"));
const create = (name, args = []) => {
  try {
    const out = execFileSync(process.execPath, [CLI, name, "--yes", ...args], {
      cwd: work,
      encoding: "utf8",
    });
    return { ok: true, out };
  } catch (e) {
    return {
      ok: false,
      out: String(e.stdout ?? "") + String(e.stderr ?? ""),
      status: e.status,
    };
  }
};

/**
 * 検査する雛型。**ここが唯一の一覧です。**
 * 増やしたときに書き足す場所が複数あると、必ずどれかを忘れます
 * （忘れても何も言われず、その雛型だけ検査を素通りします）。
 */
const CASES = [
  { kind: "astro", name: "my-site", port: 4598 },
  { kind: "blog", name: "my-blog", port: 4600 },
  { kind: "vite", name: "my-app", port: 4599 },
];
/** 検査するページ。ブログ付きは入口だけ見ても意味がありません。 */
const PAGES = {
  astro: ["/"],
  blog: [
    "/", "/lp/", "/about/", "/contact/", "/blog/", "/blog/hello/",
    "/ja/", "/ja/lp/", "/ja/about/", "/ja/contact/", "/ja/blog/", "/ja/blog/hello/",
  ],
  vite: ["/"],
};

await verifyGeneration({ root, work, CASES, create, must });
await verifySafety({ work, CLI, create, must });
await verifyConfiguration({ root, work, CASES, must });
await verifyGuidance({ root, work, CLI, CASES, create, must });

/* ここより後はtemplate/を読みません。重いfull検査の間まで塞ぎません。 */
releaseTemplateLock();

if (!FULL) {
  log("install / build / 実ブラウザ の検査は --full を付けたときだけ走ります");
  log("（pnpm verify:create で実行されます）");
} else {
  await verifyFull({ root, work, CASES, PAGES, must });
}

/* 後片付け。**失敗しても検査は落としません。**
   ここで例外が飛ぶと、判定が全部緑なのに終了コードだけ 1 になり、
   一覧のどこにも原因が出ません（v0.9a で実際にそうなりました）。
   Windows は終了直後のプロセスがまだファイルを掴んでいることがあるので、
   `rmSync` の再試行（Node が用意しています）に任せます。 */
try {
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
} catch (e) {
  console.log(`· ⚠️ 作業ディレクトリを消せませんでした (${work}): ${String(e).slice(0, 160)}`);
}

process.exit(report().ok ? 0 : 1);
