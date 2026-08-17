/**
 * 子プロセスの起動と停止。**ここが唯一の定義です。**
 *
 * 検査スクリプトは pnpm を呼び、プレビューサーバを立て、最後に止めます。
 * どれも「OS ごとに違うのに、違いが見えにくい」ところです。
 * 3 つのスクリプトに散らばっていて、**片方だけ正しい**状態でした。
 *
 * ================================================================
 * 1. pnpm をどう起動するか
 * ================================================================
 *
 * ----------------------------------------------------------------
 * なぜ「pnpm」と書くだけで済まないのか
 * ----------------------------------------------------------------
 * Windows の pnpm は `pnpm.cmd` というバッチファイルです。
 * Node 20.12 以降、バッチファイルを shell 無しで spawn すると
 * **EINVAL で落ちます**（CVE-2024-27980 への対策で塞がれました）。
 *
 * では `shell: true` を付ければいいかというと、そちらも代償があります。
 * 引数が cmd.exe に再解釈されるので、エスケープの責任がこちら側に移ります。
 * Node 自身も DEP0190 で「引数は連結されるだけで、エスケープされない」と
 * 警告します。検査スクリプトが渡す引数は今は安全ですが、
 * **後から誰かが空白入りのパスを渡した瞬間に静かに壊れる**形です。
 *
 * どちらも踏まない道が 1 つあります。pnpm は `pnpm run` の中で
 * `npm_execpath` に**自分自身の JS ファイル**の場所を入れます。
 * それを node で直接動かせば、バッチを経由しないので shell が要りません。
 * おまけに「今このリポジトリを動かしているのと同じ pnpm」になるので、
 * PATH に別の版が入っていても引きずられません。
 *
 * ----------------------------------------------------------------
 * なぜ人のレビューで見つからなかったのか
 * ----------------------------------------------------------------
 * **書いた本人の環境では絶対に再現しないからです。**
 * Linux / macOS の `pnpm` は普通の実行ファイルなので、上のどれも起きません。
 * `check-portability.mjs` と同じ種類の間違いです。
 * ---------------------------------------------------------------- */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";

/** `pnpm run` が渡してくる、pnpm 本体の JS。無いこともあります。 */
const SELF = process.env.npm_execpath;
const isJs = (p) => /\.[cm]?js$/.test(p ?? "");

/**
 * pnpm の呼び出しを組み立てます。
 *
 *   const { cmd, args, options } = pnpm(["--filter", "site", "build"]);
 *   spawnSync(cmd, args, { ...options, stdio: "inherit" });
 *
 * `options` を必ず展開してください。Windows の退路で `shell: true` が
 * 入ることがあり、落とすと EINVAL に戻ります。
 */
