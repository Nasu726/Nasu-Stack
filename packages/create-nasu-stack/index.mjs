#!/usr/bin/env node
/**
 * create-nasu-stack — 動くところから始める
 * ================================================================
 *
 *   npx https://github.com/Nasu726/Nasu-Stack/releases/download/v2.0.0/create-nasu-stack-2.0.0.tgz my-site
 *   npx https://github.com/Nasu726/Nasu-Stack/releases/download/v2.0.0/create-nasu-stack-2.0.0.tgz my-site --lang en --template astro --yes
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
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import {
  KINDS,
  LANGUAGES,
  UI,
  checkNodeVersion,
  isAstro,
  kindLabel,
  ui,
} from "./lib/config.mjs";
import { parseArgs } from "./lib/args.mjs";
import {
  chooseInteractiveKind,
  chooseLanguage,
} from "./lib/prompts.mjs";
import {
  checkTarget,
  validateName,
} from "./lib/validation.mjs";
import { scaffold } from "./lib/scaffold.mjs";

export { MIN_NODE, checkNodeVersion } from "./lib/config.mjs";
export { parseArgs } from "./lib/args.mjs";
export { chooseInteractiveKind, chooseLanguage } from "./lib/prompts.mjs";
export { checkTarget, validateName } from "./lib/validation.mjs";
export { scaffold } from "./lib/scaffold.mjs";

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
