#!/usr/bin/env node
/**
 * create-webtemplate — 動くところから始める
 * ================================================================
 *
 *   npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site
 *   npx https://nasu726.github.io/WebTemplate/create-webtemplate.tgz my-site --template astro --yes
 *
 * 部品をいくら揃えても、**始められなければ届きません。**
 * ここが「誰でも簡単に作れる」への最後の一段です。
 *
 * ----------------------------------------------------------------
 * 短い形は、どこにも書きません
 * ----------------------------------------------------------------
 * npm には publish していないので、`create-webtemplate` という名前は
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

/** 足りなければ理由と直し方を出して止めます。 */
export function checkNodeVersion(current = process.version) {
  if (cmp(current, MIN_NODE) >= 0) return null;
  return [
    `Node.js が古いため、作ったものが動きません。`,
    ``,
    `  いま: ${current}`,
    `  必要: v${MIN_NODE} 以上`,
    ``,
    `  https://nodejs.org/ から新しいものを入れてください。`,
    `  （nvm を使っているなら: nvm install ${MIN_NODE} && nvm use ${MIN_NODE}）`,
  ].join("\n");
}

const KINDS = [
  {
    key: "astro",
    label: "サイト（Astro）",
    hint: "静的なページ中心。ブログや会社サイト。JavaScript は必要な部分だけ",
  },
  {
    key: "vite",
    label: "アプリ（Vite + React）",
    hint: "画面の中で動く部分が多いもの。管理画面やツール",
  },
];

/* ================================================================
 * プロジェクト名の検証
 * ================================================================
 * package.json の `name` として使うので、通らない字があります。
 * **生成してから npm に怒られるより、ここで止めたほうが親切です。**
 * ============================================================== */

