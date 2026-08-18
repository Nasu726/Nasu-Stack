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
import { npm, pnpm, stopTree } from "./_proc.mjs";

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
  blog: ["/", "/lp/", "/about/", "/contact/", "/blog/", "/blog/hello/"],
  vite: ["/"],
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
  const counts = CASES.map((c) => [c.kind, list(path.join(tpl, c.kind)).length]);
  must(
    "0. テンプレートが生成できる",
    counts.every(([, n]) => n > 0),
    counts.map(([k, n]) => `${k} ${n}`).join(" / "),
  );

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

  /* ブログ付きの雛型。**中身は apps/site から生成しています。**
     写し漏れがあると、型検査でもビルドでもなく「ページが無い」で出ます。 */
  const r3 = create("my-blog", ["--template", "blog"]);
  must("2.5 blog テンプレートを生成できる", r3.ok, r3.out.trim().slice(-120));
  const blogWant = [
    path.join("src", "pages", "lp.astro"),
    path.join("src", "pages", "about.astro"),
    path.join("src", "pages", "contact.astro"),
    path.join("src", "pages", "blog", "index.astro"),
    path.join("src", "pages", "rss.xml.ts"),
    path.join("src", "pages", "sitemap.xml.ts"),
    path.join("src", "content.config.ts"),
    path.join("src", "content", "blog", "hello.md"),
    path.join("src", "lib", "posts.ts"),
    path.join("src", "lib", "nav.ts"),
    path.join("public", "works.json"),
  ];
  const blogFiles = fs
    .readdirSync(path.join(work, "my-blog"), { recursive: true })
    .map(String);
  const blogMissing = blogWant.filter((w) => !blogFiles.includes(w));
  must(
    "    blog: ページと記事が揃っている",
    blogMissing.length === 0,
    blogMissing.join(", ") || `${blogFiles.length} ファイル`,
  );

  /* **検査用の文面を配ってはいけません。** apps/site の記事は
     「この記事は検査用です」と自己申告しています。そのまま雛型に入れると、
     利用者全員のブログにその文章が載ります（v0.9c の指摘 C-5）。

     文面を言葉で探すのはやめました。**言い回しを変えれば通ってしまいます。**
     雛型が持つべき記事は scaffold/blog に置いてある分だけなので、
     ファイル名の集合が一致するかを見ます。 */
  const wantArticles = fs
    .readdirSync(
      path.join(root, "packages/create-webtemplate/scaffold/blog/src/content/blog"),
    )
    .filter((f) => f.endsWith(".md"))
    .sort();
  const gotArticles = fs
    .readdirSync(path.join(work, "my-blog", "src", "content", "blog"))
    .filter((f) => f.endsWith(".md"))
    .sort();
  const extra = gotArticles.filter((f) => !wantArticles.includes(f));
  must(
    "    blog: 記事が雛型用のものだけになっている",
    wantArticles.length > 0 && extra.length === 0,
    extra.length ? `原本から漏れています: ${extra.join(", ")}` : gotArticles.join(" "),
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
    Array.isArray(paths) && paths[0] === "./src/*",
    JSON.stringify(paths),
  );
  /* `baseUrl` は TypeScript 7.0 で機能しなくなり、5.x でも警告が出ます。
     **生成物を開いた瞬間にエディタが警告を出す**のは、初めての人には
     「壊れている」と映ります。`paths` を `./` で始めれば要りません。 */
  must(
    "   tsconfig に baseUrl が無い（TS 7.0 で廃止）",
    ts.compilerOptions?.baseUrl === undefined,
    ts.compilerOptions?.baseUrl ?? "",
  );
  // registry.json の target は "components/ui/x.tsx" 形式。
  // これを src/ の下に置くので、@/* → src/* で辻褄が合います。
  const registry = JSON.parse(fs.readFileSync(path.join(root, "registry.json"), "utf8"));
  const bad = registry.items
    .flatMap((i) => i.files ?? [])
    .filter((f) => f.target?.startsWith("/") || f.target?.startsWith("src/"));
  must("   registry の target が相対のまま", bad.length === 0, bad.map((b) => b.target).join(", "));
}

