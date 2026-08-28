import fs from "node:fs";
import path from "node:path";

export async function verifyGuidance({ root, work, CLI, CASES, create, must }) {
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

  {
    const en = fs.readFileSync(path.join(work, "my-site", "HowToUse.md"), "utf8");
    const enReadme = fs.readFileSync(path.join(work, "my-site", "README.md"), "utf8");
    const ja = fs.readFileSync(path.join(work, "my-site-ja", "HowToUse.md"), "utf8");
    const jaReadme = fs.readFileSync(path.join(work, "my-site-ja", "README.md"), "utf8");
    must(
      "7.41 --lang に合わせて README / HowToUse を生成する",
      en.includes("How to use my-site") && enReadme.includes("Built with Nasu Stack") &&
        ja.includes("my-site-ja の使い方") && jaReadme.includes("Nasu Stack から作りました"),
    );
    must(
      "     コマンドを実行する場所が両言語の案内にある",
      en.includes("project root directory") && en.includes("contains `package.json`") &&
        ja.includes("プロジェクトのルートディレクトリ") && ja.includes("`package.json` がある場所"),
    );
  }

  /* ===== 7.415. 対話が 言語 → 始め方 → 種類 の順か ================ */
  {
    const { chooseLanguage, chooseInteractiveKind } = await import(
      new URL(`file://${CLI}`).href
    );
    const fakeReadline = (answers) => ({
      question: async () => answers.shift() ?? "",
    });

    const languageLines = [];
    const lang = await chooseLanguage(fakeReadline(["2"]), (line) => languageLines.push(line));
    must(
      "7.415 最初の選択肢で English / 日本語を選べる",
      lang === "ja" && languageLines.some((line) => line.includes("Language / 言語")) &&
        languageLines.some((line) => line.includes("English: ")) &&
        languageLines.some((line) => line.includes("日本語: ")),
    );

    const enLines = [];
    const enKind = await chooseInteractiveKind(
      fakeReadline(["1", "2"]),
      "en",
      (line) => enLines.push(line),
    );
    must(
      "     英語では From scratch → Astro / Vite の順に選べる",
      enKind === "vite" &&
        enLines.findIndex((line) => line.includes("From scratch: ")) <
          enLines.findIndex((line) => line.includes("Website (Astro): ")) &&
        enLines.every((line) => !/^\s+\d+\./.test(line) || line.includes(": ")),
    );

    const jaLines = [];
    const jaKind = await chooseInteractiveKind(
      fakeReadline(["2", ""]),
      "ja",
      (line) => jaLines.push(line),
    );
    must(
      "     日本語では 雛型を使う → ブログ の順に選べる",
      jaKind === "blog" &&
        jaLines.findIndex((line) => line.includes("雛型を使う: ")) <
          jaLines.findIndex((line) => line.includes("ブログ・複数ページのサイト（Astro）: ")) &&
        jaLines.every((line) => !/^\s+\d+\./.test(line) || line.includes(": ")),
    );
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
    const line = md
      .split(/\r?\n/)
      .find((l) => l.startsWith("From smallest to largest:")) ?? "";
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

  /* ===== 7.47. 知らない指定 ======================================== */
  /**
   * `--templat vite` のような打ち間違いを黙って無視すると、
   * 何も言われないまま既定（astro）で作られます。
   * **気づくのは、できたものを開いて「思っていたのと違う」と感じたとき**です。
   */
  {
    const r = create("typo-site", ["--templat", "blog"]);
    must(
      "7.47 知らない指定を黙って無視しない",
      !r.ok && /Unknown option|知らない指定/.test(r.out ?? ""),
      (r.out ?? "").trim().slice(-80),
    );
    must(
      "     そのときは何も作らない",
      !fs.existsSync(path.join(work, "typo-site")),
    );
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


}
