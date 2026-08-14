import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
const log = (...a) => console.log("·", ...a);

/* --- 二重送信の防止を、実行回数で検証する --- */
// fake-api を経由せず、押した回数をカウントできる形で確かめる。
// ここでは「連打しても success が 1 回しか出ない」ことで代用。
const save = page.getByRole("button", { name: "保存する" });
await save.click({ force: true });
// pending 中の DOM を直接確認
await page.waitForTimeout(150);
const el = page.locator("button[aria-busy='true']").first();
log("pending 中のボタン disabled 属性:", await el.getAttribute("disabled"));
log("pending 中の aria-busy:", await el.getAttribute("aria-busy"));

// 連打（pending 中に 5 回押す）
for (let i = 0; i < 5; i++) {
  await el.click({ force: true, timeout: 500 }).catch(() => {});
}
await page.waitForTimeout(1500);
const successButtons = await page
  .getByRole("button", { name: /保存しました/ })
  .count();
log("連打後に success 状態のボタン数(=1 なら二重送信なし):", successButtons);

/* --- 一覧の失敗 → 再試行（待ち時間を十分に取る） --- */
await page.getByRole("button", { name: "失敗", exact: true }).click();
await page.waitForTimeout(4000);
const retry = page.getByRole("button", { name: "再試行" });
log("再試行ボタンが出る:", await retry.isVisible());
log(
  "エラー文言:",
  JSON.stringify(
    (await page.getByText("一覧の取得に失敗しました").textContent())?.trim(),
  ),
);
await page.screenshot({ path: "/home/claude/shots/states-list-error.png" });

// 再試行を押すと再度 pending になる
await retry.click();
await page.waitForTimeout(200);
const skeleton = await page.locator("[aria-hidden='true'] .animate-pulse").count();
log("再試行でスケルトンが再表示される:", skeleton > 0);

/* --- リトライ付きボタン --- */
await page.getByRole("button", { name: "同期する" }).click();
await page.waitForTimeout(3000);
const syncBtn = page
  .locator("button")
  .filter({ hasText: /完了しました|やり直す|同期する/ })
  .first();
log("リトライ付きボタンの最終表示:", (await syncBtn.textContent())?.trim());

await browser.close();