/* ===== 7.5. 生成物で「部品を足す」が本当にできるか ================ */
/**
 * README は「部品が足りなくなったら足す」と書いています。
 * **v0.9a まで、その手段が入っていませんでした。**
 *
 * `components.json` が無いと shadcn CLI は対話で聞いてきて止まり、
 * 作らせても `registries` が無いので `Unknown registry "@nasu"` になります。
 * 案内どおりに進んだ人が 2 回続けて詰まる状態でした。
 *
 * **部品側の検査は全部緑でした。** 生成物を実際に触るまで気づけません。
 * だからここで機械に見せます。
 */
for (const { name, kind } of CASES) {
  const p = path.join(work, name, "components.json");
  if (!fs.existsSync(p)) {
    must(`7.5 ${kind}: components.json がある`, false, "ファイルが無い");
    continue;
  }
  const cj = JSON.parse(fs.readFileSync(p, "utf8"));
  must(`7.5 ${kind}: components.json がある`, true);
  must(
    `    ${kind}: @nasu の registries が宣言されている`,
    typeof cj.registries?.["@nasu"] === "string" &&
      cj.registries["@nasu"].includes("{name}"),
    cj.registries?.["@nasu"] ?? "(無し)",
  );
  // alias が tsconfig と食い違うと、入った直後にビルドが落ちます。
  const ts = JSON.parse(fs.readFileSync(path.join(work, name, "tsconfig.json"), "utf8"));
  const aliasOk = ts.compilerOptions?.paths?.["@/*"]?.[0] === "./src/*" &&
    cj.aliases?.ui === "@/components/ui";
  must(`    ${kind}: alias が tsconfig と揃っている`, aliasOk, cj.aliases?.ui ?? "");
}

/* ===== 7.55. エディタの補完が、実在する部品だけを出しているか ==== */
/**
 * 補完は `registry.json` と各部品の型から生成しています（build-snippets.mjs）。
 *
 * **いちばん悪いのは「補完に出たのに部品が無い」です。** 選んで書いた側は
 * 自分が間違えたと思うので、原因に辿り着けません。だから
 * **補完に出る名前が、同梱のファイルで本当に export されているか**を見ます。
 */
for (const { name, kind } of CASES) {
  const p = path.join(work, name, ".vscode", "webtemplate.code-snippets");
  if (!fs.existsSync(p)) {
    must(`7.55 ${kind}: エディタの補完が入っている`, false, "ファイルが無い");
    continue;
  }
  const snips = JSON.parse(fs.readFileSync(p, "utf8"));
  const keys = Object.keys(snips);
  must(`7.55 ${kind}: エディタの補完が入っている`, keys.length > 10, `${keys.length} 個`);

  // 接頭辞が揃っていないと、補完の一覧で見分けが付きません
  const badPrefix = keys.filter((k) => !String(snips[k].prefix ?? "").startsWith("wt-"));
  must(
    `     ${kind}: 接頭辞が wt- で揃っている`,
    badPrefix.length === 0,
    badPrefix.join(", "),
  );

  /* 補完が指す部品が、本当に同梱されているか。
     import 文は description の 1 行目に入れてあります。 */
  const missing = [];
  for (const k of keys) {
    const line = String(snips[k].description ?? "").split(String.fromCharCode(10))[0];
    const MARK = ' from "@/';
    const at = line.indexOf(MARK);
    const m = at < 0 ? null : line.slice(at + MARK.length, line.lastIndexOf('"'));
    if (!m) {
      missing.push(`${k}(import が読めない)`);
      continue;
    }
    const file = path.join(work, name, "src", `${m}.tsx`);
    if (!fs.existsSync(file)) {
      missing.push(`${k}(${m} が無い)`);
      continue;
    }
    const src = fs.readFileSync(file, "utf8");
    const declared = ["export function ", "export const ", "export default function "]
      .some((d) => {
        for (let at = src.indexOf(d + k); at >= 0; at = src.indexOf(d + k, at + 1)) {
          const after = src[at + d.length + k.length];
          if (["(", " ", "<", ":", "="].includes(after)) return true;
        }
        return false;
      });
    if (!declared) missing.push(`${k}(export されていない)`);
  }
  must(
    `     ${kind}: 補完の部品がすべて実在する`,
    missing.length === 0,
    missing.slice(0, 5).join(", "),
  );
}

