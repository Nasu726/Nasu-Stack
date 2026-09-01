/**
 * 公開されたものを、**外から実際に叩いて**確かめます。
 *
 *   node scripts/verify-published.mjs https://nasu726.github.io/Nasu-Stack
 *   node scripts/verify-published.mjs http://127.0.0.1:5055        （手元で）
 *
 * ----------------------------------------------------------------
 * なぜワークフローに直接書かないのか
 * ----------------------------------------------------------------
 * YAML に `run: |` で並べると、**手元で同じものを試せません。**
 * 「CI でだけ落ちる」ものを、push を繰り返して直すことになります。
 * ここに置けば、`serve-registry.mjs` で配って同じ判定を回せます。
 *
 * ----------------------------------------------------------------
 * なぜ手元の検査だけでは足りないのか
 * ----------------------------------------------------------------
 * 手元で配って通っても、公開ホストでは違うことがあります。
 *
 *   - content-type が違う（JSON を text/plain で返す等）
 *   - 末尾スラッシュでリダイレクトされる
 *   - **存在しない URL に 404 を返さない**（200 で index を返すところがあります）
 *
 * どれも「置いたから大丈夫」では分かりません。出してから測ります。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./fetch-with-retry.mjs";
import { createCheckHarness, log } from "./_check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("使い方: node scripts/verify-published.mjs <公開先の URL>");
  process.exit(2);
}

const { REPO } = await import("./_deps.mjs");
const { makeFixture } = await import("./_fixture.mjs");

/**
 * Pages/CDN の単発 503 で、存在している全公開物を欠落扱いしないための GET。
 * 404 など非一時的な status と、3 回続く一時障害は成功にしません。
 */
const publishedFetch = (input, init) => fetchWithRetry(input, init, {
  onRetry: ({ nextAttempt, status, error }) => {
    const reason = status ? `HTTP ${status}` : String(error).slice(0, 80);
    console.log(`  ↻ 一時的な取得失敗 (${reason})。${nextAttempt}/3 回目を試します`);
  },
});

/** src/ の下のファイル数。**「コマンドが成功した」と「届いた」は別のこと**です。 */
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

const { must, report } = createCheckHarness();

console.log(`\n公開先: ${base}\n`);

/* --- 1. レジストリの一覧 ------------------------------------------- */
/** 期待する件数は registry.json から取ります。**書き写しません。** */
const expected = JSON.parse(
  fs.readFileSync(path.join(root, "registry.json"), "utf8"),
).items;

let index = null;
try {
  const res = await publishedFetch(`${base}/r/index.json`);
  must("r/index.json が 200 で取れる", res.ok, `HTTP ${res.status}`);
  must(
    "content-type が JSON",
    /application\/json/.test(res.headers.get("content-type") ?? ""),
    res.headers.get("content-type") ?? "(無し)",
  );
  index = await res.json();
} catch (e) {
  must("r/index.json が JSON として読める", false, String(e).slice(0, 120));
}

must(
  `一覧の件数が registry.json と一致する`,
  index?.items?.length === expected.length,
  `公開 ${index?.items?.length ?? "?"} / 手元 ${expected.length}`,
);

/* --- 2. 全部の項目が取れるか --------------------------------------- */
/* 1 つだけ見ても足りません。**足したものが漏れるのはいつも「一覧の外」**です。
   一覧に載っている全部を実際に取りに行きます。 */
