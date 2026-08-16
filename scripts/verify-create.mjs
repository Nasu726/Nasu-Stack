/**
 * 入口（create-webtemplate）の検証。
 *
 *   node scripts/verify-create.mjs          軽い検査だけ（pnpm verify に入る）
 *   node scripts/verify-create.mjs --full   install → build → 実ブラウザまで
 *
 * **「生成できた」では足りません。** 生成物が本当に動くかを測ります。
 * 実際、この検査を書いている途中で足場のコードが型検査に通らないこと
 * （`Button` に `action` は無い）が見つかりました。
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "packages", "create-webtemplate", "index.mjs");
const FULL = process.argv.includes("--full");

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}
const log = (...a) => console.log("·", ...a);

const work = fs.mkdtempSync(path.join(os.tmpdir(), "wt-create-"));
const create = (name, args = []) => {
  try {
    const out = execFileSync(process.execPath, [CLI, name, "--yes", ...args], {
      cwd: work,
      encoding: "utf8",
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? "") + String(e.stderr ?? ""), status: e.status };
  }
};

/* ===== 0. テンプレートが原本と同期しているか ==================== */
{
  // 生成し直して差分が無いことを見ます。
  // テンプレートは commit していないので、ずれるとしたら
  // 「生成し忘れ」だけです。それを機械で捕まえます。
  execFileSync(process.execPath, [path.join(root, "scripts/build-create-template.mjs")], {
    cwd: root,
    stdio: "ignore",
  });
  const tpl = path.join(root, "packages", "create-webtemplate", "template");
  const list = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { recursive: true }).map(String).sort()
      : [];
  const astro = list(path.join(tpl, "astro"));
  const vite = list(path.join(tpl, "vite"));
  must("0. テンプレートが生成できる", astro.length > 0 && vite.length > 0, `astro ${astro.length} / vite ${vite.length}`);

  // 原本と中身が一致しているか（1 ファイル抜き取り）
  const a = fs.readFileSync(path.join(root, "registry/nasu/components/ui/layout.tsx"), "utf8");
  const b = fs.readFileSync(path.join(tpl, "vite/src/components/ui/layout.tsx"), "utf8");
  must("   原本とテンプレートの中身が一致する", a === b);
}

/* ===== 1〜3. 生成 =============================================== */
{
  const r = create("my-site", ["--template", "astro"]);
  must("1. astro テンプレートを生成できる", r.ok, r.out.trim().split("\n").pop());
  const files = fs
    .readdirSync(path.join(work, "my-site"), { recursive: true })
    .map(String);
  const want = [
    "package.json",
    "tsconfig.json",
    "astro.config.mjs",
    ".gitignore",
    "README.md",
    path.join("src", "pages", "index.astro"),
    path.join("src", "styles", "tokens.css"),
    path.join("src", "components", "ui", "layout.tsx"),
    path.join("src", "scripts", "check-responsive.mjs"),
  ];
  const missing = want.filter((w) => !files.includes(w));
  must("3. 必要なファイルが揃っている", missing.length === 0, missing.join(", ") || `${files.length} ファイル`);

  const r2 = create("my-app", ["--template", "vite"]);
  must("2. vite テンプレートを生成できる", r2.ok);
  must(
    "   vite 側にも入口がある",
    fs.existsSync(path.join(work, "my-app", "src", "App.tsx")),
  );
}

/* ===== 4〜5. 上書き事故の防止 =================================== */
{
  // 既存の空でないディレクトリには生成しない。
  // create 系の道具で一番やってはいけない事故です。
  const r = create("my-site", ["--template", "astro"]);
  must("4. 空でないディレクトリには生成しない", !r.ok, `終了コード ${r.status}`);
  must(
    "   もとのファイルが残っている",
    fs.existsSync(path.join(work, "my-site", "package.json")),
  );

  fs.mkdirSync(path.join(work, "empty-dir"));
  const r2 = create("empty-dir", ["--template", "astro"]);
  must("5. 空のディレクトリになら生成できる", r2.ok);
}

/* ===== 6. 名前の検証 ============================================ */
{
  const { validateName } = await import(
    new URL(`file://${CLI}`).href
  );
  const cases = [
    ["My-Site", "大文字"],
    ["my site", "空白"],
    [".hidden", "先頭のドット"],
    ["", "空"],
    ["a/b", "スラッシュ"],
  ];
  for (const [name, why] of cases) {
    must(`6. 不正な名前を弾く（${why}）`, validateName(name) !== null, validateName(name) ?? "通ってしまった");
  }
  must("   まともな名前は通る", validateName("my-site-2") === null);
}

