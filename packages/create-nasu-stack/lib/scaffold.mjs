import fs from "node:fs";
import path from "node:path";
import { MIN_NODE, TEMPLATES } from "./config.mjs";
import { howToUse, readme } from "./guidance.mjs";

/** テンプレートを写し、プロジェクト固有の名前と案内を埋めます。 */
export function scaffold(kind, dest, projectName, lang = "en") {
  const src = path.join(TEMPLATES, kind);
  if (!fs.existsSync(src)) {
    throw new Error(lang === "ja"
      ? `テンプレートが見つかりません: ${src}\n` +
        "開発中なら `node scripts/build-create-template.mjs` を先に実行してください"
      : `Template not found: ${src}\n` +
        "During development, run `node scripts/build-create-template.mjs` first");
  }
  fs.cpSync(src, dest, { recursive: true });

  // 名前を埋める対象。バイナリを壊さないよう、拡張子で絞ります。
  const REPLACE_IN = /\.(json|ts|tsx|astro|css|html|md|mjs)$/;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (REPLACE_IN.test(entry.name)) {
        const before = fs.readFileSync(p, "utf8");
        if (before.includes("__PROJECT_NAME__")) {
          fs.writeFileSync(p, before.replaceAll("__PROJECT_NAME__", projectName));
        }
      }
    }
  };
  walk(dest);

  // .gitignore はテンプレートに置けません（npm publish で消えるため）。
  // ここで書き出します。
  /* **`.env` を必ず無視します。**
     このテンプレートはフォームの送信先など環境変数を扱う導線を持っています。
     `git add .` で秘密の値が public リポジトリに入ると、ファイルを消しても
     履歴からは消えません。**鍵の作り直しが必要になります。**
     初めての人ほど `git add .` を打ちます。 */
  fs.writeFileSync(
    path.join(dest, ".gitignore"),
    [
      "node_modules/",
      "dist/",
      ".astro/",
      ".DS_Store",
      "*.local",
      "",
      lang === "ja"
        ? "# 秘密の値。絶対に commit しないでください。"
        : "# Secret values. Never commit these files.",
      ".env",
      ".env.*",
      "!.env.example",
      "",
    ].join("\n"),
  );

  /* 何を置く場所なのかが分かるように、見本を置きます。
     **ファイルがあるだけで置き場所が分かります。** */
  fs.writeFileSync(
    path.join(dest, ".env.example"),
    (lang === "ja"
      ? [
          "# ここに秘密の値を書きます。使うときは .env にコピーしてください。",
          "# .env は git に入りません（.gitignore 済み）。",
          "#",
          "# ⚠️ 名前が PUBLIC_ / VITE_ で始まる値はブラウザに配られます。",
          "#    誰でも見られるので、鍵やパスワードを置かないでください。",
          "#    秘密の値はサーバ側（送信先の Worker など）に置きます。",
          "",
          "# 例: フォームの送信先",
          "# PUBLIC_CONTACT_ENDPOINT=https://example.workers.dev/contact",
          "",
        ]
      : [
          "# Put secret values here. Copy this file to .env before using it.",
          "# .env is already excluded from git by .gitignore.",
          "#",
          "# ⚠️ Values whose names start with PUBLIC_ or VITE_ are sent to the browser.",
          "#    Anyone can read them, so never put keys or passwords there.",
          "#    Keep secrets on the server, such as in the receiving Worker.",
          "",
          "# Example: contact form receiver",
          "# PUBLIC_CONTACT_ENDPOINT=https://example.workers.dev/contact",
          "",
        ]).join("\n"),
  );

  // nvm などが読む、この雛型が想定している Node の版。
  fs.writeFileSync(path.join(dest, ".nvmrc"), `${MIN_NODE}\n`);

  fs.writeFileSync(path.join(dest, "README.md"), readme(kind, projectName, lang));
  /* 手順は**ファイルに残します。**
     生成の直後に画面へ出しても、次のコマンドを打った時点で流れて消えます。
     「さっき何て書いてあったっけ」を、スクロールを遡って探すことになります。 */
  fs.writeFileSync(path.join(dest, "HowToUse.md"), howToUse(kind, projectName, lang));
  return true;
}

/**
 * 余白の段階の名前。
 *
 * **手で書き写しません。** 一緒に配る tokens.css から読みます。
 * v0.9a では `3xs` と書きましたが、実在するのは `none` でした。
 * 文書が実装と食い違うと、初心者は「書いたのに効かない」を踏みます。
 * **エラーにならないので、いちばん切り分けにくい種類です。**
 */
