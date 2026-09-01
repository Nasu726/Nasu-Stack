/**
 * create-nasu-stack のテンプレートを組み立てます。
 *
 *   node scripts/build-create-template.mjs
 *
 * ----------------------------------------------------------------
 * なぜ生成物にするのか
 * ----------------------------------------------------------------
 * テンプレートに部品をコピーして commit すると、
 * **同じファイルが registry/nasu と 2 か所に存在します。**
 *
 * このリポジトリは「同じ値が 2 か所にある」で何度も壊れました。
 * ヘッダの高さ、タブの一覧、下書きの除外、入力欄の class——
 * 全部そこが原因です。
 *
 * だからテンプレートは**必ずここで生成し、リポジトリには置きません**
 * （.gitignore 済み）。手で編集する余地が無ければ、ずれようがありません。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_URL } from "./_site.mjs";
import { writeSnippets } from "./build-snippets.mjs";
import { localDep } from "./_deps.mjs";
import { acquireWorkspaceLockSync } from "./_workspace-lock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "apps", "site");
const repositoryPulse = path.join(root, "apps", "dogfood-repository-pulse");
const pkg = path.join(root, "packages", "create-nasu-stack");
const out = path.join(pkg, "template");

const registry = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
);

/**
 * 最初から入れておく部品。
 *
 * **全部入れません。** 使わない部品が並んでいると、
 * 「これは何？」から始まってしまいます。依存は自動で辿ります。
 */
const STARTER = {
  common: [
    "tokens",
    "theme",
    "prose",
    "utils",
    "action",
    "layout",
    "site-nav",
    "site-footer",
    "frame",
    "check-responsive",
  ],
  astro: ["seo", "feed", "submit", "honeypot-field", "async-form", "form-fields"],
  /* ブログ付きの雛型。**astro の足場に、apps/site の中身を載せます。**
     apps/site が使っている部品をそのまま並べています
     （依存は resolve が辿るので、直接 import しているものだけ）。 */
  blog: [
    "seo",
    "feed",
    "submit",
    "honeypot-field",
    "async-form",
    "data-list",
    "disclosure",
    "theme-provider",
  ],
  "repository-pulse": [
    "theme-provider",
    "action-provider",
    "action-button",
    "async-form",
    "form-fields",
    "async-boundary",
    "use-action",
    "use-resource",
    "toast",
    "dialog",
    "tabs",
    "disclosure",
    "submit",
    "honeypot-field",
    "search-list",
    "data-table",
    "load-more-list",
    "copy-button",
    "error-boundary",
  ],
  vite: [
    "theme-provider",
    "action-provider",
    "action-button",
    "async-form",
    "form-fields",
    "async-boundary",
    "use-action",
    "use-resource",
    "toast",
    "dialog",
    "tabs",
    "disclosure",
    "submit",
    "honeypot-field",
  ],
};

const byName = new Map(registry.items.map((i) => [i.name, i]));

/** 依存を辿って、必要なアイテムを全部集めます。 */
function resolve(names, seen = new Set()) {
  for (const name of names) {
    if (seen.has(name)) continue;
    const item = byName.get(name);
    if (!item) throw new Error(`registry.json に ${name} がありません`);
    seen.add(name);
    resolve(
      (item.registryDependencies ?? []).map(localDep).filter(Boolean),
      seen,
    );
  }
  return seen;
}

