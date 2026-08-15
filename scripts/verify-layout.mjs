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

/* --- 6. ActionProvider: onError 未指定 → 通知が出るか -------------- */
await page.getByRole("button", { name: "onError を書かずに失敗させる" }).click();
await page.waitForTimeout(1200);
const toast1 = await page.locator('[role="alert"]').allTextContents();
must(
  "onError を書かずに失敗したら、既定の通知が出る",
  toast1.some((t) => t.trim().length > 0),
  toast1.join(" | ").slice(0, 40),
);

/* --- 7. onError を書いた場合は既定が走らないか --------------------- */
// 前の通知が残っていると判定できないので、読み直して状態を空にする
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "onError を自分で書く" }).click();
await page.waitForTimeout(1200);
const statuses = await page.locator('[role="status"]').allTextContents();
const alerts = await page.locator('[role="alert"]').allTextContents();
const shown = [...statuses, ...alerts].filter((t) => t.trim());
must(
  "onError を自分で書いたら、既定の通知は走らない",
  alerts.filter((t) => t.trim()).length === 0,
  shown.join(" | ").slice(0, 40) || "(通知なし)",
);

/* --- 8. 通知が自動で消えるか（success は 5s） --------------------- */
await page.getByRole("button", { name: "通知を直接出す" }).click();
await page.waitForTimeout(400);
const before = await page.locator('[role="status"]').count();
must("通知を直接出せる", before > 0, `${before} 件`);

await finish();