/* ===== 7.4. 使い方が「消えない場所」にあるか ====================== */
/**
 * 生成の直後に手順を画面へ出しても、次のコマンドで流れて消えます。
 * **スクロールを遡って探すことになる**——実際にそう指摘されました。
 * ファイルとして残っていることを機械で確かめます。
 */
for (const { name, kind } of CASES) {
  const p = path.join(work, name, "HowToUse.md");
  const md = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  must(`7.4 ${kind}: HowToUse.md がある`, md.length > 500, `${md.length} 文字`);
  // README から辿れないと、置いてあっても気づかれません。
  const readme = fs.readFileSync(path.join(work, name, "README.md"), "utf8");
  must(`    ${kind}: README から HowToUse.md へ辿れる`, readme.includes("HowToUse.md"));
}

/* ===== 7.42. 秘密の値が commit されない形になっているか ============ */
/**
 * このテンプレートはフォームの送信先など環境変数を扱う導線を持っています。
 * **初めての人ほど `git add .` を打ちます。** 一度 git の履歴に入った鍵は、
 * ファイルを消しても消えません。作り直しが必要になります。
 */
for (const { name, kind } of CASES) {
  const gi = fs.readFileSync(path.join(work, name, ".gitignore"), "utf8");
  const ok = /^\.env$/m.test(gi) && /^\.env\.\*$/m.test(gi) && /^!\.env\.example$/m.test(gi);
  must(`7.42 ${kind}: .gitignore が .env を無視する`, ok, ok ? "" : gi.slice(0, 80));
  must(
    `     ${kind}: .env.example がある`,
    fs.existsSync(path.join(work, name, ".env.example")),
  );
  // 生成物が要求する Node を、機械が読める形でも書いておく
  const pkg = JSON.parse(fs.readFileSync(path.join(work, name, "package.json"), "utf8"));
  must(
    `     ${kind}: engines.node が宣言されている`,
    typeof pkg.engines?.node === "string" && pkg.engines.node.includes("22.12"),
    pkg.engines?.node ?? "(無し)",
  );
}

/* ===== 7.43. 文書のトークンが実装と一致するか ====================== */
/**
 * v0.9a の HowToUse には `3xs` と書いてありました。**実在しません**
 * （実体は `none`）。文書が実装と食い違うと、初心者は「書いたのに効かない」を
 * 踏みます。**エラーにならないので、いちばん切り分けにくい種類です。**
 */
{
  const css = fs.readFileSync(
    path.join(work, "my-site", "src", "styles", "tokens.css"),
    "utf8",
  );
  const real = new Set([...css.matchAll(/--space-([a-z0-9]+):/g)].map((m) => m[1]));
  const md = fs.readFileSync(path.join(work, "my-site", "HowToUse.md"), "utf8");
  const line = md.split(/\r?\n/).find((l) => l.startsWith("小さいほうから")) ?? "";
  const documented = [...line.matchAll(/`([a-z0-9]+)`/g)].map((m) => m[1]);
  const unknown = documented.filter((t) => !real.has(t));
  must(
    "7.43 HowToUse の余白トークンが実装と一致する",
    documented.length > 0 && unknown.length === 0,
    unknown.length ? `実装に無い: ${unknown.join(", ")}` : `${documented.length} 個`,
  );
}