export function pnpm(args) {
  if (isJs(SELF)) return { cmd: process.execPath, args: [SELF, ...args], options: {} };

  // 退路: `pnpm verify` ではなく `node scripts/verify.mjs` と直に叩かれた場合。
  // PATH の pnpm を使います。Windows ではバッチなので shell が要ります。
  if (isWindows) {
    /* shell を通すと、引数は**連結されるだけでエスケープされません。**
       空白や `&` が入った文字列を渡した瞬間に、意図と違うコマンドになります。
       ここで止めます。**黙って通すのが一番危険です。** */
    const bad = args.find((a) => /[\s&|<>^"']/.test(String(a)));
    if (bad !== undefined) {
      throw new Error(
        `shell 経由では安全に渡せない引数があります: ${JSON.stringify(bad)}\n` +
          `  このスクリプトは pnpm 経由で実行してください（例: pnpm verify）。\n` +
          `  pnpm run の中でなら npm_execpath が入るので、shell を通しません。`,
      );
    }
    return { cmd: "pnpm.cmd", args, options: { shell: true } };
  }
  return { cmd: "pnpm", args, options: {} };
}

/**
 * npm の呼び出しを組み立てます。**利用者が打つのは npm です。**
 *
 * ----------------------------------------------------------------
 * なぜ pnpm で代用してはいけないのか
 * ----------------------------------------------------------------
 * 生成物の README も CLI の出力も `npm install` と書いています。
 * それなのに検査は pnpm で回していました。**別の道具を確かめても、
 * 利用者の経路を確かめたことにはなりません。**
 *
 * 依存の解決も、peer の扱いも、lockfile の作り方も違います。
 * 外部レビューで「利用者が最初に踏む経路が CI の盲点になっている」と
 * 指摘されたのは、まさにこの差のことでした（P1-06b）。
 *
 * ----------------------------------------------------------------
 * 起動の仕方
 * ----------------------------------------------------------------
 * Windows の `npm` は `npm.cmd`（バッチ）なので、pnpm と同じ穴があります
 * （上の pnpm() のコメント参照）。npm は node の隣に JS の実体があるので、
 * それを直接動かします。バッチを経由しないので shell が要りません。
 */
export function npm(args) {
  const selfJs = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (existsSync(selfJs)) {
    return { cmd: process.execPath, args: [selfJs, ...args], options: {} };
  }

  // 退路。理由と危険は pnpm() 側と同じです。
  if (isWindows) {
    const bad = args.find((a) => /[\s&|<>^"']/.test(String(a)));
    if (bad !== undefined) {
      throw new Error(
        `shell 経由では安全に渡せない引数があります: ${JSON.stringify(bad)}`,
      );
    }
    return { cmd: "npm.cmd", args, options: { shell: true } };
  }
  return { cmd: "npm", args, options: {} };
}

/**
 * そのポートで待っているプロセスを止めます。
 *
 * ----------------------------------------------------------------
 * なぜ stopTree() だけでは足りないのか
 * ----------------------------------------------------------------
 * **道具によっては、自分を子プロセスとして起動し直します。**
 * astro 7 の `preview` がそれで、親はすぐ終了し、実際に配信しているのは
 * 孤児になった子です（コマンドラインに覚えのない `--json` が付いています）。
 *
 * こちらが握っている PID は既に死んでいるので、`taskkill /T` を撃っても
 * 何も起きません。**プロセスの親子関係に頼れない相手がいます。**
 *
 * 止め損なうと、次の実行がこうなります。
 *
 *   - ポートが埋まっているので、道具が勝手に次の番号へずれる
 *   - こちらは気づかず、**前回の残骸に判定を当てる**
 *   - その残骸は消えたディレクトリを配っているので、理由の分からない赤が出る
 *
 * v0.9a で実際に踏みました。ポートは分かっているので、そこから辿ります。
 */
export function stopPort(port) {
  try {
    if (isWindows) {
      const out = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout ?? "";
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/.test(line)) continue;
        if (!new RegExp(`[:.]${port}\\s`).test(line)) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") spawnSync("taskkill", ["/pid", pid, "/T", "/F"], { stdio: "ignore" });
      }
    } else {
      const out = spawnSync("lsof", ["-t", `-i`, `tcp:${port}`, "-s", "TCP:LISTEN"], {
        encoding: "utf8",
      }).stdout ?? "";
      for (const pid of out.split(/\s+/).filter(Boolean)) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          /* もう落ちている */
        }
      }
    }
  } catch {
    /* 止められなくても検査は続けます。次の実行の入口で気づけます */
  }
}

/**
 * 立てたサーバを、**子や孫ごと**止めます。
 *
 * ----------------------------------------------------------------
 * なぜ `child.kill()` では足りないのか
 * ----------------------------------------------------------------
 * `pnpm exec vite preview` は 2 段になっています（pnpm → vite）。
 * `child.kill()` が殺すのは**直下の 1 つだけ**なので、
 * 実際に配信している孫が生き残ります。
 *
 * POSIX では `detached: true` でプロセスグループを作り、
 * 負の PID（= グループ全体）へ送ることで解決できます。
 * **Windows にプロセスグループはありません。** `taskkill /T` で
 * ツリーを辿ってもらう必要があります。
 *
 * 止め損なうと、次がこうなります。
 *
 *   - 生き残ったサーバが temp のファイルを掴んだままになり、
 *     後片付けの `rmSync` が **EPERM** で落ちる（Windows はファイルを掴む）
 *   - 判定はすべて緑なのに、終了コードだけ 1 になる。
 *     **原因が判定の一覧に出てこない**ので、いちばん分かりにくい落ち方です
 *
 * v0.9a で実際に踏みました。`verify.mjs` は taskkill を使っていて正しく、
 * `verify-create.mjs` は `kill()` のままでした。**同じ概念が 2 実装あって、
 * 片方だけ間違っている**——このリポジトリのバグの型そのものです。
 */
export function stopTree(child) {
  if (!child?.pid) return;
  try {
    if (isWindows) {
      // /T で子孫ごと、/F で強制終了。
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      // 負の PID は「このプロセスグループ全体」。POSIX のみ。
      // spawn 側で detached: true にしていることが前提です。
      process.kill(-child.pid);
    }
  } catch {
    /* すでに落ちている */
  }
}
