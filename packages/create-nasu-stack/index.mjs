#!/usr/bin/env node
/**
 * create-nasu-stack — 動くところから始める
 * ================================================================
 *
 *   npx https://github.com/Nasu726/Nasu-Stack/releases/download/v1.0.0/create-nasu-stack-1.0.0.tgz my-site
 *   npx https://github.com/Nasu726/Nasu-Stack/releases/download/v1.0.0/create-nasu-stack-1.0.0.tgz my-site --lang en --template astro --yes
 *
 * 部品をいくら揃えても、**始められなければ届きません。**
 * ここが「誰でも簡単に作れる」への最後の一段です。
 *
 * ----------------------------------------------------------------
 * 短い形は、どこにも書きません
 * ----------------------------------------------------------------
 * npm には publish していないので、`create-nasu-stack` という名前は
 * **空いています。**
 * 第三者が取れば、その名前を打った人には他人のコードが動きます。
 * **とくにまずいのは、エラー時に CLI 自身が危険なコマンドを教えることです。**
 * README が安全でも、詰まった人はエラーメッセージの方を信じます。
 * 機械で見張っています（scripts/check-forbidden.mjs）。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(here, "template");

/**
 * 生成物が要求する Node のバージョン。**ここが唯一の定義です。**
 *
 * astro 7 が `>=22.12.0`、vite 8 が `^20.19.0 || >=22.12.0` を要求します。
 * 両方に通る下限は 22.12.0 です。
 *
 * **CLI だけ動いて、作ったものが動かないのが最悪の形**なので、
 * 生成する前に見ます。生成してから `npm install` で
 * EBADENGINE を見せられても、Web が初めての人には切り分けられません。
 */
export const MIN_NODE = "22.12.0";

const cmp = (a, b) => {
  const pa = String(a).replace(/^v/, "").split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
};

const LANGUAGES = new Set(["en", "ja"]);

const UI = {
  en: {
    banner: "Nasu Stack — Start with a working project",
    projectName: "Project name:",
    missingName: "Specify a project name",
    missingNameHint: "Add the name you want to the end of the command you just ran",
    unknownOption: "Unknown option",
    availableOptions: "Available options: --template <kind> / --lang <en|ja> / --yes / --help",
    kinds: "Kinds",
    unknownTemplate: "Unknown template",
    availableKinds: "Available kinds",
    invalidLanguage: "Unknown language. Use en or ja",
    invalidChoice: (length) => `Please enter a number from 1 to ${length}.`,
    startTitle: "How would you like to start?",
    startQuestion: "Choose a starting point",
    scratchTitle: "What would you like to build?",
    templateTitle: "Choose a template",
    scratchQuestion: "Choose a project type",
    templateQuestion: "Choose a template",
    created: (name, label) => `Created ${name} (${label})`,
    guide: (name) => `The usage guide is in ${name}/HowToUse.md.`,
    guideHint: "It covers what to edit, how to add components, and how to deploy.",
  },
  ja: {
    banner: "Nasu Stack — 動くところから始めます",
    projectName: "プロジェクト名:",
    missingName: "プロジェクト名を指定してください",
    missingNameHint: "さっき打ったコマンドの最後に、作りたい名前を足してください",
    unknownOption: "知らない指定です",
    availableOptions: "使えるのは --template <種類> / --lang <en|ja> / --yes / --help です",
    kinds: "種類",
    unknownTemplate: "知らないテンプレートです",
    availableKinds: "使える種類",
    invalidLanguage: "知らない言語です。en または ja を指定してください",
    invalidChoice: (length) => `1 から ${length} の数字を入力してください。`,
    startTitle: "どのように始めますか？",
    startQuestion: "始め方を選んでください",
    scratchTitle: "何を作りますか？",
    templateTitle: "雛型を選んでください",
    scratchQuestion: "種類を選んでください",
    templateQuestion: "雛型を選んでください",
    created: (name, label) => `${name} を作りました（${label}）`,
    guide: (name) => `使い方は ${name}/HowToUse.md に書きました。`,
    guideHint: "どのファイルを触るか、部品の足し方、公開のしかたまで入っています。",
  },
};

const ui = (lang) => UI[LANGUAGES.has(lang) ? lang : "en"];

/** 足りなければ理由と直し方を出して止めます。 */
export function checkNodeVersion(current = process.version, lang = "en") {
  if (cmp(current, MIN_NODE) >= 0) return null;
  if (lang === "ja") {
    return [
      `Node.js が古いため、作ったものが動きません。`,
      ``,
      `  いま: ${current}`,
      `  必要: v${MIN_NODE} 以上`,
      ``,
      `  https://nodejs.org/ から新しいものを入れてください。`,
      `  nvm を使っているなら: nvm install ${MIN_NODE} && nvm use ${MIN_NODE}`,
    ].join("\n");
  }
  return [
    `Your Node.js version is too old for the generated project.`,
    ``,
    `  Current:  ${current}`,
    `  Required: v${MIN_NODE} or newer`,
    ``,
    `  Install a newer version from https://nodejs.org/.`,
    `  If you use nvm: nvm install ${MIN_NODE} && nvm use ${MIN_NODE}`,
  ].join("\n");
}

/**
 * Windows が特別扱いする名前。**拡張子を付けても同じです**
 * （`con.txt` も作れません）。ここを通すと、生成そのものは通るのに
 * **フォルダが作れない**という分かりにくい失敗になります。
 */