const broken = [];
for (const item of index?.items ?? []) {
  try {
    const res = await publishedFetch(`${base}/r/${item.name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.files) || body.files.length === 0) {
      throw new Error("files が空");
    }
    // 中身が本当に入っているか。空文字でも JSON としては正しいので、そこを見ます。
    if (body.files.some((f) => !f.content)) throw new Error("content が空のファイルがある");
  } catch (e) {
    broken.push(`${item.name}: ${String(e).slice(0, 60)}`);
  }
}
must(
  `全 ${index?.items?.length ?? 0} 項目が取れて、中身が入っている`,
  broken.length === 0,
  broken.slice(0, 3).join(" / "),
);

/* --- 3. 入口の tarball ---------------------------------------------- */
/* 並べて置いたハッシュと、実際に落ちてくるものが一致するか。
   **経路の途中で差し替えられていないこと**を、利用者と同じ手順で確かめます。 */
try {
  const [tgz, sha] = await Promise.all([
    publishedFetch(`${base}/create-nasu-stack.tgz`),
    publishedFetch(`${base}/create-nasu-stack.tgz.sha256`),
  ]);
  must("create-nasu-stack.tgz が 200 で取れる", tgz.ok, `HTTP ${tgz.status}`);
  must("sha256 が 200 で取れる", sha.ok, `HTTP ${sha.status}`);

  const bytes = Buffer.from(await tgz.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  const published = (await sha.text()).trim().split(/\s+/)[0];
  must("tarball のハッシュが公開されている値と一致する", actual === published,
    actual === published ? `${actual.slice(0, 16)}…` : `実物 ${actual.slice(0, 16)}… / 公開 ${published.slice(0, 16)}…`);

  // gzip なので 1f 8b で始まります。HTML のエラーページを掴んでいないかの確認。
  must("tarball が本当に gzip", bytes[0] === 0x1f && bytes[1] === 0x8b,
    `先頭 ${bytes.subarray(0, 2).toString("hex")}`);
} catch (e) {
  must("入口の tarball を確かめられた", false, String(e).slice(0, 120));
}

/* --- 3.5. サイト内のリンクが本当に辿れるか --------------------------
   ----------------------------------------------------------------
   **v0.9b の判定は `.js` と `.css` しか見ていませんでした。**
   その 2 つはバンドラが base 付きで出すので、**最初から壊れていない
   部分だけを確かめていた**ことになります。手書きのリンクは一度も
   見ていませんでした。

   実際、公開したデモは全部のページ間リンクが 404 でした
   （`/Nasu Stack/demo/about/` にあるのに `/about/` を指していた）。
   判定は緑のままです。

   **拡張子で絞りません。** ページに出てくる同一サイトの参照を全部辿ります。
   さらに、HTML に現れない要求（`fetch` されるデータ）は
   **実ブラウザで開いて拾います**。works.json はまさにそれで、
   HTML を読むだけでは永久に見つかりません。
   ---------------------------------------------------------------- */
async function crawl(entry, label) {
  const origin = new URL(entry).origin;
  const seen = new Set();
  const broken = [];
  const queue = [entry];
  /** 辿る上限。無限に広がらないための歯止めです（超えたら印字します）。 */
  const LIMIT = 80;

  while (queue.length && seen.size < LIMIT) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    let res;
    try {
      res = await publishedFetch(url);
    } catch (e) {
      broken.push(`${url} → ${String(e).slice(0, 40)}`);
      continue;
    }
    if (!res.ok) {
      broken.push(`${url} → HTTP ${res.status}`);
      continue;
    }

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) continue;
    const html = await res.text();

    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = m[1];
      // 外部・アンカー・mailto などは辿りません（こちらの責任範囲ではない）
      if (/^(https?:)?\/\//.test(raw) && !raw.startsWith(origin)) continue;
      if (/^(#|mailto:|tel:|data:|javascript:)/.test(raw)) continue;
      let abs;
      try {
        abs = new URL(raw, url).href;
      } catch {
        continue;
      }
      if (!abs.startsWith(origin)) continue;
      if (!seen.has(abs)) queue.push(abs);
    }
  }

  if (seen.size >= LIMIT) log(`${label}: ${LIMIT} 件で打ち切りました（全部は見ていません）`);
  return { visited: seen.size, broken };
}

for (const [name, sub] of [
  ["カタログ", "catalog"],
  ["デモ", "demo"],
  ["日本語デモ", "demo/ja"],
  ["Repository Pulse", "dogfood/repository-pulse"],
  ["Weather Planner", "dogfood/weather-planner"],
]) {
  const entry = `${base}/${sub}/`;
  const res = await publishedFetch(entry).catch(() => null);
  must(`${name}（/${sub}/）が 200 で取れる`, !!res?.ok, `HTTP ${res?.status ?? "接続できず"}`);
  if (!res?.ok) continue;

  const { visited, broken } = await crawl(entry, name);
  must(
    `    ${name}: サイト内の参照が全部辿れる（${visited} 件）`,
    broken.length === 0,
    broken.slice(0, 3).join(" / "),
  );
}

/* --- 3.5. shadcn のディレクトリの要件 -------------------------------
   ディレクトリに載せるには、公開先の root に `registry.json` が要ります。
   `index.json` しか置いていないと、載せてもらえません。

   **content を入れてはいけないのもここです。** 個別の JSON には入りますが、
   一覧に入れると数百 KB になり、同じものが 2 か所に出ます。 */
{
  const url = `${base}/r/registry.json`;
  const res = await publishedFetch(url);
  must("registry.json が 200 で取れる", res.ok, `HTTP ${res.status}`);
  if (res.ok) {
    let doc;
    try {
      doc = await res.json();
    } catch (e) {
      doc = null;
    }
    must(
      "  $schema / name / homepage / items が揃っている",
      !!doc &&
        typeof doc.$schema === "string" &&
        typeof doc.name === "string" &&
        typeof doc.homepage === "string" &&
        Array.isArray(doc.items),
      doc ? Object.keys(doc).join(" ") : "JSON として読めません",
    );
    const items = doc?.items ?? [];
    must(
      "  すべての項目に files がある",
      items.length > 0 && items.every((i) => Array.isArray(i.files) && i.files.length > 0),
      `${items.length} 件`,
    );
    const withContent = items.filter((i) =>
      (i.files ?? []).some((f) => "content" in f),
    );
    must(
      "  一覧に content が入っていない",
      withContent.length === 0,
      withContent.map((i) => i.name).slice(0, 3).join(", "),
    );
  }
}

/* --- 3.6. ページを開いたときに飛ぶ要求 -------------------------------
   **HTML に出てこない URL があります。** `loader={{ url: "/works.json" }}`
   のように、島が動き出してから fetch されるものです。
   HTML を読むだけの検査では、これは永久に見つかりません。

   実際にブラウザで開いて、**失敗した要求を拾います。** */
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  /* **カタログは章ごとに中身が違います。** 既定の章しか開かないと、
     他の章にしか無いものは一度も要求されません。実際 v0.9c では、
     「端末幅」の章にある端末プレビューの iframe が 404 を出したまま、
     この検査は緑でした。だから全部の章を開きます。 */
  const { TAB_KEYS } = await import("../apps/playground/src/tabs.mjs");
  const targets = [
    ...TAB_KEYS.map((k) => [`カタログ(${k})`, `catalog/?tab=${k}`]),
    ["日本語カタログ", "catalog/?lang=ja"],
    ["デモ", "demo/"],
    ["日本語デモ", "demo/ja/"],
  ];
  try {
    for (const [name, sub] of targets) {
      const page = await browser.newPage();
      const failed = [];
      page.on("response", (r) => {
        if (r.status() >= 400) failed.push(`${r.url()} → HTTP ${r.status()}`);
      });
      page.on("requestfailed", (r) => failed.push(`${r.url()} → ${r.failure()?.errorText}`));
      await page.goto(`${base}/${sub}`, { waitUntil: "networkidle", timeout: 30000 });
      // 島が動き出してから飛ぶものがあるので、少し待ちます
      await page.waitForTimeout(1500);
      await page.close();
      must(
        `    ${name}: 開いたときに失敗する要求が無い`,
        failed.length === 0,
        failed.slice(0, 3).join(" / "),
      );
    }

    /* Repository Pulseのdomain dataは外部GitHub APIの責任範囲です。
       Pages smokeでは、同一originのJS/CSSが取れ、公開設定が埋め込まれた
       app shellまで起動することを検査します。GitHubのrate limitを
       Nasu Stackのdeploy失敗へ誤変換しません。 */
    {
      const page = await browser.newPage();
      const failed = [];
      const publishedOrigin = new URL(base).origin;
      page.on("response", (response) => {
        if (
          new URL(response.url()).origin === publishedOrigin &&
          response.status() >= 400
        ) {
          failed.push(`${response.url()} → HTTP ${response.status()}`);
        }
      });
      page.on("requestfailed", (request) => {
        if (new URL(request.url()).origin === publishedOrigin) {
          failed.push(`${request.url()} → ${request.failure()?.errorText}`);
        }
      });
      await page.goto(`${base}/dogfood/repository-pulse/`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const heading = page.getByRole("heading", {
        level: 1,
        name: "See what is moving in a repository.",
      });
      await heading.waitFor({ state: "visible", timeout: 10000 });
      must(
        "    Repository Pulse: 公開設定でapp shellが起動する",
        await heading.isVisible(),
      );
      must(
        "    Repository Pulse: 同一サイトの要求が失敗しない",
        failed.length === 0,
        failed.slice(0, 3).join(" / "),
      );
      await page.close();
    }

    /* Weather Plannerも外部Open-Meteo APIの可用性をPages判定へ混ぜません。
       同一originのassetと、公開設定で起動したapp shellだけを保証します。 */
    {
      const page = await browser.newPage();
      const failed = [];
      const publishedOrigin = new URL(base).origin;
      page.on("response", (response) => {
        if (
          new URL(response.url()).origin === publishedOrigin &&
          response.status() >= 400
        ) {
          failed.push(`${response.url()} → HTTP ${response.status()}`);
        }
      });
      page.on("requestfailed", (request) => {
        if (new URL(request.url()).origin === publishedOrigin) {
          failed.push(`${request.url()} → ${request.failure()?.errorText}`);
        }
      });
      await page.goto(`${base}/dogfood/weather-planner/`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const heading = page.getByRole("heading", {
        level: 1,
        name: "Give the week a little room to change.",
      });
      await heading.waitFor({ state: "visible", timeout: 10000 });
      must(
        "    Weather Planner: 公開設定でapp shellが起動する",
        await heading.isVisible(),
      );
      must(
        "    Weather Planner: 同一サイトの要求が失敗しない",
        failed.length === 0,
        failed.slice(0, 3).join(" / "),
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  /* 黙って飛ばすと「確かめたつもり」になります。
     **CI では飛ばしません。** ここは HTML に出てこない URL を拾う
     唯一の判定なので、入っていないこと自体が設定の誤りです。

     v0.9c まで pages.yml の smoke には playwright が入っておらず、
     **この判定は一度も走っていませんでした。** ログは出ていましたが、
     緑のまま通るので誰も読みません。 */
  const why = String(e).slice(0, 160);
  if (process.env.CI) {
    must("実ブラウザで開いて確かめる（CI では必須）", false, why);
  } else {
    log(`実ブラウザでの確認を飛ばしました: ${why}`);
  }
}

/* --- 4. 存在しない URL のステータス --------------------------------- */
/* handoff の「未検証」3 つ目。**404.html を置いても 404 を返さない**
   ホスティングがあります。そうなると検索エンジンが存在しないページを登録します。
   判定にはせず、**測った値を必ず印字**します（黙って通すと、
   「404 になっているつもり」で終わります）。 */
try {
  const res = await fetch(`${base}/r/does-not-exist.json`, { redirect: "manual" });
  log(`存在しない URL のステータス: ${res.status}`);
  must("存在しない URL に 404 が返る", res.status === 404, `HTTP ${res.status}`);
} catch (e) {
  must("存在しない URL を測れた", false, String(e).slice(0, 120));
}

/* --- 5. 設定ゼロで入るか（owner/repo 形式） ------------------------- *
 * **これは公開後にしか確かめられません。** GitHub が読むのは既定ブランチの
 * registry.json なので、手元の枝では試せません。
 *
 * ここが緑なら、利用者は components.json も registries も要りません。
 * shadcn のディレクトリに載っていなくても部品が入ります。
 *
 * 依存まで辿らせます。**依存が 1 つでも `@nasu/…` に戻っていたら落ちます**
 *（Unknown registry "@nasu"）。 */
const zeroConf = path.join(root, ".verify-published-zeroconf");
try {
  makeFixture(zeroConf, { project: true });
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "shadcn", "dist", "index.js"),
      "add",
      `${REPO}/action-button`,
      "--yes",
    ],
    { cwd: zeroConf, encoding: "utf8", stdio: "pipe" },
  );
  const n = fs.existsSync(path.join(zeroConf, "src"))
    ? countFiles(path.join(zeroConf, "src"))
    : 0;
  must(
    `設定ゼロで入る（npx shadcn add ${REPO}/action-button）`,
    n === 10,
    `${n} ファイル`,
  );
} catch (e) {
  must(
    `設定ゼロで入る（npx shadcn add ${REPO}/action-button）`,
    false,
    (String(e.stdout ?? "") + String(e.stderr ?? e)).slice(-300),
  );
} finally {
  fs.rmSync(zeroConf, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

/* --- まとめ --------------------------------------------------------- */
process.exit(report().ok ? 0 : 1);
