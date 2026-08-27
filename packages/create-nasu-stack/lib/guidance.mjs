import fs from "node:fs";
import path from "node:path";
import { MIN_NODE, TEMPLATES, isAstro } from "./config.mjs";

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

export function readme(kind, name, lang) {
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

export function howToUse(kind, name, lang) {
  return lang === "ja" ? howToUseJa(kind, name) : howToUseEn(kind, name);
}