function copyItems(names, destSrc) {
  const items = resolve(names);
  let count = 0;
  for (const name of items) {
    for (const file of byName.get(name).files ?? []) {
      const from = path.join(root, file.path);
      // target は "components/ui/x.tsx" のような相対パス。src/ の下へ置きます。
      const to = path.join(destSrc, file.target);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return { items: items.size, files: count, resolved: items };
}

/** dogfoodで検査したcopy-owned sourceを上書きせず、必要なitemが揃うことだけ確かめます。 */
function inspectCopiedItems(names, destSrc) {
  const items = resolve(names);
  const files = new Set();
  const missing = [];
  for (const name of items) {
    for (const file of byName.get(name).files ?? []) {
      files.add(file.target);
      if (!fs.existsSync(path.join(destSrc, file.target))) {
        missing.push(`${name}:${file.target}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Repository Pulseのcopy-owned sourceが不足しています: ${missing.join(", ")}`);
  }
  return { items: items.size, files: files.size, resolved: items };
}

/** 足場（設定ファイルなど）をそのまま写します。 */
function copyScaffold(kind, dest) {
  const from = path.join(pkg, "scaffold", kind);
  fs.cpSync(from, dest, { recursive: true });
}

/**
 * ブログ付きの雛型の中身を `apps/site` から写します。
 *
 * ----------------------------------------------------------------
 * なぜ手でコピーして commit しないのか
 * ----------------------------------------------------------------
 * ページ・レイアウト・記事の読み込みは、**公開しているデモと同じもの**です。
 * 2 か所に置くと必ずずれます。しかもずれても誰も気づきません
 * （デモは直したが雛型は古いまま、が静かに起きます）。
 *
 * だから写す元は `apps/site` の 1 つに保ち、ここで生成します。
 *
 * ----------------------------------------------------------------
 * 写さないもの
 * ----------------------------------------------------------------
 *   src/styles/     … `@import` が `../../../../registry/nasu` を指しています。
 *                     生成物では `./tokens.css` なので、足場のほうを使います
 *   src/site.config … 足場のほうは `__PROJECT_NAME__` が入ります
 *   記事（*.md）    … 「この記事は検査用です」と自己申告する文面なので、
 *                     利用者のブログに配ってはいけません。
 *                     scaffold/blog の記事で上書きします
 *   *.config.mjs 等 … 足場のほうが正しい（`@` の指す先が違います）
 */
function copyFromSite(dest) {
  const src = path.join(site, "src");
  const destSrc = path.join(dest, "src");

  for (const d of ["pages", "layouts", "lib", "components", "assets"]) {
    fs.cpSync(path.join(src, d), path.join(destSrc, d), { recursive: true });
  }
  fs.copyFileSync(
    path.join(src, "content.config.ts"),
    path.join(destSrc, "content.config.ts"),
  );

  /* 記事のうち **.md 以外だけ**（本文から相対パスで参照している画像）。
     本文は scaffold/blog のものを使います。 */
  const from = path.join(src, "content", "blog");
  const to = path.join(destSrc, "content", "blog");
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (f.endsWith(".md")) continue;
    fs.copyFileSync(path.join(from, f), path.join(to, f));
  }

  fs.cpSync(path.join(site, "public"), path.join(dest, "public"), {
    recursive: true,
  });
}

/**
 * 検証済みのRepository Pulseを、そのまま利用者向け雛型の原本にします。
 *
 * copy-owned sourceをregistryから組み直すと、dogfoodで実際に検査したものと
 * 配るものが別になります。逆にapp全体を手で別directoryへ複製すると、次の修正で
 * 必ず片方だけ古くなります。そこでruntime source、lockfile、固定fixture、言語別案内を
 * `apps/dogfood-repository-pulse`からbuild時に写し、生成物だけをpackします。
 */
function copyRepositoryPulse(dest) {
  const excluded = new Set(["node_modules", "dist", ".gitignore", "DOGFOOD.md"]);
  fs.cpSync(repositoryPulse, dest, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(repositoryPulse, source);
      if (!relative) return true;
      return !relative.split(path.sep).some((segment) => excluded.has(segment));
    },
  });

  const packagePath = path.join(dest, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.name = "__PROJECT_NAME__";
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  /* npm lockfileのroot nameもproject名と揃えます。依存木には触れません。 */
  const lockPath = path.join(dest, "package-lock.json");
  const lock = fs.readFileSync(lockPath, "utf8").replaceAll(
    "dogfood-repository-pulse",
    "__PROJECT_NAME__",
  );
  fs.writeFileSync(lockPath, lock, "utf8");

  /* READMEの先頭だけは生成先の名前にします。製品名としてのRepository Pulseは残します。 */
  for (const file of ["README.md", "README.ja.md"]) {
    const target = path.join(dest, file);
    const source = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, source.replace(/^# Repository Pulse$/m, "# __PROJECT_NAME__"), "utf8");
  }
}

/**
 * 検証済みの道具の版を、生成物に書き残します。
 *
 * ----------------------------------------------------------------
 * なぜ `@latest` を案内しないのか
 * ----------------------------------------------------------------
 * 生成物の HowToUse は最新版をそのまま実行する形で書いていました。
 * 一方こちらの検査は、**わざと latest を避けて**リポジトリに固定した版を
 * 使っています（lockfile と minimumReleaseAge を素通りするため）。
 *
 * **検査側が避けている危険を、利用者にそのまま渡していました。**
 * こちらが確かめた版を、そのまま利用者にも使ってもらいます。
 *
 * 版は package.json の devDependencies から取ります。**書き写しません。**
 */
function testedShadcnVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return (pkg.devDependencies?.shadcn ?? "").replace(/^[\^~]/, "");
}

/**
 * shadcn CLI の設定を置きます。
 *
 * ----------------------------------------------------------------
 * なぜ最初から入れるのか
 * ----------------------------------------------------------------
 * 生成した README は「部品が足りなくなったら足す」と書いています。
 * **v0.9a まで、その手段がありませんでした。**
 *
 * `components.json` が無いと shadcn CLI は
 * 「作りますか？」と対話で聞いてきます。作らせても `registries` が
 * 入らないので、次は `Unknown registry "@nasu"` で止まります。
 * つまり案内どおりに進んだ人が、**2 回続けて詰まります。**
 *
 * 実際に生成物を触って初めて気づきました。部品側の検査は全部緑でした。
 *
 * ----------------------------------------------------------------
 * 中身
 * ----------------------------------------------------------------
 * `registries` の宣言が要です。`@nasu/action` のような名前空間は、
 * これが無いと解決できません。URL は scripts/_site.mjs が唯一の定義です。
 */
function writeComponentsJson(kind, dest) {
  const config = {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    // Astro でも React の島として動かすので、どちらも RSC ではありません。
    rsc: false,
    tsx: true,
    registries: { "@nasu": REGISTRY_URL },
    tailwind: {
      config: "",
      // 足場の CSS の入口。tokens / themes / prose をここから読んでいます。
      css: kind === "astro" || kind === "blog"
        ? "src/styles/global.css"
        : "src/index.css",
      baseColor: "neutral",
      // 色はトンマナ側（tokens.css）が持ちます。shadcn には触らせません。
      cssVariables: true,
    },
    // 足場の tsconfig が "@/*" → "src/*" にしてあります。合わせます。
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    iconLibrary: "lucide",
  };
  fs.writeFileSync(
    path.join(dest, "components.json"),
    JSON.stringify(config, null, 2) + "\n",
    "utf8",
  );
}

/** 呼び出し側がcreate-template lockを保持してから実行します。 */
export function buildCreateTemplate() {
  fs.rmSync(out, { recursive: true, force: true });

  const report = [];
  for (const kind of ["astro", "blog", "repository-pulse", "vite"]) {
    const dest = path.join(out, kind);
    fs.mkdirSync(dest, { recursive: true });
    if (kind === "blog") {
      /* 足場は astro と同じ → apps/site の中身 → ブログ固有の上書き、の順。
         **package-lock.json は astro のものが残ります。** blog の依存は
         astro と同じで、違うのは scripts だけだからです。ずれたら
         verify-create の判定（同梱の lock で install が通るか）が落ちます。 */
      copyScaffold("astro", dest);
      copyFromSite(dest);
      copyScaffold("blog", dest);
    } else if (kind === "repository-pulse") {
      copyRepositoryPulse(dest);
    } else {
      copyScaffold(kind, dest);
    }
    writeComponentsJson(kind, dest);
    /* 生成物の package.json に、検証済みの版を残します。
       利用者が「何で試された構成なのか」を後から見られます。 */
    {
      const p = path.join(dest, "package.json");
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      pkg.nasuStack = { shadcn: testedShadcnVersion() };
      fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    }
    const included = [...STARTER.common, ...STARTER[kind]];
    const r = kind === "repository-pulse"
      ? inspectCopiedItems(included, path.join(dest, "src"))
      : copyItems(included, path.join(dest, "src"));

    /* エディタの補完。**入っている部品の分だけ**出します。
       入っていない部品を補完に出すと、選んだ瞬間に「そんなものは無い」に
       なります。原本の型から作るので、手で直す場所はありません。 */
    const snips = writeSnippets(
      [...r.resolved].map((n) => byName.get(n)),
      root,
      dest,
    );
    report.push({ kind, ...r, snippets: snips });
  }

  // 生成物であることを、開いた人にも分かるようにしておきます
  fs.writeFileSync(
    path.join(out, "README.md"),
    [
      "# 生成物です",
      "",
      "このディレクトリは `scripts/build-create-template.mjs` が作ります。",
      "**手で編集しないでください。**原本は `registry/nasu` です。",
      "",
    ].join("\n"),
  );

  for (const r of report) {
    console.log(
      `  ${r.kind}: ${r.items} アイテム / ${r.files} ファイル / 補完 ${r.snippets} 個`,
    );
  }
  console.log(`✅ テンプレートを生成しました: ${path.relative(root, out)}`);
  return report;
}

/* importしただけでは生成しません。CLIとして呼んだときだけlockを取ります。 */
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const release = acquireWorkspaceLockSync("create-template", { root });
  try {
    buildCreateTemplate();
  } finally {
    release();
  }
}