const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const KINDS = [
  {
    key: "astro",
    mode: "scratch",
    label: { en: "Website (Astro)", ja: "サイト（Astro）" },
    hint: {
      en: "One page. Build the rest yourself.",
      ja: "1 ページだけ。自分で組み立てたい人向け。",
    },
  },
  {
    key: "blog",
    mode: "template",
    label: { en: "Blog / multipage site (Astro)", ja: "ブログ・複数ページのサイト（Astro）" },
    hint: {
      en: "Blog, landing page, about, contact, RSS, sitemap, and 404 included.",
      ja: "ブログ・LP・会社概要・問い合わせ・RSS・sitemap・404 入り。",
    },
  },
  {
    key: "vite",
    mode: "scratch",
    label: { en: "App (Vite + React)", ja: "アプリ（Vite + React）" },
    hint: {
      en: "For dashboards, tools, and other highly interactive screens.",
      ja: "管理画面やツールなど、画面内で動く部分が多いもの向け。",
    },
  },
];

const START_MODES = [
  {
    key: "scratch",
    label: { en: "From scratch", ja: "まっさらな状態から" },
    hint: {
      en: "Start small and assemble the project yourself.",
      ja: "最小構成から自分で組み立てます。",
    },
  },
  {
    key: "template",
    label: { en: "Use a template", ja: "雛型を使う" },
    hint: {
      en: "Start with common pages and features already included.",
      ja: "よく使うページと機能が入った状態から始めます。",
    },
  },
];

const LANGUAGE_OPTIONS = [
  { key: "en", label: "English", hint: "Continue in English." },
  { key: "ja", label: "日本語", hint: "日本語で続けます。" },
];

const localized = (items, lang) =>
  items.map((item) => ({
    ...item,
    label: typeof item.label === "string" ? item.label : item.label[lang],
    hint: typeof item.hint === "string" ? item.hint : item.hint[lang],
  }));

const kindLabel = (kind, lang) =>
  KINDS.find((item) => item.key === kind)?.label[lang] ?? kind;

/** Astro の雛型か（Vite でないか）。開発サーバの番号や触る場所が変わります。 */
const isAstro = (kind) => kind !== "vite";

/* ================================================================
 * プロジェクト名の検証
 * ================================================================
 * package.json の `name` として使うので、通らない字があります。
 * **生成してから npm に怒られるより、ここで止めたほうが親切です。**
 * ============================================================== */