/* ===== 7.45. package.json の scripts が実在するファイルを指すか ==== */
/**
 * `npm run check` は `scripts/check-responsive.mjs` を指していましたが、
 * 実体は `src/scripts/` にありました。**打った人が最初に踏みます。**
 * ビルドも型検査も通るので、既存の検査は全部緑のままでした。
 */
for (const { name, kind } of CASES) {
  const pkg = JSON.parse(fs.readFileSync(path.join(work, name, "package.json"), "utf8"));
  const missing = [];
  for (const cmd of Object.values(pkg.scripts ?? {})) {
    // `node <path>` の形だけ見ます。astro / vite のような実行ファイル名は対象外です。
    for (const m of String(cmd).matchAll(/node\s+([\w./-]+\.mjs)/g)) {
      if (!fs.existsSync(path.join(work, name, m[1]))) missing.push(m[1]);
    }
  }
  must(`7.45 ${kind}: scripts が実在するファイルを指す`, missing.length === 0, missing.join(", "));
}

/* ===== 7.6. README が存在しない部品を教えていないか =============== */
/**
 * v0.8b で足場のコードから `<Button action={…}>` を直しましたが、
 * **README の例が取り残されていました。** 初心者が最初にコピーする行が
 * それでした（`Button` は実在しますが `action` を受け取りません。
 * `action` を渡せるのは `ActionButton` です）。
 *
 * **この検査は名前の存在しか見ません。** つまり上の間違いは捕まえられません。
 * 捕まえられるのは「部品を消した / 改名したのに README が残っている」場合だけです。
 *
 * props まで見るには README のコード例を型検査に掛ける必要がありますが、
 * 例には `…` のような省略が入っていて、そのままではコンパイルできません。
 * **できないことを、できるつもりで書かない**ために、ここに限界を残します。
 */
{
  /* 名前は**ファイル名からではなく export から**取ります。
     1 つのファイルが複数の部品を出すことがあるからです
     （`layout.tsx` は Stack / Inline / Columns … を全部持っています）。
     ファイル名から導く実装では `Stack` を「知らない部品」と誤判定しました。 */
  const known = new Set();
  for (const f of JSON.parse(
    fs.readFileSync(path.join(root, "registry.json"), "utf8"),
  ).items.flatMap((i) => i.files ?? [])) {
    if (!/\.tsx?$/.test(f.path)) continue;
    const src = fs.readFileSync(path.join(root, f.path), "utf8");
    for (const m of src.matchAll(/export\s+(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g)) {
      known.add(m[1]);
    }
  }
  const readme = fs.readFileSync(path.join(work, "my-site", "README.md"), "utf8");
  const used = [...readme.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]);
  const unknown = [...new Set(used)].filter((n) => !known.has(n));
  must(
    "7.6 README の例が、実在する名前だけを使っている（props は見ません）",
    unknown.length === 0,
    unknown.join(", "),
  );
}

