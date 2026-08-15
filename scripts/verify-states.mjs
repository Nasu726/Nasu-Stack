import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
// カタログは「レイアウト」タブが既定なので、状態のデモへ切り替える
await page.getByRole("button", { name: "状態", exact: true }).click();
await page.waitForTimeout(300);

const log = (...a) => console.log("·", ...a);

/* 1. 成功パス --------------------------------------------------- */
await page.getByRole("button", { name: "保存する" }).click();
await page.waitForTimeout(200);
const pendingText = await page
  .getByRole("button", { name: /処理中/ })
  .textContent();
log("pending 表示:", JSON.stringify(pendingText));
await page.waitForTimeout(1200);
log(
  "success 表示:",
  JSON.stringify(
    await page.getByRole("button", { name: /保存しました/ }).textContent(),
  ),
);

/* 2. 二重送信の防止 ---------------------------------------------
   「押せない」ことではなく「連打しても 1 回しか実行されない」ことを見る。 */
await page.waitForTimeout(2200); // idle へ戻る
await page.getByRole("button", { name: "保存する" }).click({ force: true });
await page.waitForTimeout(150);
const pendingBtn = page.locator("button[aria-busy='true']").first();
log(
  "pending 中の属性:",
  `disabled=${(await pendingBtn.getAttribute("disabled")) !== null}`,
  `aria-busy=${await pendingBtn.getAttribute("aria-busy")}`,
);
for (let i = 0; i < 5; i++) {
  await pendingBtn.click({ force: true, timeout: 500 }).catch(() => {});
}
await page.waitForTimeout(1500);
log(
  "連打後に success 状態のボタン数(1 なら二重送信なし):",
  await page.getByRole("button", { name: /保存しました/ }).count(),
);

/* 3. 失敗パス --------------------------------------------------- */
await page.getByRole("button", { name: "送信する" }).click();
await page.waitForTimeout(1100);
const alertText = await page.getByRole("alert").first().textContent();
log("エラー文言:", JSON.stringify(alertText?.trim()));

/* 4. フォームのフィールドエラー --------------------------------- */
await page.fill('input[name="email"]', "bad@example.com");
await page.fill('input[name="password"]', "123");
await page.getByRole("button", { name: "アカウントを作成" }).click();
await page.waitForTimeout(1300);
const fieldErrors = await page
  .locator("form p[role=alert]")
  .allTextContents();
log("フィールドエラー:", fieldErrors);

await page.screenshot({
  path: "/home/claude/shots/states-form-errors.png",
  fullPage: false,
});

/* 5. 打ち直すとエラーが消える ------------------------------------ */
await page.fill('input[name="password"]', "longenoughpassword");
await page.waitForTimeout(150);
const afterTyping = await page.locator("form p[role=alert]").allTextContents();
log("打ち直し後に残るエラー:", afterTyping);

/* 6. 一覧の失敗 → 再試行 ---------------------------------------- */
await page.getByRole("button", { name: "失敗", exact: true }).click();
// useResource は既定で 1 回リトライするので、700ms x2 + 待ち時間より長く待つ
await page.waitForTimeout(4000);
const retry = page.getByRole("button", { name: "再試行" });
log("再試行ボタンが出る:", await retry.isVisible());

/* 7. 空状態 ------------------------------------------------------ */
await page.getByRole("button", { name: "空", exact: true }).click();
await page.waitForTimeout(1400);
log(
  "空メッセージ:",
  JSON.stringify(
    (await page.getByText("まだデータがありません").textContent())?.trim(),
  ),
);

/* 8. 中断 -------------------------------------------------------- */
await page.getByRole("button", { name: "重い処理を実行" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "中断" }).click();
await page.waitForTimeout(400);
const status = await page.getByText(/^status:/).textContent();
log("中断後の status:", JSON.stringify(status?.trim()));

console.log(
  errors.length === 0
    ? "\n✅ コンソールエラー 0 件"
    : `\n❌ コンソールエラー ${errors.length} 件:\n` + errors.join("\n"),
);

await browser.close();