export function validateName(name, lang = "en") {
  if (lang === "ja") {
    if (!name || !name.trim()) return "プロジェクト名を入れてください";
    if (name !== name.trim()) return "前後の空白は使えません";
    if (/[A-Z]/.test(name)) return "大文字は使えません（小文字にしてください）";
    if (/\s/.test(name)) return "空白は使えません（- でつないでください）";
    if (name.startsWith(".") || name.startsWith("_")) {
      return ". や _ で始まる名前は使えません";
    }
    if (/[~'!()*/\\]/.test(name)) return "記号 ~ ' ! ( ) * / \\ は使えません";
    if (/[<>:\"|?]/.test(name)) return '記号 < > : \" | ? は使えません（Windows）';
    if (/[\u0000-\u001f]/.test(name)) return "制御文字は使えません";
    if (WINDOWS_RESERVED.has(name.split(".")[0].toLowerCase())) {
      return `${name} は Windows が特別扱いする名前です（フォルダを作れません）`;
    }
    if (name.endsWith(".") || name.endsWith(" ")) {
      return ". や空白で終わる名前は使えません（Windows）";
    }
    if (name.length > 214) return "名前が長すぎます";
    return null;
  }
  if (!name || !name.trim()) return "Enter a project name";
  if (name !== name.trim()) return "A project name cannot start or end with whitespace";
  if (/[A-Z]/.test(name)) return "Use lowercase letters in the project name";
  if (/\s/.test(name)) return "Use hyphens instead of spaces in the project name";
  if (name.startsWith(".") || name.startsWith("_")) {
    return "A project name cannot start with . or _";
  }
  if (/[~'!()*/\\]/.test(name)) return "A project name cannot contain ~ ' ! ( ) * / \\";
  if (/[<>:\"|?]/.test(name)) return 'A project name cannot contain < > : \" | ? on Windows';
  // 制御文字。貼り付けで紛れ込むことがあります
  if (/[\u0000-\u001f]/.test(name)) return "A project name cannot contain control characters";
  if (WINDOWS_RESERVED.has(name.split(".")[0].toLowerCase())) {
    return `${name} is reserved by Windows and cannot be used as a folder name`;
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    return "A project name cannot end with . or whitespace on Windows";
  }
  if (name.length > 214) return "The project name is too long";
  return null;
}

/**
 * 生成先が使えるか調べます。
 *
 * **既存のディレクトリを上書きしてはいけません。** create 系の道具で
 * 一番やってはいけない事故です。空なら使います。
 */
export function checkTarget(dir, lang = "en") {
  if (!fs.existsSync(dir)) return null;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    return lang === "ja" ? `${dir} は既にファイルとして存在します` : `${dir} already exists as a file`;
  }
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return null;
  if (lang === "ja") {
    return `${dir} は空ではありません（${entries.length} 件）。別の名前にするか、中身を移してください`;
  }
  return `${dir} is not empty (${entries.length} items). Choose another name or move its contents`;
}

/** テンプレートを写して、名前だけ差し替えます。 */
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
function spaceTokens(kind) {
  try {
    const css = fs.readFileSync(
      path.join(TEMPLATES, kind, "src", "styles", "tokens.css"),
      "utf8",
    );
    const names = [...css.matchAll(/--space-([a-z0-9]+):/g)].map((m) => m[1]);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

/**
 * 検証済みの shadcn の版。**書き写しません。**
 *
 * `@latest` を案内すると、利用者は「その時点で publish されているもの」を
 * 無条件に実行します。lockfile も待機期間も素通りするので、
 * **こちらの検査が避けている危険を、そのまま渡すことになります。**
 * 生成物の package.json に、確かめた版を書き残してあります。
 */
function shadcnVersion(kind) {
  try {
    const p = path.join(TEMPLATES, kind, "package.json");
    return JSON.parse(fs.readFileSync(p, "utf8")).nasuStack?.shadcn ?? "";
  } catch {
    return "";
  }
}

/**
 * 部品を足すときに使うレジストリの URL。
 *
 * **書き写しません。** 一緒に配る components.json から読みます。
 * 2 か所に書くと、公開先を変えた日に README だけ古い URL を指します。
 * 壊れるのはこちらの手元ではなく、利用者が打った瞬間なので気づけません。
 */
function registryUrl(kind) {
  try {
    const p = path.join(TEMPLATES, kind, "components.json");
    return JSON.parse(fs.readFileSync(p, "utf8")).registries?.["@nasu"] ?? "";
  } catch {
    return "";
  }
}

function readme(kind, name, lang) {
  const dev = isAstro(kind) ? "http://localhost:4321" : "http://localhost:5173";
  if (lang === "en") {
    return `# ${name}

Built with Nasu Stack.

Run these commands from the **project root directory** (the directory that contains
\`package.json\`):

\`\`\`bash
npm install
npm run dev      # ${dev}
\`\`\`

**Next, read [HowToUse.md](./HowToUse.md).** It explains what to edit first,
how to add components, and how to deploy the project.
`;
  }
  return `# ${name}

Nasu Stack から作りました。

次のコマンドは、**プロジェクトのルートディレクトリ**（\`package.json\` がある場所）で
実行してください。

\`\`\`bash
npm install
npm run dev      # ${dev}
\`\`\`

**次に [HowToUse.md](./HowToUse.md) を読んでください。** 何をどの順で触ればいいか、
部品の足し方、公開のしかたまで書いてあります。
`;
}

/**
 * 使い方の全文。**画面に出さず、ファイルに残します。**
 *
 * 生成の直後にターミナルへ出しても、次のコマンドを打った時点で流れて消えます。
 * 「さっき何て書いてあったっけ」をスクロールを遡って探すことになる——
 * 実際にそう指摘されました。
 *
 * 読む相手は「多少プログラミングはできるが、Web は初めて」の人です。
 * **island も SSG も知りません。** 用語ではなく、何が嬉しいのかを書きます。
 */
function howToUseJa(kind, name) {
  const astro = isAstro(kind);
  const dev = astro ? "http://localhost:4321" : "http://localhost:5173";
  const preview = astro ? "http://localhost:4321" : "http://localhost:4173";
  const entry = astro ? "src/pages/index.astro" : "src/App.tsx";
  const catalog = registryUrl(kind).replace("/r/{name}.json", "/");

  return `# ${name} の使い方

このファイルはあなたのものです。読み終わったら消して構いません。

---

## 1. 動かす

以下のコマンドは、生成された**プロジェクトのルートディレクトリ**
（\`package.json\` がある場所）で実行してください。

\`\`\`bash
npm install
npm run dev
\`\`\`

ブラウザで ${dev} を開きます。
**この状態のまま作業します。** ファイルを保存すると画面がすぐ切り替わります。
止めるときは \`Ctrl + C\` です。

### \`package-lock.json\` は必ず commit してください

\`npm install\` すると \`package-lock.json\` ができます。**これを git に入れてください。**

\`package.json\` に書いてあるのは \`^7.2.2\` のような**幅のある指定**です。
入れる日によって中身が変わります。lockfile があると、**次に install した人**
（別のパソコン、CI、半年後の自分）が同じものを手に入れられます。

このテンプレートには、**こちらで検査した時点の lockfile が入っています。**
最初の install は、こちらが確かめたものと同じ木になります。

そのまま使っても、新しくしても構いません。どちらにしても、
**できた lockfile を commit してください。**


---

## 2. どのファイルを触るのか

最初に触るのはこの${astro ? "3" : "2"}つだけです。

| ファイル | 何が変わるか |
|---|---|
${astro ? `| \`src/site.config.ts\` | サイトの名前と説明。ヘッダの表示と、検索結果に出る文がここから作られます |
| \`astro.config.mjs\` の \`site\` | 公開するときのアドレス。まだ決まっていなければ後回しで構いません |
| \`${entry}\` | トップページの中身 |` : `| \`index.html\` の \`<title>\` | ブラウザのタブに出る名前 |
| \`${entry}\` | 画面の中身 |`}

${astro ? `\`src/pages/\` にファイルを足すと、そのままページが増えます。
\`about.astro\` を置けば \`/about/\` で開けます。フォルダを作れば階層にもなります。

` : ``}残りのフォルダの意味です。**最初は触らなくて構いません。**

| 場所 | 中身 |
|---|---|
| \`src/components/ui/\` | 部品。ボタン・フォーム・ヘッダなど |
| \`src/lib/\` | 部品が使う裏方の処理 |
| \`src/styles/\` | 色・余白・書体の設定 |
| \`src/hooks/\` | React で状態を扱う仕組み |
${kind === "blog" ? `
### 入っているページ

英語と日本語で同じ構成のページが入っています。

\`\`\`
/ と /ja/                   トップ
/lp/ と /ja/lp/             サービス紹介（よくある質問つき）
/about/ と /ja/about/       会社概要
/contact/ と /ja/contact/   お問い合わせ
/blog/ と /ja/blog/         記事の一覧
/blog/<名前>/               英語の記事
/ja/blog/<名前>/            日本語の記事
/rss.xml と /ja/rss.xml     言語別の購読用フィード ← 自動で作られます
/sitemap.xml                検索エンジン向けの地図 ← 自動で作られます
/404                        見つからないときのページ
\`\`\`

**要らないページは消して構いません。** \`src/pages/\` からファイルを消すだけです。
消したら \`src/lib/nav.ts\` からも消してください。**ナビの定義はそこ 1 か所だけ**なので、
残したままだとヘッダから 404 へのリンクが出ます。

### 記事を書く

\`src/content/blog/\` に \`.md\` を足すだけです。英語の記事は \`lang: en\`、
日本語の記事は \`lang: ja\` にします。\`route\` が URL の名前になり、省略した
場合だけファイル名が使われます。

置いてある \`hello-en.md\` と \`hello.md\` に、それぞれの言語で書き方と
画像の入れ方が書いてあります。
**\`draft: true\` を付けた記事は、一覧にも sitemap にも RSS にも出ません。**

### トップの一覧が読んでいるもの

\`public/works.json\` です。中身は差し替えて構いません。
サーバから取ってくるようにしたくなったら、\`src/pages/index.astro\` の
\`loader\` の \`url\` を書き換えるだけです。
` : ``}

---

## 3. 見た目を変える

### 色や雰囲気をまとめて変える

\`src/styles/themes.css\` に 4 種類（\`neutral\` / \`warm\` / \`editorial\` / \`vivid\`）入っています。
${astro ? "`src/layouts/Base.astro`" : "`index.html`"} の \`<html>\` に書きます。

\`\`\`html
<html data-theme="warm">
\`\`\`

色だけでなく、角の丸み・影の強さ・書体・字間まで一緒に変わります。
**1 か所変えるだけでサイト全体の印象が変わります。**

### 余白を変える

余白は 9 段階から選びます。数字で悩まないためです。

\`\`\`tsx
<Stack space="lg">…</Stack>
\`\`\`

小さいほうから ${spaceTokens(kind).map((t) => `\`${t}\``).join(" ")}。
**段階の外の値も書けます**（\`space="13px"\`）。段階は決まりではなく、既定値です。

### 並べ方を変える

| やりたいこと | 使う部品 |
|---|---|
| 縦に積む | \`<Stack space="md">\` |
| 横に並べる（入りきらなければ折り返す） | \`<Inline space="sm">\` |
| 段組みにする（狭い画面では自動で縦になる） | \`<Columns>\` + \`<Column>\` |
| ページ全体の幅を決める | \`<PageBlock width="narrow">\` |

**幅を決めるのは \`PageBlock\` の役目です。** 中の文章に個別で幅を付けると、
見出しだけ長くて本文が短い、ちぐはぐな見た目になります。

---

## 3.5. エディタの補完

VS Code なら、**設定は要りません。** \`.vscode/nasu-stack.code-snippets\` が
入っているので、\`wt-\` と打つとこのテンプレートの部品だけが並びます。

\`\`\`
wt-stack        → <Stack>…</Stack>
wt-page-block   → <PageBlock>…</PageBlock>
wt-async-form   → <AsyncForm action={…}>…</AsyncForm>
\`\`\`

**必須の props だけが埋まった形**で出ます。Tab で次の場所へ移れます。
任意の props は補完の説明に並べてあるので、そこから選んでください。

この一覧は**同梱している部品から作っています。** 入っていない部品は
出ません（あとから \`shadcn add\` で足したものは、次に作るときの一覧に入ります）。

---

## 4. 押したら動くものを作る

ボタンを押して何かする、フォームを送る——こういう「時間がかかる処理」には、
考えることが意外と多くあります。

- 押している間、押したことが分かるか
- 二回押されたらどうするか
- 失敗したら何を出すか
- やり直せるか

**これは部品が持っています。** あなたが書くのは処理そのものだけです。

\`\`\`tsx
import { ActionButton } from "@/components/ui/action-button";

<ActionButton action={async () => await 何かする()}>保存する</ActionButton>
\`\`\`

これだけで、押している間のくるくる、連打の防止、失敗したときの表示と押し直し、
成功したときのチェックマークが付きます。

フォームも同じ考え方です。

\`\`\`tsx
<AsyncForm action={async (values) => await 送る(values)} submitLabel="送信する">
  <Field name="name" label="お名前" required />
</AsyncForm>
\`\`\`

> **物足りなくなったら、下の層に降りられます。**
> \`useAction()\` を使えば状態だけ借りて見た目は自分で書けますし、
> \`useState\` と \`fetch\` で全部自分で書いても構いません。
> どの段階で止めても壊れません。

---

---

## 何を自分で書く必要があるか

**部品は「安全にする」のではなく「安全な判断をしやすくする」ものです。**

置くだけで守られるもの（画面の状態、二重送信、読み上げ、端末幅）と、
あなたが書かないと守られないもの（認証・認可・サーバ側の検証・レート制限）が
あります。

とくに誤解しやすいのは次の 4 つです。

| | 実は |
|---|---|
| FileDrop の accept と maxSize | **守りではありません。** 名前と推測を見ているだけ |
| HoneypotField | 単純な bot を減らすだけ。認証の代わりにはなりません |
| ブラウザから送る headers | **誰でも読めます。** サービスの鍵を置かないでください |
| PUBLIC_ / VITE_ の環境変数 | **ブラウザに配られます** |

一覧は
[docs/boundaries.md](https://github.com/Nasu726/Nasu-Stack/blob/main/docs/boundaries.md)
にあります。**公開する前に 1 度読んでください。**

## 5. 部品を足す

最初から入っているのは、よく使うものだけです。
表・タブ・通知・ファイル選択などは、必要になってから足します。

\`\`\`bash
npx shadcn@${shadcnVersion(kind)} add @nasu/data-table
\`\`\`

**設定は済んでいるので、これだけです。** その部品が使う他の部品も一緒に入ります。
入る先は \`src/components/ui/\` です。

> **「すでにあります。上書きしますか？」と何度か聞かれます。**
> 最初から入っているファイルが、新しい部品からも使われているためです。
> **そのまま Enter（\`N\`）で構いません。** あなたが書き換えたコードを守るための確認です。

**入った後のコードはあなたのものです。** 気に入らなければ直接書き換えてください。
（そのために、まとめて配るのではなくコピーする形にしています。
書き換えても、次の更新で上書きされることがありません。）

足せるものの一覧: ${catalog}

---

${astro ? `## 6. フォームを実際に届くようにする

いまのフォームは、送っても手元で結果を返しているだけです。
実際にメールなどで受け取るには**送信先**が要ります。

\`src/lib/submit.ts\` の \`createSubmit\` に、受け取る側のアドレスを渡します。

\`\`\`ts
export const submitContact = createSubmit({
  url: "https://あなたの受け口/contact",
});
\`\`\`

受け口の例は Nasu Stack の \`examples/receivers/\` にあります
（Cloudflare Workers 版）。

タイムアウト、失敗したときの日本語のメッセージ、
自動投稿を弾く仕組みは \`createSubmit\` が持っています。

---

` : ``}## ${astro ? "7" : "6"}. スマホで崩れていないか確かめる

見た目の崩れは、目で見ても気づけないことがあります。数値で測れます。

\`\`\`bash
npm i -D playwright
npx playwright install chromium
\`\`\`

（1 回だけ。ブラウザを本物で動かすので少し時間がかかります）

別のターミナルで画面を出しておいてから、

\`\`\`bash
npm run build
npm run preview
\`\`\`

もう 1 つのターミナルで測ります。

\`\`\`bash
node src/scripts/check-responsive.mjs ${preview}/
\`\`\`

5 つの画面幅で、次を見ます。

- 横にはみ出していないか
- 指で押すには小さすぎるボタンが無いか
- 1 行が長すぎて読みにくくないか
- 画像が読み込まれる前と後で、文章の位置がずれないか

**赤が出たら直す価値があります。**

---

## ${astro ? "8" : "7"}. 公開する

\`npm run build\` で \`dist/\` ができます。**この中身がサイトの全部です。**
${astro ? "静的" : "静的"}なファイルの集まりなので、置くだけで公開できます。

無料で使える置き場所の例: Cloudflare Pages / Netlify / Vercel。
どれも「GitHub のリポジトリを繋ぐと、push するたびに自動で公開される」形にできます。
**この 3 つは、アドレスの一番上（\`https://あなたの名前.pages.dev/\`）に置かれます。**
それなら追加の設定は要りません。

### GitHub Pages に置くときだけ、1 つ設定が要ります

GitHub Pages はリポジトリ名がアドレスに入ります。

\`\`\`
https://あなたの名前.github.io/リポジトリ名/
\`\`\`

**この形だと、設定を足さないと真っ白な画面になります。** ページの HTML は
出るのに、見た目と動きを作っているファイルの置き場所がずれて、
全部 404 になるためです。公開そのものは成功するので、いちばん気づきにくい形です。

${astro ? "\`astro.config.mjs\`" : "\`vite.config.ts\`"} に 1 行足してください。

\`\`\`js
${astro ? `site: "https://あなたの名前.github.io",
base: "/リポジトリ名/",` : `base: "/リポジトリ名/",`}
\`\`\`

**それだけでは足りません。** \`base\` が効くのは、道具が自動で出す部分
（画像・CSS・JS）だけです。**あなたが手で書いたリンクには効きません。**

\`\`\`tsx
<a href="/about/">会社概要</a>          {/* 公開すると 404 */}
<a href={withBase("/about/")}>会社概要</a>  {/* これが正しい */}
\`\`\`

\`withBase\` は \`src/lib/base.ts\` にあります。

\`\`\`tsx
import { withBase } from "@/lib/base";
\`\`\`

ヘッダとフッタ（\`SiteHeader\` / \`SiteFooter\`）は**部品の中で自動で付ける**ので、
渡す \`href\` はそのままで構いません。手で書くのは、本文中のリンクや
\`fetch\` する URL です。

> **この不具合は手元では絶対に再現しません。** 開発サーバは直下で動くので、
> \`/about/\` がそのまま正解になります。**公開して初めて壊れます。**
> Nasu Stack 自身も同じ穴に落ちて、公開したデモのリンクが全部 404 でした。

（Nasu Stack 自身も GitHub Pages で公開していて、同じ設定をしています）

${astro ? `公開先が決まったら、\`astro.config.mjs\` の \`site\` をそのアドレスにしてください。
検索エンジンに渡すページ一覧（\`sitemap.xml\`）と購読用のフィード（\`rss.xml\`）が、
正しいアドレスで作られるようになります。

` : ``}---

## 困ったとき

| 症状 | 見るところ |
|---|---|
| \`npm run dev\` が動かない | Node.js が **${MIN_NODE} 以上**か（\`node -v\`）。\`npm install\` は済んでいるか |
| 画面が真っ白 | ブラウザの開発者ツール（F12）の Console に赤い文字が出ていないか |
| 部品を足せない | ネットに繋がっているか。\`components.json\` の \`registries\` の行が消えていないか |
| 崩れている | 上の「スマホで崩れていないか確かめる」で数値を見る |

Nasu Stack 本体: https://github.com/Nasu726/Nasu-Stack
`;
}

function howToUseEn(kind, name) {
  const astro = isAstro(kind);
  const dev = astro ? "http://localhost:4321" : "http://localhost:5173";
  const preview = astro ? "http://localhost:4321" : "http://localhost:4173";
  const entry = astro ? "src/pages/index.astro" : "src/App.tsx";
  const catalog = registryUrl(kind).replace("/r/{name}.json", "/");

  return `# How to use ${name}

This file belongs to you. Delete it when you no longer need it.

---

## 1. Run the project

Run the following commands from the **project root directory** — the directory
that contains \`package.json\`.

\`\`\`bash
npm install
npm run dev
\`\`\`

Open ${dev} in your browser. Keep the development server running while you work;
the page updates when you save a file. Press \`Ctrl + C\` to stop it.

### Commit \`package-lock.json\`

\`npm install\` creates or updates \`package-lock.json\`. Commit that file to git.
The version ranges in \`package.json\` can resolve differently over time, while
the lockfile lets another computer, CI, or your future self install the same tree.

This template starts with the lockfile that Nasu Stack verified. You may keep it
or update it, but commit the resulting lockfile either way.

---

## 2. What to edit first

Start with these ${astro ? "three" : "two"} files:

| File | What it changes |
|---|---|
${astro ? `| \`src/site.config.ts\` | Site name and description used by the header and search previews |
| \`astro.config.mjs\` → \`site\` | Public URL; leave it until you know where the site will be hosted |
| \`${entry}\` | Home page content |` : `| \`index.html\` → \`<title>\` | Browser tab title |
| \`${entry}\` | Screen content |`}

${astro ? `Add a file under \`src/pages/\` to add a page. For example,
\`src/pages/about.astro\` becomes \`/about/\`.

` : ``}You can leave the remaining folders alone at first:

| Location | Contents |
|---|---|
| \`src/components/ui/\` | Buttons, forms, headers, and other UI components |
| \`src/lib/\` | Supporting logic used by components |
| \`src/styles/\` | Color, spacing, and typography settings |
| \`src/hooks/\` | React state helpers |
${kind === "blog" ? `
### Included pages

The template includes matching English and Japanese routes:

\`\`\`
/ and /ja/                 Home
/lp/ and /ja/lp/           Landing page and FAQ
/about/ and /ja/about/     About page
/contact/ and /ja/contact/ Contact form
/blog/ and /ja/blog/       Article lists
/blog/<name>/              English article
/ja/blog/<name>/           Japanese article
/rss.xml and /ja/rss.xml   RSS feeds, generated automatically
/sitemap.xml               Search-engine sitemap, generated automatically
/404                       Not-found page
\`\`\`

Delete pages you do not need from \`src/pages/\`, then remove their entries from
\`src/lib/nav.ts\`. Navigation is defined there in one place; leaving an entry
behind creates a link to a 404 page.

### Write an article

Add a \`.md\` file under \`src/content/blog/\`. Use \`lang: en\` for English or
\`lang: ja\` for Japanese. The optional \`route\` field controls the URL name;
otherwise the file name is used. An article with \`draft: true\` is excluded from
the list, sitemap, and RSS feed.

The included \`hello-en.md\` and \`hello.md\` files show the metadata, Markdown,
and image syntax for each language.

### Change the home-page list

The list reads \`public/works.json\`. Replace its contents, or change the \`loader\`
URL in \`src/pages/index.astro\` when you are ready to load data from a server.
` : ``}

---

## 3. Change the visual style

### Change the whole theme

\`src/styles/themes.css\` contains four themes: \`neutral\`, \`warm\`, \`editorial\`,
and \`vivid\`. Set one on the \`<html>\` element in
${astro ? "`src/layouts/Base.astro`" : "`index.html`"}:

\`\`\`html
<html data-theme="warm">
\`\`\`

One change updates color, corner radius, shadow, typography, and letter spacing.

### Change spacing

Choose from nine spacing steps instead of inventing a number each time:

\`\`\`tsx
<Stack space="lg">…</Stack>
\`\`\`

From smallest to largest: ${spaceTokens(kind).map((token) => `\`${token}\``).join(" ")}.
You can still leave the scale when needed, for example \`space="13px"\`.

### Change layout

| Goal | Component |
|---|---|
| Stack items vertically | \`<Stack space="md">\` |
| Place items in a row and wrap when needed | \`<Inline space="sm">\` |
| Use columns that collapse on a narrow screen | \`<Columns>\` + \`<Column>\` |
| Set the width of a page | \`<PageBlock width="narrow">\` |

Let \`PageBlock\` own the page width. Setting widths independently on headings
and paragraphs usually produces an uneven layout.

---

## 3.5. Editor completions

VS Code needs no extra setup. Type \`wt-\` to use the snippets in
\`.vscode/nasu-stack.code-snippets\`:

\`\`\`
wt-stack        → <Stack>…</Stack>
wt-page-block   → <PageBlock>…</PageBlock>
wt-async-form   → <AsyncForm action={…}>…</AsyncForm>
\`\`\`

Snippets insert required props and let you move between edit points with Tab.
They are generated from the components included in this project.

---

## 4. Add an action

Slow work such as submitting a form needs pending, success, failure, retry, and
double-submit handling. Nasu Stack components own those interface states; you
provide the operation:

\`\`\`tsx
import { ActionButton } from "@/components/ui/action-button";

<ActionButton action={async () => await save()}>Save</ActionButton>
\`\`\`

Forms use the same contract:

\`\`\`tsx
<AsyncForm action={async (values) => await send(values)} submitLabel="Send">
  <Field name="name" label="Name" required />
</AsyncForm>
\`\`\`

When you need more control, use \`useAction()\` and write the interface yourself,
or drop down to \`useState\` and \`fetch\`. The copied source is yours to change.

---

## What you still need to secure

Components make safe decisions easier; they do not make an application secure by
themselves. Nasu Stack handles interface state, duplicate browser submissions,
announcements, and responsive foundations. Your application still owns
authentication, authorization, server-side validation, and rate limiting.

| Feature | What it does not guarantee |
|---|---|
| FileDrop \`accept\` and \`maxSize\` | File names and browser hints are not server validation |
| HoneypotField | Reduces simple bots; it is not authentication |
| Browser request headers | Anyone can read and reproduce them; never put service keys there |
| \`PUBLIC_\` / \`VITE_\` environment values | They are sent to the browser |

Read the complete boundary before publishing:
https://github.com/Nasu726/Nasu-Stack/blob/main/docs/boundaries.md

## 5. Add a component

Add tables, tabs, toasts, file pickers, and other components when you need them:

\`\`\`bash
npx shadcn@${shadcnVersion(kind)} add @nasu/data-table
\`\`\`

The registry is already configured. Dependencies are copied into
\`src/components/ui/\`. If shadcn asks whether to overwrite an existing file,
press Enter to keep the default \`N\`; this protects code you may have changed.

The copied code belongs to your project and will not be silently overwritten by
a later Nasu Stack update.

Component catalog: ${catalog}

---

${astro ? `## 6. Connect the form to a real receiver

