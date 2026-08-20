/**
 * v0.2（レイアウト + ActionProvider）の実ブラウザ検証。
 */
import { launch, log } from "./_browser.mjs";

const { openTab, finish, must, mustEq } = await launch();
const page = await openTab("layout", { width: 1100, height: 900 });

/* --- 1. 余白が本当にトークン由来か ---------------------------------
   トークンは rem で書かれ、実測値は px で返ります。単純に文字列で
   比べると 1rem と 16px が食い違って落ちるので、**段階の一覧を px に
   直してから、実測値がその中にあるか**を見ます。
   「トークン由来であること」が確かめたい性質で、
   「たまたま md であること」ではありません。 */
const gaps = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  // 段階の値を px に直す（probe に入れて実測する）
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const toPx = (v) => {
    probe.style.width = v;
    return getComputedStyle(probe).width;
  };
  const steps = ["none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"]
    .map((k) => root.getPropertyValue(`--space-${k}`).trim())
    .filter(Boolean);
  const stepsPx = steps.map(toPx);
  const el = document.querySelector(".wt-gap");
  const gap = el ? getComputedStyle(el).rowGap : null;
  probe.remove();
  return {
    gap,
    stepsPx,
    tokenMd: root.getPropertyValue("--space-md").trim(),
    tokenXl: root.getPropertyValue("--space-xl").trim(),
  };
});
must(
  "wt-gap の余白が、段階のどれかと一致する（べた書きでない）",
  gaps.stepsPx.includes(gaps.gap),
  `実測 ${gaps.gap} / 段階 ${gaps.stepsPx.join(" ")}`,
);

/* --- 1.5 Tailwind の max-w-prose も同じトークンを見るか -----------
   `ContentBlock width="prose"` は --width-prose を直接使いますが、
   `max-w-prose` は接続しないと Tailwind 標準の 65ch になります。
   ch はフォント依存なので、Windows では 40em 以下、Linux の CI では
   41em になり、同じ英語の段落が環境によって通ったり落ちたりしました。 */
const proseWidth = await page.evaluate(() => {
  const actual = document.createElement("p");
  actual.className = "max-w-prose text-sm";
  actual.style.position = "absolute";
  actual.style.visibility = "hidden";

  const expected = document.createElement("p");
  expected.className = "text-sm";
  expected.style.position = "absolute";
  expected.style.visibility = "hidden";
  expected.style.width = "var(--width-prose)";

  document.body.append(actual, expected);
  const actualPx = parseFloat(getComputedStyle(actual).maxWidth);
  const expectedPx = expected.getBoundingClientRect().width;
  actual.remove();
  expected.remove();
  return { actualPx, expectedPx };
});
must(
  "max-w-prose が本文幅のトークンと一致する",
  Math.abs(proseWidth.actualPx - proseWidth.expectedPx) <= 0.5,
  `max-w-prose=${Math.round(proseWidth.actualPx)}px / --width-prose=${Math.round(proseWidth.expectedPx)}px`,
);

/* --- 2. テーマを変えると余白そのものが変わるか --------------------- */
await page.evaluate(() => {
  document.documentElement.dataset.theme = "warm";
});
await page.waitForTimeout(200);
const warmXl = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--space-xl").trim(),
);
await page.evaluate(() => {
  document.documentElement.dataset.theme = "neutral";
});
await page.waitForTimeout(200);
must(
  "テーマを変えると余白そのものが変わる",
  gaps.tokenXl !== warmXl,
  `neutral=${gaps.tokenXl} warm=${warmXl}`,
);

/* --- 3. Stack の space を切り替えると間隔が変わるか ----------------- */
async function stackGap(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const blocks = [...document.querySelectorAll("div")].filter(
      (d) => d.textContent?.trim() === "A" && d.className.includes("bg-accent"),
    );
    const a = blocks[0];
    if (!a) return null;
    const stack = a.parentElement;
    return getComputedStyle(stack).rowGap;
  });
}
const gNone = await stackGap("none");
const gLg = await stackGap("lg");
const g3xl = await stackGap("3xl");
mustEq("Stack space=none は 0px", gNone, "0px");
must(
  "space を上げると間隔が広がる",
  parseFloat(gLg) > 0 && parseFloat(g3xl) > parseFloat(gLg),
  `none=${gNone} lg=${gLg} 3xl=${g3xl}`,
);

/* --- 4. Columns がモバイル幅で縦に畳むか --------------------------- */
async function columnsDirection(width) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    // Columns が出力する「畳む指定つき」のコンテナを探す
    const el = document.querySelector(".flex-col.md\\:flex-row");
    return el ? getComputedStyle(el).flexDirection : null;
  });
}
const wide = await columnsDirection(1100);
const narrow = await columnsDirection(500);
must(
  "Columns は狭い画面で縦に畳む",
  wide === "row" && narrow === "column",
  `1100px=${wide} 500px=${narrow}`,
);
await page.setViewportSize({ width: 1100, height: 900 });
await page.waitForTimeout(200);