/* ===== 7. paths が registry の target と一致するか =============== */
{
  const ts = JSON.parse(
    fs.readFileSync(path.join(work, "my-app", "tsconfig.json"), "utf8"),
  );
  const paths = ts.compilerOptions?.paths?.["@/*"];
  must(
    "7. tsconfig の paths が src/* を指す",
    Array.isArray(paths) && paths[0] === "src/*",
    JSON.stringify(paths),
  );
  // registry.json の target は "components/ui/x.tsx" 形式。
  // これを src/ の下に置くので、@/* → src/* で辻褄が合います。
  const registry = JSON.parse(fs.readFileSync(path.join(root, "registry.json"), "utf8"));
  const bad = registry.items
    .flatMap((i) => i.files ?? [])
    .filter((f) => f.target?.startsWith("/") || f.target?.startsWith("src/"));
  must("   registry の target が相対のまま", bad.length === 0, bad.map((b) => b.target).join(", "));
}

/* ===== 8〜12. 生成物が本当に動くか（--full のときだけ） ========= */
if (!FULL) {
  log("install / build / 実ブラウザ の検査は --full を付けたときだけ走ります");
  log("（pnpm verify:create で実行されます）");
} else {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const run = (dir, args) => {
    try {
      execFileSync(pnpm, args, { cwd: dir, stdio: "pipe", encoding: "utf8" });
      return { ok: true };
    } catch (e) {
      return { ok: false, out: (String(e.stdout ?? "") + String(e.stderr ?? "")).slice(-400) };
    }
  };

  for (const [name, kind, port, buildArgs, checkArgs] of [
    ["my-site", "astro", 4598, ["exec", "astro", "build"], ["exec", "astro", "check"]],
    ["my-app", "vite", 4599, ["exec", "vite", "build"], ["exec", "tsc", "--noEmit"]],
  ]) {
    const dir = path.join(work, name);
    log(`${kind}: pnpm install …`);
    const i = run(dir, ["install", "--ignore-workspace"]);
    must(`8. ${kind}: pnpm install が通る`, i.ok, i.out ?? "");
    if (!i.ok) continue;

    const t = run(dir, checkArgs);
    must(`9. ${kind}: 型検査が通る`, t.ok, t.out ?? "");

    const b = run(dir, buildArgs);
    must(`10. ${kind}: ビルドが通る`, b.ok, b.out ?? "");
    if (!b.ok) continue;

    // 配信して実ブラウザで見ます
    const server = spawn(
      pnpm,
      ["exec", kind === "astro" ? "astro" : "vite", "preview", "--port", String(port), "--host", "127.0.0.1"],
      { cwd: dir, stdio: "ignore", detached: process.platform !== "win32" },
    );
    let up = false;
    for (let n = 0; n < 40; n++) {
      await new Promise((r) => setTimeout(r, 300));
      up = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok, () => false);
      if (up) break;
    }
    must(`11. ${kind}: 配信して画面が出る`, up);

    if (up) {
      const { checkUrls, formatReport, checkImageSizing, formatImageReport } =
        await import(
          new URL(
            `file://${path.join(root, "registry/nasu/scripts/check-responsive.mjs")}`,
          ).href
        );
      const report = await checkUrls([`http://127.0.0.1:${port}/`]);
      const { text, problems } = formatReport(report);
      const img = formatImageReport(await checkImageSizing([`http://127.0.0.1:${port}/`]));
      must(`12. ${kind}: 端末幅の検査（5 幅）を通る`, problems === 0, problems ? text : "");
      must(`    ${kind}: 画像が場所を取っている`, img.problems === 0, img.problems ? img.text : "");
    }

    try {
      if (process.platform === "win32") server.kill();
      else process.kill(-server.pid);
    } catch {
      /* もう落ちている */
    }
  }
}

/* ================================================================ */

fs.rmSync(work, { recursive: true, force: true });

const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(
  failed.length === 0
    ? `✅ 判定 ${checks.length} 件すべて成功`
    : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
);
for (const f of failed) console.log(`   ✗ ${f.label}  ${f.detail}`);
process.exit(failed.length ? 1 : 0);