The included form returns a local sample response. To receive real messages, pass
your receiver URL to \`createSubmit\` in \`src/lib/submit.ts\`:

\`\`\`ts
export const submitContact = createSubmit({
  url: "https://your-receiver.example/contact",
});
\`\`\`

The Nasu Stack repository contains a Cloudflare Workers receiver example under
\`examples/receivers/\`. The browser component cannot replace authentication,
server validation, rate limiting, or bot protection at that receiver.

---

` : ``}## ${astro ? "7" : "6"}. Check narrow screens

Install Playwright once:

\`\`\`bash
npm i -D playwright
npx playwright install chromium
\`\`\`

From the project root, build and start the preview in one terminal:

\`\`\`bash
npm run build
npm run preview
\`\`\`

Run the responsive check from another terminal:

\`\`\`bash
node src/scripts/check-responsive.mjs ${preview}/
\`\`\`

It checks five viewport widths for horizontal overflow, undersized controls,
overlong text lines, and layout movement while images load.

---

## ${astro ? "8" : "7"}. Deploy

\`npm run build\` creates \`dist/\`. Hosts such as Cloudflare Pages, Netlify,
and Vercel can publish it from the root of their domain without extra path setup.

### GitHub Pages needs a base path

A project site is served from a repository subpath:

\`\`\`
https://your-name.github.io/repository-name/
\`\`\`

Add the base setting to ${astro ? "`astro.config.mjs`" : "`vite.config.ts`"}:

\`\`\`js
${astro ? `site: "https://your-name.github.io",
base: "/repository-name/",` : `base: "/repository-name/",`}
\`\`\`

The build tool adjusts generated assets, but not links you write yourself. Use
\`withBase\` for links and fetched URLs in page content:

\`\`\`tsx
<a href="/about/">About</a>                {/* breaks after publishing */}
<a href={withBase("/about/")}>About</a>    {/* correct */}
\`\`\`

\`SiteHeader\` and \`SiteFooter\` apply the base path internally; pass their
navigation \`href\` values without modifying them.

${astro ? `When you know the public address, also set \`site\` in
\`astro.config.mjs\` so \`sitemap.xml\` and \`rss.xml\` contain correct URLs.

` : ``}---

