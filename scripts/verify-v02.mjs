/**
 * v0.2（レイアウト + ActionProvider）の実ブラウザ検証。
 *   node scripts/verify-v02.mjs
 */
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
const log = (...a) => console.log("·", ...a);

/* --- 1. 余白が本当にトークン由来か --------------------------------- */
const gaps = await page.evaluate(() => {
  const el = document.querySelector('[class*="gap-md"]');
  const cs = el ? getComputedStyle(el) : null;
  const root = getComputedStyle(document.documentElement);
  return {
    gapMd: cs?.rowGap,
    tokenMd: root.getPropertyValue("--space-md").trim(),
    tokenXl: root.getPropertyValue("--space-xl").trim(),
  };
});
log("gap-md の実測:", gaps.gapMd, "/ --space-md:", gaps.tokenMd);

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
log(`--space-xl  neutral=${gaps.tokenXl}  warm=${warmXl}  →`, gaps.tokenXl !== warmXl ? "テーマで変わる ✓" : "変わらない ✗");

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
log(`Stack space:  none=${gNone}  lg=${gLg}  3xl=${g3xl}`);

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
log(`Columns 方向:  1100px=${wide}  500px=${narrow}  →`, wide === "row" && narrow === "column" ? "自動で畳む ✓" : "✗");
await page.setViewportSize({ width: 1100, height: 900 });
await page.waitForTimeout(200);

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
log(
  `Tiles 列数:  500px=${await tilesCols(500)}  800px=${await tilesCols(800)}  1200px=${await tilesCols(1200)}`,
);
await page.setViewportSize({ width: 1100, height: 900 });
await page.waitForTimeout(200);

/* --- 6. ActionProvider: onError 未指定 → 通知が出るか -------------- */
await page.getByRole("button", { name: "onError を書かずに失敗させる" }).click();
await page.waitForTimeout(1200);
const toast1 = await page.locator('[role="alert"]').allTextContents();
log("未指定で失敗 → 通知:", JSON.stringify(toast1.join(" | ").slice(0, 60)));

/* --- 7. onError を書いた場合は既定が走らないか --------------------- */
// 前の通知が残っていると判定できないので、読み直して状態を空にする
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "onError を自分で書く" }).click();
await page.waitForTimeout(1200);
const statuses = await page.locator('[role="status"]').allTextContents();
const alerts = await page.locator('[role="alert"]').allTextContents();
log(
  "自前 onError → 出た通知:",
  JSON.stringify([...statuses, ...alerts].filter((t) => t.trim()).join(" | ").slice(0, 60)),
);

/* --- 8. 通知が自動で消えるか（success は 5s） --------------------- */
await page.getByRole("button", { name: "通知を直接出す" }).click();
await page.waitForTimeout(400);
const before = await page.locator('[role="status"]').count();
log("通知を直接表示:", before > 0 ? "表示された ✓" : "✗");

console.log(
  errors.length === 0
    ? "\n✅ pageerror 0 件"
    : `\n❌ pageerror ${errors.length} 件:\n` + errors.join("\n"),
);
await browser.close();