/* ===== 8〜12. 生成物が本当に動くか（--full のときだけ） ========= */
if (!FULL) {
  log("install / build / 実ブラウザ の検査は --full を付けたときだけ走ります");
  log("（pnpm verify:create で実行されます）");
} else {
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
      log("レジストリを配れませんでした。「部品を足せる」の判定は飛ばします");
      stopTree(registryServer);
      registryServer = null;
      registryPort = 0;
    }
  } else {
    // 黙って飛ばすと「確かめたつもり」になります。理由を必ず出します。
    log("public/r がありません。先に `pnpm registry:build` を走らせてください");
    log("（「部品を足せる」の判定は飛ばします）");
  }

  for (const { name, kind, port } of CASES) {
    // build は `npm run build`（利用者が打つ形）。型検査は npm exec で直に。
    const buildArgs = ["run", "build"];
    const checkArgs =
      kind === "vite"
        ? ["exec", "--", "tsc", "--noEmit"]
        : ["exec", "--", "astro", "check"];
    const dir = path.join(work, name);
    log(`${kind}: npm install …`);
    // 利用者が打つのと同じ 1 行。--ignore-workspace のような
    // こちら側の都合は入れません。
    const i = run(dir, ["install"]);
    must(`8. ${kind}: npm install が通る`, i.ok, i.out ?? "");
    if (!i.ok) continue;

    /* --- 8.2. 配っている依存に、既知の脆弱性が無いか ----------------
       **これが無いと、古いまま配り続けます。**
       v0.9a の時点で astro が 2 メジャー遅れ、XSS / SSRF の勧告 8 件を
       抱えたまま生成物に入っていました。利用者が `npm install` した
       瞬間に警告が出ますが、**こちらは何も知らないままです。**
       版を固定するなら、追随する仕組みと対で持つ必要があります。 */
    {
      const a = run(dir, ["audit", "--audit-level", "high", "--omit", "dev"]);
      if (a.ok) {
        must(`8.2 ${kind}: 配る依存に high 以上の脆弱性が無い`, true);
      } else if (/ENOTFOUND|ECONNREFUSED|fetch failed|ENETUNREACH|EAI_AGAIN/i.test(a.out ?? "")) {
        // 黙って通すと「調べたつもり」になります。理由を出して飛ばします。
        log(`${kind}: 脆弱性の照会に行けませんでした。この判定は飛ばします`);
      } else {
        must(`8.2 ${kind}: 配る依存に high 以上の脆弱性が無い`, false, a.out ?? "");
      }
    }

    /* --- 8.5. 生成物に、本物の CLI で部品を足せるか -----------------
       **これがいちばん強い判定です。** 「生成できた」「ビルドが通る」まで
       全部緑でも、利用者が README のとおりに部品を足そうとした瞬間に
       詰まる状態がありえます（v0.9a で実際にそうでした）。
       上の 7.5 は設定の形を見るだけなので、**通ることは確かめられません。**

       レジストリは手元の public/ を配って使います。公開先が生きているかに
       この判定を依存させないためです。 */
    if (registryPort) {
      const cj = JSON.parse(fs.readFileSync(path.join(dir, "components.json"), "utf8"));
      cj.registries["@nasu"] = `http://127.0.0.1:${registryPort}/r/{name}.json`;
      fs.writeFileSync(path.join(dir, "components.json"), JSON.stringify(cj, null, 2));

      // 最初から入っていない部品を選びます。入っているものだと、
      // 「足せた」のか「元からあった」のか区別できません。
      /* `--overwrite` を付けます。生成物には action.ts などが既にあるので、
         CLI が 1 つずつ「上書きしますか？」と**対話で**聞いてきます。
         `--yes` はこの確認を覆いません。非対話で走らせると、
         **終了コード 0 のまま何も書かずに終わります**（v0.9a で踏みました）。

         利用者は N（既定）のままで構いません。自分が書き換えたコードを
         守るための確認です。ここは使い捨ての作業ディレクトリなので上書きします。 */
      const before = fs.existsSync(path.join(dir, "src/components/ui/data-table.tsx"));
      const a = shadcn(dir, ["add", "@nasu/data-table", "--yes", "--overwrite"]);
      const after = fs.existsSync(path.join(dir, "src/components/ui/data-table.tsx"));
      must(`8.5 ${kind}: 本物の CLI で部品を足せる`, a.ok && !before && after,
        a.ok ? `before=${before} after=${after}` : (a.out ?? ""));
    } else {
      log(`${kind}: レジストリを配れていないので「部品を足せる」は飛ばします`);
    }

    const t = run(dir, checkArgs);
    must(`9. ${kind}: 型検査が通る`, t.ok, t.out ?? "");

    const b = run(dir, buildArgs);
    must(`10. ${kind}: ビルドが通る`, b.ok, b.out ?? "");
    if (!b.ok) continue;

    /* 配信は **自分で立てた素の静的サーバ**でやります。
       ----------------------------------------------------------------
       astro 7 の `astro preview` はデーモンです。自分を子として起動し直し、
       親はすぐ終了し、ポートが埋まっていると**黙って別の番号へ逃げます。**
       こちらが握る PID は既に死んでいるので止められず、残骸が次の実行で
       「消えたディレクトリを配るサーバ」として判定に当たります。

       見たいのは「ビルドした中身が正しく出るか」なので、静的な出力を
       自分で配れば足ります（理由は scripts/_static.mjs）。
       代わりに、利用者が打つ `npm run preview` 自体は検査しません。 */
    const dist = path.join(dir, "dist");
    const server = spawn(
      process.execPath,
      [path.join(root, "scripts/serve-static.mjs"), dist, String(port),
        ...(kind === "vite" ? ["--spa"] : [])],
      { cwd: root, stdio: "ignore", detached: process.platform !== "win32" },
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
      /* **入口だけ見ても足りません。** ブログ付きの雛型は 6 ページあり、
         崩れるのはたいてい記事や表のあるページです。 */
      const urls = PAGES[kind].map((u) => `http://127.0.0.1:${port}${u}`);
      const report = await checkUrls(urls);
      const { text, problems } = formatReport(report);
      const img = formatImageReport(await checkImageSizing(urls));
      must(
        `12. ${kind}: 端末幅の検査（${urls.length} ページ × 5 幅）を通る`,
        problems === 0,
        problems ? text : "",
      );
      must(`    ${kind}: 画像が場所を取っている`, img.problems === 0, img.problems ? img.text : "");

      /* --- 13. 広い画面で、本文と見出しの幅が揃っているか ------------
         **狭い側だけ見ていると気づけません。** 端末幅の検査は 1024px までしか
         見ないので、器を広くして中の本文にだけ max-w-* を付けた画面は
         全部緑のまま通ります。実際そうなっていました
         （1920px で器の右端 1465px に対し、本文の右端は 947px。
         右に 500px の空白が残り、見出しだけ長い、ちぐはぐな画面）。 */
      const { chromium } = await import("playwright");
      const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
      try {
        const pg = await b.newPage({ viewport: { width: 1920, height: 1000 } });
        await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
        const m = await pg.evaluate(() => {
          const box = (s) => {
            const el = document.querySelector(s);
            return el ? el.getBoundingClientRect() : null;
          };
          const main = box("main");
          const h = box("main h1");
          // 本文の中でいちばん右まで伸びているものを取ります。
          let widest = 0;
          for (const el of document.querySelectorAll("main p, main li")) {
            const r = el.getBoundingClientRect();
            if ((el.textContent || "").trim().length > 20) widest = Math.max(widest, r.right);
          }
          return { main: main?.right ?? 0, h1: h?.right ?? 0, text: widest, mainW: main?.width ?? 0 };
        });
        /* 見出しと本文の右端のずれが、器の幅の 25% を超えたら指摘します。
           少しのずれ（末尾の折り返し）は当然あるので、そこは通します。 */
        const gap = Math.abs(m.h1 - m.text);
        must(
          `13. ${kind}: 広い画面で見出しと本文の幅が揃っている`,
          m.mainW > 0 && gap <= m.mainW * 0.25,
          `器=${Math.round(m.mainW)}px 見出しの右端=${Math.round(m.h1)} 本文の右端=${Math.round(m.text)} ずれ=${Math.round(gap)}`,
        );
      } finally {
        await b.close();
      }
    }

    stopTree(server);
  }

  stopTree(registryServer);
}

/* ================================================================ */

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

const failed = checks.filter((c) => !c.ok);
console.log("");
console.log(
  failed.length === 0
    ? `✅ 判定 ${checks.length} 件すべて成功`
    : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
);
for (const f of failed) console.log(`   ✗ ${f.label}  ${f.detail}`);
process.exit(failed.length ? 1 : 0);