## Troubleshooting

| Symptom | Check |
|---|---|
| \`npm run dev\` fails | Node.js is ${MIN_NODE} or newer (\`node -v\`) and \`npm install\` completed |
| The screen is blank | Red errors in the browser developer tools Console |
| A component cannot be added | Network access and the \`registries\` entry in \`components.json\` |
| The page overflows | Run the responsive check above |

Nasu Stack: https://github.com/Nasu726/Nasu-Stack
`;
}

function howToUse(kind, name, lang) {
  return lang === "ja" ? howToUseJa(kind, name) : howToUseEn(kind, name);
}

/* ================================================================
 * CLI
 * ============================================================== */

/**
 * 引数を読みます。
 *
 * **知らないフラグは黙って捨てません。** `--templat vite` のような打ち間違いを
 * 無視すると、何も言われないまま既定（astro）で作られます。
 * 気づくのは、できたものを開いて「思っていたのと違う」と感じたときです。
 */
export function parseArgs(argv) {
  const args = {
    name: undefined,
    template: undefined,
    lang: undefined,
    yes: false,
    unknown: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--template" || a === "-t") args.template = argv[++i] ?? "";
    else if (a.startsWith("--template=")) args.template = a.split("=")[1];
    else if (a === "--lang" || a === "-l") args.lang = argv[++i] ?? "";
    else if (a.startsWith("--lang=")) args.lang = a.split("=")[1];
    else if (a.startsWith("-")) args.unknown.push(a);
    else args.name ??= a;
  }
  return args;
}

