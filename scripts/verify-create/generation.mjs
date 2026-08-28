import fs from "node:fs";
import path from "node:path";
import { buildCreateTemplate } from "../build-create-template.mjs";

export async function verifyGeneration({ root, work, CASES, create, must }) {
  /* ===== 0. テンプレートが原本と同期しているか ==================== */
  {
    // 生成し直して差分が無いことを見ます。
    // テンプレートは commit していないので、ずれるとしたら
    // 「生成し忘れ」だけです。それを機械で捕まえます。
    buildCreateTemplate();
    const tpl = path.join(root, "packages", "create-nasu-stack", "template");
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
      "package-lock.json",
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
        path.join(root, "packages/create-nasu-stack/scaffold/blog/src/content/blog"),
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

    const r4 = create("my-site-ja", ["--template", "astro", "--lang", "ja"]);
    must("2.6 日本語の案内を指定して生成できる", r4.ok, r4.out.trim().slice(-120));
  }


}