/* --- 4.5 段階に無い値も書けるか（自由度の確保） -------------------- */
const custom = page.getByLabel("任意の余白");
const arbitrary = [];
for (const v of ["13px", "2.75rem", "clamp(1rem, 5vw, 4rem)"]) {
  await custom.fill("");
  await custom.fill(v);
  await page.waitForTimeout(200);
  const got = await page.evaluate(() => {
    const blks = [...document.querySelectorAll("div")].filter(
      (d) => d.textContent?.trim() === "A" && d.className.includes("bg-accent"),
    );
    return blks[0] ? getComputedStyle(blks[0].parentElement).rowGap : null;
  });
  arbitrary.push(`${v}→${got}`);
  // 段階に無い値を書いても、そのまま反映されること（自由度の確保）。
  // ここが効かなくなると「既定値はあるが、外れた値も書ける」という
  // この設計の根っこが崩れます。
  must(`段階外の値 ${v} が反映される`, !!got && got !== "0px" && got !== "normal", got);
}

/* --- 5. Tiles の列数がブレークポイントで変わるか ------------------- */
async function tilesCols(width) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const t = [...document.querySelectorAll(".grid")].find(
      (g) => g.children.length === 7,
    );
    return t ? getComputedStyle(t).gridTemplateColumns.split(" ").length : null;
  });
}
const t500 = await tilesCols(500);
const t800 = await tilesCols(800);
const t1200 = await tilesCols(1200);
must(
  "Tiles の列数が画面幅で増える",
  t500 < t800 && t800 <= t1200,
  `500px=${t500} 800px=${t800} 1200px=${t1200}`,
);
await page.setViewportSize({ width: 1100, height: 900 });
await page.waitForTimeout(200);

/* --- 6〜8. ActionProvider -------------------------------------------
   **「状態」の章に移しました。** 余白や段組の話ではないので、
   探しに来る人が見るのはそちらのはずです（v0.9c の指摘 C-2）。 */
const toastPage = await openTab("state", { width: 1100, height: 900 });

/* --- 6. ActionProvider: onError 未指定 → 通知が出るか -------------- */
await toastPage.getByRole("button", { name: "onError を書かずに失敗させる" }).click();
await toastPage.waitForTimeout(1200);
const toast1 = await toastPage.locator('[role="alert"]').allTextContents();
must(
  "onError を書かずに失敗したら、既定の通知が出る",
  toast1.some((t) => t.trim().length > 0),
  toast1.join(" | ").slice(0, 40),
);

/* --- 7. onError を書いた場合は既定が走らないか --------------------- */
// 前の通知が残っていると判定できないので、読み直して状態を空にする
await toastPage.reload({ waitUntil: "networkidle" });
await toastPage.waitForTimeout(400);
await toastPage.getByRole("button", { name: "onError を自分で書く" }).click();
await toastPage.waitForTimeout(1200);
const statuses = await toastPage.locator('[role="status"]').allTextContents();
const alerts = await toastPage.locator('[role="alert"]').allTextContents();
const shown = [...statuses, ...alerts].filter((t) => t.trim());
must(
  "onError を自分で書いたら、既定の通知は走らない",
  alerts.filter((t) => t.trim()).length === 0,
  shown.join(" | ").slice(0, 40) || "(通知なし)",
);

/* --- 8. 通知が自動で消えるか（success は 5s） --------------------- */
await toastPage.getByRole("button", { name: "通知を直接出す" }).click();
await toastPage.waitForTimeout(400);
const before = await toastPage.locator('[role="status"]').count();
must("通知を直接出せる", before > 0, `${before} 件`);

/* --- 9. 広い画面で、本文が器の右端まで届いているか ------------------
   ----------------------------------------------------------------
   **端末幅の検査は 1024px までしか見ません。** それより広い画面で
   「器は広いのに本文だけ半分で止まる」形になっていても、全部緑で通ります。

   生成物にはこの判定がありました（verify-create の 13）。
   **カタログには無かったので、そこだけ左に寄ったまま公開していました**
   （1920px で器 1024 に対し、本文の右端が 1017。右に 431px の空白）。

   本文の 1 行は和文 45em までなので、器を広げるほど余ります。
   埋め方は中身の作り方の問題です（カタログは見出しと本文を横に並べました）。 */
{
  const wide = await openTab("layout", { width: 1920, height: 1000 });
  const m = await wide.evaluate(() => {
    const main = document.querySelector("main");
    const r = main.getBoundingClientRect();
    /* 見るのは**導入の最初の段落**です。
       ----------------------------------------------------------------
       「どこかの段落が右端まで届いていればよい」にすると、パネルの中の
       デモの段落が偶然届いていて通ってしまいます（実測: 導入が左に
       寄ったままでも、別の段落が 1233px まで届いていて緑になりました）。

       見出しも数えません。見出しは器いっぱいに広がるので、
       本文だけ半分で止まっていても「届いている」ことになります。 */
    let widest = 0;
    let text = "";
    for (const el of main.querySelectorAll("p")) {
      if ((el.textContent || "").trim().length < 20) continue;
      const b = el.getBoundingClientRect();
      widest = b.right;
      text = (el.textContent || "").trim().slice(0, 24);
      break;
    }
    // 器の内側（左右の余白を除いた実際の中身の幅）
    const inner = main.querySelector("*");
    const ir = inner ? inner.getBoundingClientRect() : r;
    return { 器の右端: Math.round(ir.right), 本文の右端: Math.round(widest), 器の幅: Math.round(ir.width), text };
  });
  const gap = m["器の右端"] - m["本文の右端"];
  must(
    "9. 広い画面（1920px）で本文が器の右端まで届く",
    gap <= m["器の幅"] * 0.25,
    `器の右端=${m["器の右端"]} 本文の右端=${m["本文の右端"]} 余り=${gap} "${m.text}"`,
  );
  await wide.close();
}

await finish();