async function askChoice(rl, { title, options, question, lang }, write) {
  write("");
  write(`  ${title}`);
  write("");
  options.forEach((option, index) => {
    write(`    ${index + 1}. ${option.label}: ${option.hint}`);
  });
  write("");

  while (true) {
    const answer = (await rl.question(`  ${question} [1] `)).trim();
    const selected = options[Number(answer || "1") - 1];
    if (selected) return selected;
    write(`  ${lang ? ui(lang).invalidChoice(options.length) :
      `Please enter 1-${options.length}. / 1 から ${options.length} の数字を入力してください。`}`);
  }
}

/** 最初の問いだけは、まだ言語が決まっていないので両言語で出します。 */
export async function chooseLanguage(rl, write = console.log) {
  const language = await askChoice(
    rl,
    {
      title: "Language / 言語",
      options: LANGUAGE_OPTIONS,
      question: "Choose a language / 言語を選んでください",
      lang: null,
    },
    write,
  );
  return language.key;
}

/**
 * 対話は「始め方」から「具体的な種類」へ進めます。
 * 選択肢を1行に収め、名前と説明の対応が目で追える形にします。
 */
export async function chooseInteractiveKind(rl, lang = "en", write = console.log) {
  const copy = ui(lang);
  const mode = await askChoice(
    rl,
    {
      title: copy.startTitle,
      options: localized(START_MODES, lang),
      question: copy.startQuestion,
      lang,
    },
    write,
  );
  const kind = await askChoice(
    rl,
    {
      title: mode.key === "scratch" ? copy.scratchTitle : copy.templateTitle,
      options: localized(KINDS.filter((item) => item.mode === mode.key), lang),
      question: mode.key === "scratch" ? copy.scratchQuestion : copy.templateQuestion,
      lang,
    },
    write,
  );
  return kind.key;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.lang !== undefined && !LANGUAGES.has(args.lang)) {
    console.error(`  ✗ ${UI.en.invalidLanguage}: ${args.lang ?? "(missing)"}`);
    process.exit(2);
  }

  // 対話できない環境（CI など）でも動く必要があります。
  const interactive = process.stdin.isTTY && !args.yes;
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  let lang = args.lang;

  if (args.help) {
    lang ??= "en";
    console.log("");
    console.log(lang === "ja"
      ? "  使い方: npx <tarball URL> <プロジェクト名> [--template <種類>] [--lang <en|ja>]"
      : "  Usage: npx <tarball URL> <project-name> [--template <kind>] [--lang <en|ja>]");
    console.log("");
    for (const k of KINDS) {
      console.log(
        `    --template ${k.key.padEnd(6)} ${k.label[lang]}: ${k.hint[lang]}`,
      );
    }
    console.log(lang === "ja"
      ? "    --lang en|ja   案内ドキュメントの言語"
      : "    --lang en|ja   Language for prompts and guidance files");
    console.log(lang === "ja"
      ? "    --yes          対話せずに既定で作る"
      : "    --yes          Use the default without prompting");
    console.log("");
    rl?.close();
    process.exit(0);
  }

  /* **知らない指定は止めます。** 黙って無視すると、打ち間違えた人は
     既定で作られたものを受け取り、開くまで気づけません。 */
  if (args.unknown.length > 0) {
    lang ??= "en";
    const copy = ui(lang);
    console.error(`  ✗ ${copy.unknownOption}: ${args.unknown.join(" ")}`);
    console.error(`    ${copy.availableOptions}`);
    console.error(`    ${copy.kinds}: ${KINDS.map((k) => k.key).join(" / ")}`);
    rl?.close();
    process.exit(2);
  }

  if (!lang && rl) lang = await chooseLanguage(rl);
  lang ??= "en";
  const copy = ui(lang);

  console.log("");
  console.log(`  ${copy.banner}`);
  console.log("");

  /* **作る前に Node を見ます。**
     CLI 自体は古い Node でも動きますが、作ったものが動きません。
     生成してから `npm install` で EBADENGINE を見せられても、
     Web が初めての人には「自分が何か間違えた」としか読めません。 */
  const nodeProblem = checkNodeVersion(process.version, lang);
  if (nodeProblem) {
    console.error(`  ✗ ${nodeProblem.split("\n").join("\n  ")}`);
    process.exit(2);
  }

  let name = args.name;
  if (!name && rl) name = (await rl.question(`  ${copy.projectName} `)).trim();
  if (!name) {
    console.error(`  ✗ ${copy.missingName}`);
    /* **短い形は書きません。** `create-nasu-stack` という名前は npm で
       空いており、第三者が取れば任意のコードが動きます。
       詰まっている人はエラーメッセージを一番信じるので、ここが一番危ない。 */
    console.error(`    ${copy.missingNameHint}`);
    rl?.close();
    process.exit(2);
  }

  const nameError = validateName(name, lang);
  if (nameError) {
    console.error(`  ✗ ${nameError}`);
    rl?.close();
    process.exit(2);
  }

  let kind = args.template;
  if (kind === undefined && rl) {
    kind = await chooseInteractiveKind(rl, lang);
  }
  kind ??= "astro";

  if (!KINDS.some((k) => k.key === kind)) {
    console.error(`  ✗ ${copy.unknownTemplate}: ${kind}`);
    console.error(`    ${copy.availableKinds}: ${KINDS.map((k) => k.key).join(" / ")}`);
    rl?.close();
    process.exit(2);
  }

  const dest = path.resolve(process.cwd(), name);
  const targetError = checkTarget(dest, lang);
  if (targetError) {
    console.error(`  ✗ ${targetError}`);
    rl?.close();
    process.exit(2);
  }

  scaffold(kind, dest, name, lang);
  rl?.close();

  /* **画面に出すのは、次の 3 行と読む場所だけにします。**
     手順を全部ここに並べても、次のコマンドを打った時点で流れて消えます。
     「さっき何て書いてあったっけ」をスクロールを遡って探すことになるので、
     中身は HowToUse.md に書いて、その存在だけを伝えます。 */
  const dev = isAstro(kind) ? "4321" : "5173";
  console.log("");
  console.log(`  ✅ ${copy.created(name, kindLabel(kind, lang))}`);
  console.log("");
  console.log(`     cd ${name}`);
  console.log("     npm install");
  console.log(`     npm run dev        → http://localhost:${dev}`);
  console.log("");
  console.log(`  📖 ${copy.guide(name)}`);
  console.log(`     ${copy.guideHint}`);
  console.log("");
}

// 直接実行されたときだけ CLI として動きます（検査からは関数を呼びます）
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
