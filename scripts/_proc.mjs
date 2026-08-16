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
  return {
    cmd: isWindows ? "pnpm.cmd" : "pnpm",
    args,
    options: isWindows ? { shell: true } : {},
  };
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
