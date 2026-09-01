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

    const pulseSource = fs.readFileSync(
      path.join(root, "apps/dogfood-repository-pulse/src/App.tsx"),
      "utf8",
    );
    const pulseTemplate = fs.readFileSync(
      path.join(tpl, "repository-pulse/src/App.tsx"),
      "utf8",
    );
    must(
      "   Repository Pulseは検査済みdogfood appを単一原本にする",
      pulseSource === pulseTemplate,
    );

    const weatherSource = fs.readFileSync(
      path.join(root, "apps/dogfood-weather-planner/src/App.tsx"),
      "utf8",
    );
    const weatherTemplate = fs.readFileSync(
      path.join(tpl, "weather-planner/src/App.tsx"),
      "utf8",
    );
    must(
      "   Weather Plannerは検査済みdogfood appを単一原本にする",
      weatherSource === weatherTemplate,
    );
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

    const pulse = create("my-pulse", ["--template", "repository-pulse", "--lang", "en"]);
    must("2.2 Repository Pulse雛型を生成できる", pulse.ok, pulse.out.trim().slice(-160));
    const pulseWant = [
      ".env.example",
      "package-lock.json",
      "README.md",
      "HowToUse.md",
      path.join("scripts", "fixture-api.mjs"),
      path.join("scripts", "verify.mjs"),
      path.join("src", "App.tsx"),
      path.join("src", "lib", "config.ts"),
      path.join("src", "lib", "github.ts"),
      path.join("src", "components", "recipes", "search-list.tsx"),
      path.join("src", "components", "ui", "load-more-list.tsx"),
    ];
    const pulseFiles = fs
      .readdirSync(path.join(work, "my-pulse"), { recursive: true })
      .map(String);
    const pulseMissing = pulseWant.filter((file) => !pulseFiles.includes(file));
    must(
      "    Repository Pulse: app・公開設定・固定fixtureが揃っている",
      pulseMissing.length === 0,
      pulseMissing.join(", ") || `${pulseFiles.length} ファイル`,
    );
    const pulsePackage = JSON.parse(
      fs.readFileSync(path.join(work, "my-pulse", "package.json"), "utf8"),
    );
    const pulseLock = JSON.parse(
      fs.readFileSync(path.join(work, "my-pulse", "package-lock.json"), "utf8"),
    );
    must(
      "    Repository Pulse: project名がpackageとlockfileへ反映される",
      pulsePackage.name === "my-pulse" && pulseLock.name === "my-pulse" &&
        pulseLock.packages?.[""]?.name === "my-pulse",
    );
    const pulseReadme = fs.readFileSync(path.join(work, "my-pulse", "README.md"), "utf8");
    must(
      "    Repository Pulse: 選ばなかった言語の存在しないREADMEへlinkしない",
      !pulseReadme.includes("README.ja.md") &&
        !fs.existsSync(path.join(work, "my-pulse", "README.ja.md")),
    );

    const weather = create("my-weather", [
      "--template", "weather-planner", "--lang", "en",
    ]);
    must("2.3 Weather Planner雛型を生成できる", weather.ok, weather.out.trim().slice(-160));
    const weatherWant = [
      ".env.example",
      "package-lock.json",
      "README.md",
      "HowToUse.md",
      path.join("scripts", "fixture-api.mjs"),
      path.join("scripts", "verify.mjs"),
      path.join("src", "App.tsx"),
      path.join("src", "lib", "config.ts"),
      path.join("src", "lib", "weather.ts"),
      path.join("src", "lib", "planner.ts"),
      path.join("src", "components", "ui", "async-select.tsx"),
      path.join("src", "hooks", "use-autosave.ts"),
    ];
    const weatherFiles = fs
      .readdirSync(path.join(work, "my-weather"), { recursive: true })
      .map(String);
    const weatherMissing = weatherWant.filter((file) => !weatherFiles.includes(file));
    must(
      "    Weather Planner: app・公開設定・固定fixtureが揃っている",
      weatherMissing.length === 0,
      weatherMissing.join(", ") || `${weatherFiles.length} ファイル`,
    );
    const weatherPackage = JSON.parse(
      fs.readFileSync(path.join(work, "my-weather", "package.json"), "utf8"),
    );
    const weatherLock = JSON.parse(
      fs.readFileSync(path.join(work, "my-weather", "package-lock.json"), "utf8"),
    );
    const weatherReadme = fs.readFileSync(path.join(work, "my-weather", "README.md"), "utf8");
    must(
      "    Weather Planner: project名がpackageとlockfileへ反映される",
      weatherPackage.name === "my-weather" && weatherLock.name === "my-weather" &&
        weatherLock.packages?.[""]?.name === "my-weather",
    );
    must(
      "    Weather Planner: 英語案内だけを残し、存在しない言語fileへlinkしない",
      weatherReadme.startsWith("# my-weather\n") &&
        !weatherReadme.includes("README.ja.md") &&
        !fs.existsSync(path.join(work, "my-weather", "README.ja.md")) &&
        !fs.existsSync(path.join(work, "my-weather", "HowToUse.ja.md")),
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

    const pulseJa = create("my-pulse-ja", [
      "--template", "repository-pulse", "--lang", "ja",
    ]);
    const pulseJaReadme = pulseJa.ok
      ? fs.readFileSync(path.join(work, "my-pulse-ja", "README.md"), "utf8")
      : "";
    const pulseJaGuide = pulseJa.ok
      ? fs.readFileSync(path.join(work, "my-pulse-ja", "HowToUse.md"), "utf8")
      : "";
    const pulseJaEnv = pulseJa.ok
      ? fs.readFileSync(path.join(work, "my-pulse-ja", ".env.example"), "utf8")
      : "";
    must(
      "2.7 Repository Pulseも日本語のREADME・使い方・環境変数案内を生成する",
      pulseJa.ok && pulseJaReadme.includes("完成済み") &&
        pulseJaGuide.includes("Repository Pulseの構成") && pulseJaEnv.includes("誰でも読めます") &&
        !pulseJaReadme.includes("[English](./README.md)"),
      pulseJa.out?.trim().slice(-160) ?? "",
    );

    const weatherJa = create("my-weather-ja", [
      "--template", "weather-planner", "--lang", "ja",
    ]);
    const weatherJaReadme = weatherJa.ok
      ? fs.readFileSync(path.join(work, "my-weather-ja", "README.md"), "utf8")
      : "";
    const weatherJaGuide = weatherJa.ok
      ? fs.readFileSync(path.join(work, "my-weather-ja", "HowToUse.md"), "utf8")
      : "";
    const weatherJaEnv = weatherJa.ok
      ? fs.readFileSync(path.join(work, "my-weather-ja", ".env.example"), "utf8")
      : "";
    must(
      "2.8 Weather Plannerも日本語のREADME・使い方・環境変数案内を生成する",
      weatherJa.ok && weatherJaReadme.startsWith("# my-weather-ja\n") &&
        weatherJaReadme.includes("7日分の天気") &&
        weatherJaGuide.includes("無料APIの境界") &&
        weatherJaEnv.includes("誰でも読めます") &&
        weatherJaReadme.includes("./HowToUse.md") &&
        !weatherJaReadme.includes("HowToUse.ja.md") &&
        !weatherJaReadme.includes("[English](./README.md)"),
      weatherJa.out?.trim().slice(-160) ?? "",
    );
  }


}