export function validateName(name) {
  if (!name || !name.trim()) return "プロジェクト名を入れてください";
  if (name !== name.trim()) return "前後の空白は使えません";
  if (/[A-Z]/.test(name)) return "大文字は使えません（小文字にしてください）";
  if (/\s/.test(name)) return "空白は使えません（- でつないでください）";
  if (name.startsWith(".") || name.startsWith("_")) {
    return ". や _ で始まる名前は使えません";
  }
  if (/[~'!()*/\\]/.test(name)) return "記号 ~ ' ! ( ) * / \\ は使えません";
  if (name.length > 214) return "名前が長すぎます";
  return null;
}

/**
 * 生成先が使えるか調べます。
 *
 * **既存のディレクトリを上書きしてはいけません。** create 系の道具で
 * 一番やってはいけない事故です。空なら使います。
 */
export function checkTarget(dir) {
  if (!fs.existsSync(dir)) return null;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return `${dir} は既にファイルとして存在します`;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return null;
  return `${dir} は空ではありません（${entries.length} 件）。別の名前にするか、中身を移してください`;
}

/** テンプレートを写して、名前だけ差し替えます。 */
export function scaffold(kind, dest, projectName) {
  const src = path.join(TEMPLATES, kind);
  if (!fs.existsSync(src)) {
    throw new Error(
      `テンプレートが見つかりません: ${src}\n` +
        "開発中なら `node scripts/build-create-template.mjs` を先に実行してください",
    );
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
      "# 秘密の値。**絶対に commit しないでください。**",
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
    [
      "# ここに秘密の値を書きます。使うときは .env にコピーしてください。",
      "# .env は git に入りません（.gitignore 済み）。",
      "#",
      "# ⚠️ 名前が PUBLIC_ / VITE_ で始まる値は **ブラウザに配られます。**",
      "#    誰でも見られるので、鍵やパスワードを置かないでください。",
      "#    秘密の値はサーバ側（送信先の Worker など）に置きます。",
      "",
      "# 例: フォームの送信先",
      "# PUBLIC_CONTACT_ENDPOINT=https://example.workers.dev/contact",
      "",
    ].join("\n"),
  );

  // nvm などが読む、この雛型が想定している Node の版。
  fs.writeFileSync(path.join(dest, ".nvmrc"), `${MIN_NODE}\n`);

  fs.writeFileSync(path.join(dest, "README.md"), readme(kind, projectName));
  /* 手順は**ファイルに残します。**
     生成の直後に画面へ出しても、次のコマンドを打った時点で流れて消えます。
     「さっき何て書いてあったっけ」を、スクロールを遡って探すことになります。 */
  fs.writeFileSync(path.join(dest, "HowToUse.md"), howToUse(kind, projectName));
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
    return JSON.parse(fs.readFileSync(p, "utf8")).webtemplate?.shadcn ?? "";
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

function readme(kind, name) {
  const dev = kind === "astro" ? "http://localhost:4321" : "http://localhost:5173";
  return `# ${name}

WebTemplate から作りました。

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
function howToUse(kind, name) {
  const astro = kind === "astro";
  const dev = astro ? "http://localhost:4321" : "http://localhost:5173";
  const preview = astro ? "http://localhost:4321" : "http://localhost:4173";
  const entry = astro ? "src/pages/index.astro" : "src/App.tsx";
  const catalog = registryUrl(kind).replace("/r/{name}.json", "/");

  return `# ${name} の使い方

このファイルはあなたのものです。読み終わったら消して構いません。

---

## 1. 動かす

\`\`\`bash
npm install
npm run dev
\`\`\`

ブラウザで ${dev} を開きます。
**この状態のまま作業します。** ファイルを保存すると画面がすぐ切り替わります。
止めるときは \`Ctrl + C\` です。

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

受け口の例は WebTemplate の \`examples/receivers/\` にあります
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
> WebTemplate 自身も同じ穴に落ちて、公開したデモのリンクが全部 404 でした。

（WebTemplate 自身も GitHub Pages で公開していて、同じ設定をしています）

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

WebTemplate 本体: https://github.com/Nasu726/WebTemplate
`;
}

/* ================================================================
 * CLI
 * ============================================================== */

function parseArgs(argv) {
  const args = { name: undefined, template: undefined, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--template" || a === "-t") args.template = argv[++i];
    else if (a.startsWith("--template=")) args.template = a.split("=")[1];
    else if (!a.startsWith("-")) args.name ??= a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("");
  console.log("  WebTemplate — 動くところから始めます");
  console.log("");

  /* **作る前に Node を見ます。**
     CLI 自体は古い Node でも動きますが、作ったものが動きません。
     生成してから `npm install` で EBADENGINE を見せられても、
     Web が初めての人には「自分が何か間違えた」としか読めません。 */
  const nodeProblem = checkNodeVersion();
  if (nodeProblem) {
    console.error(`  ✗ ${nodeProblem.split("\n").join("\n  ")}`);
    process.exit(2);
  }

  // 対話できない環境（CI など）でも動く必要があります
  const interactive = process.stdin.isTTY && !args.yes;
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

  let name = args.name;
  if (!name && rl) name = (await rl.question("  プロジェクト名: ")).trim();
  if (!name) {
    console.error("  ✗ プロジェクト名を指定してください");
    /* **短い形は書きません。** `create-webtemplate` という名前は npm で
       空いており、第三者が取れば任意のコードが動きます。
       詰まっている人はエラーメッセージを一番信じるので、ここが一番危ない。 */
    console.error("    さっき打ったコマンドの最後に、作りたい名前を足してください");
    rl?.close();
    process.exit(2);
  }

  const nameError = validateName(name);
  if (nameError) {
    console.error(`  ✗ ${nameError}`);
    rl?.close();
    process.exit(2);
  }

  let kind = args.template;
  if (!kind && rl) {
    console.log("");
    KINDS.forEach((k, i) => {
      console.log(`    ${i + 1}. ${k.label}`);
      console.log(`       ${k.hint}`);
    });
    console.log("");
    const answer = (await rl.question("  どちらにしますか？ [1] ")).trim();
    kind = KINDS[Number(answer || "1") - 1]?.key;
  }
  kind ??= "astro";

  if (!KINDS.some((k) => k.key === kind)) {
    console.error(`  ✗ 知らないテンプレートです: ${kind}`);
    console.error(`    使えるのは: ${KINDS.map((k) => k.key).join(" / ")}`);
    rl?.close();
    process.exit(2);
  }

  const dest = path.resolve(process.cwd(), name);
  const targetError = checkTarget(dest);
  if (targetError) {
    console.error(`  ✗ ${targetError}`);
    rl?.close();
    process.exit(2);
  }

  scaffold(kind, dest, name);
  rl?.close();

  /* **画面に出すのは、次の 3 行と読む場所だけにします。**
     手順を全部ここに並べても、次のコマンドを打った時点で流れて消えます。
     「さっき何て書いてあったっけ」をスクロールを遡って探すことになるので、
     中身は HowToUse.md に書いて、その存在だけを伝えます。 */
  const dev = kind === "astro" ? "4321" : "5173";
  console.log("");
  console.log(`  ✅ ${name} を作りました（${KINDS.find((k) => k.key === kind).label}）`);
  console.log("");
  console.log(`     cd ${name}`);
  console.log("     npm install");
  console.log(`     npm run dev        → http://localhost:${dev}`);
  console.log("");
  console.log(`  📖 使い方は ${name}/HowToUse.md に書きました。`);
  console.log("     どのファイルを触るか / 部品の足し方 / 公開のしかたまで入っています。");
  console.log("");
}

// 直接実行されたときだけ CLI として動きます（検査からは関数を呼びます）
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
