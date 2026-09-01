import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { stopTree } from "../_proc.mjs";
import { log } from "../_check.mjs";

export async function verifyProjects({ root, work, CASES, PAGES, must, run, shadcn, registryPort }) {
  for (const {
    name,
    kind,
    port,
    framework,
    verifyScript = false,
    probeItem = "data-table",
    probeTarget = "src/components/ui/data-table.tsx",
  } of CASES) {
    // build は `npm run build`（利用者が打つ形）。型検査は npm exec で直に。
    const buildArgs = ["run", "build"];
    const checkArgs =
      framework === "vite"
        ? ["exec", "--", "tsc", "--noEmit"]
        : ["exec", "--", "astro", "check"];
    const dir = path.join(work, name);
    log(`${kind}: npm install …`);

    /* 同梱した lockfile が、まだ package.json と噛み合っているか。
       ----------------------------------------------------------------
       **古い lockfile を配るのが、同梱した分の新しいリスクです。**
       噛み合っていないと npm は黙って書き直すので、
       前後のハッシュを比べれば分かります。
       （書き直された = 利用者が受け取るのは、こちらが検査していない木） */
    const lockPath = path.join(dir, "package-lock.json");
    /* 改行は見ません。**見たいのは「npm が木を書き換えたか」**であって、
       CRLF/LF の違いではありません（環境で変わります）。 */
    const hashOf = (p) =>
      createHash("sha256")
        .update(fs.readFileSync(p, "utf8").split(String.fromCharCode(13)).join(""))
        .digest("hex");
    const lockBefore = fs.existsSync(lockPath) ? hashOf(lockPath) : null;
    must(`7.48 ${kind}: lockfile が同梱されている`, lockBefore !== null);

    // 利用者が打つのと同じ 1 行。--ignore-workspace のような
    // こちら側の都合は入れません。
    const i = run(dir, ["install"]);
    must(`8. ${kind}: npm install が通る`, i.ok, i.out ?? "");
    if (!i.ok) continue;
    if (lockBefore) {
      must(
        `     ${kind}: install しても lockfile が書き換わらない`,
        hashOf(lockPath) === lockBefore,
        "書き換わった = 同梱していた lockfile が古い",
      );
    }

    /* 完成雛型は、自身が持つ固定fixtureのbrowser回帰検査も配布後の姿で通します。 */
    if (verifyScript) {
      const v = run(dir, ["run", "verify"]);
      must(`8.3 ${kind}: 同梱の固定fixture browser検査が通る`, v.ok, v.out ?? "");
    }

    /* --- 8.2. 配っている依存に、既知の脆弱性が無いか ----------------
       **これが無いと、古いまま配り続けます。**
       v0.9a の時点で astro が 2 メジャー遅れ、XSS / SSRF の勧告 8 件を
       抱えたまま生成物に入っていました。利用者が `npm install` した
       瞬間に警告が出ますが、**こちらは何も知らないままです。**
       版を固定するなら、追随する仕組みと対で持つ必要があります。 */
    {
      const a = run(dir, ["audit", "--audit-level", "high", "--omit", "dev"]);
      if (a.ok) {
        must(`8.2 ${kind}: 配る依存に high 以上の脆弱性が無い`, true);
      } else {
        must(`8.2 ${kind}: 配る依存に high 以上の脆弱性が無い`, false, a.out ?? "");
      }
    }

    /* --- 8.5. 生成物に、本物の CLI で部品を足せるか -----------------
       **これがいちばん強い判定です。** 「生成できた」「ビルドが通る」まで
       全部緑でも、利用者が README のとおりに部品を足そうとした瞬間に
       詰まる状態がありえます（v0.9a で実際にそうでした）。
       上の 7.5 は設定の形を見るだけなので、**通ることは確かめられません。**

       レジストリは手元の public/ を配って使います。公開先が生きているかに
       この判定を依存させないためです。 */
    if (registryPort) {
      const cj = JSON.parse(fs.readFileSync(path.join(dir, "components.json"), "utf8"));
      cj.registries["@nasu"] = `http://127.0.0.1:${registryPort}/r/{name}.json`;
      fs.writeFileSync(path.join(dir, "components.json"), JSON.stringify(cj, null, 2));

      // 最初から入っていない部品を選びます。入っているものだと、
      // 「足せた」のか「元からあった」のか区別できません。
      /* `--overwrite` を付けます。生成物には action.ts などが既にあるので、
         CLI が 1 つずつ「上書きしますか？」と**対話で**聞いてきます。
         `--yes` はこの確認を覆いません。非対話で走らせると、
         **終了コード 0 のまま何も書かずに終わります**（v0.9a で踏みました）。

         利用者は N（既定）のままで構いません。自分が書き換えたコードを
         守るための確認です。ここは使い捨ての作業ディレクトリなので上書きします。 */
      const before = fs.existsSync(path.join(dir, probeTarget));
      const a = shadcn(dir, ["add", `@nasu/${probeItem}`, "--yes", "--overwrite"]);
      const after = fs.existsSync(path.join(dir, probeTarget));
      must(`8.5 ${kind}: 本物の CLI で部品を足せる`, a.ok && !before && after,
        a.ok ? `before=${before} after=${after}` : (a.out ?? ""));
    } else {
      must(
        `8.5 ${kind}: 本物の CLI で部品を足せる`,
        false,
        "local registryを配れませんでした",
      );
    }

    const t = run(dir, checkArgs);
    must(`9. ${kind}: 型検査が通る`, t.ok, t.out ?? "");

    const b = run(dir, buildArgs);
    must(`10. ${kind}: ビルドが通る`, b.ok, b.out ?? "");
    if (!b.ok) continue;

    /* 配信は **自分で立てた素の静的サーバ**でやります。
       ----------------------------------------------------------------
       astro 7 の `astro preview` はデーモンです。自分を子として起動し直し、
       親はすぐ終了し、ポートが埋まっていると**黙って別の番号へ逃げます。**
       こちらが握る PID は既に死んでいるので止められず、残骸が次の実行で
       「消えたディレクトリを配るサーバ」として判定に当たります。

       見たいのは「ビルドした中身が正しく出るか」なので、静的な出力を
       自分で配れば足ります（理由は scripts/_static.mjs）。
       代わりに、利用者が打つ `npm run preview` 自体は検査しません。 */
    const dist = path.join(dir, "dist");
    const server = spawn(
      process.execPath,
      [path.join(root, "scripts/serve-static.mjs"), dist, String(port),
        ...(framework === "vite" ? ["--spa"] : [])],
      { cwd: root, stdio: "ignore", detached: process.platform !== "win32" },
    );

    let up = false;
    for (let n = 0; n < 40; n++) {
      await new Promise((r) => setTimeout(r, 300));
      up = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok, () => false);
      if (up) break;
    }
    must(`11. ${kind}: 配信して画面が出る`, up);

    if (up) {
      const { checkUrls, formatReport, checkImageSizing, formatImageReport } =
        await import(
          new URL(
            `file://${path.join(root, "registry/nasu/scripts/check-responsive.mjs")}`,
          ).href
        );
      /* **入口だけ見ても足りません。** ブログ付きの雛型は 6 ページあり、
         崩れるのはたいてい記事や表のあるページです。 */
      const urls = PAGES[kind].map((u) => `http://127.0.0.1:${port}${u}`);
      const report = await checkUrls(urls);
      const { text, problems } = formatReport(report);
      const img = formatImageReport(await checkImageSizing(urls));
      must(
        `12. ${kind}: 端末幅の検査（${urls.length} ページ × 5 幅）を通る`,
        problems === 0,
        problems ? text : "",
      );
      must(`    ${kind}: 画像が場所を取っている`, img.problems === 0, img.problems ? img.text : "");

      /* --- 13. 広い画面で、本文と見出しの幅が揃っているか ------------
         **狭い側だけ見ていると気づけません。** 端末幅の検査は 1024px までしか
         見ないので、器を広くして中の本文にだけ max-w-* を付けた画面は
         全部緑のまま通ります。実際そうなっていました
         （1920px で器の右端 1465px に対し、本文の右端は 947px。
         右に 500px の空白が残り、見出しだけ長い、ちぐはぐな画面）。 */
      const { chromium } = await import("playwright");
      const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
      try {
        const pg = await b.newPage({ viewport: { width: 1920, height: 1000 } });
        await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
        const m = await pg.evaluate(() => {
          const box = (s) => {
            const el = document.querySelector(s);
            return el ? el.getBoundingClientRect() : null;
          };
          const main = box("main");
          const h = box("main h1");
          // 本文の中でいちばん右まで伸びているものを取ります。
          let widest = 0;
          for (const el of document.querySelectorAll("main p, main li")) {
            const r = el.getBoundingClientRect();
            if ((el.textContent || "").trim().length > 20) widest = Math.max(widest, r.right);
          }
          return { main: main?.right ?? 0, h1: h?.right ?? 0, text: widest, mainW: main?.width ?? 0 };
        });
        /* 見出しと本文の右端のずれが、器の幅の 25% を超えたら指摘します。
           少しのずれ（末尾の折り返し）は当然あるので、そこは通します。 */
        const gap = Math.abs(m.h1 - m.text);
        must(
          `13. ${kind}: 広い画面で見出しと本文の幅が揃っている`,
          m.mainW > 0 && gap <= m.mainW * 0.25,
          `器=${Math.round(m.mainW)}px 見出しの右端=${Math.round(m.h1)} 本文の右端=${Math.round(m.text)} ずれ=${Math.round(gap)}`,
        );
      } finally {
        await b.close();
      }
    }

    stopTree(server);
  }
}
