/**
 * v0.1（非同期の状態）の実ブラウザ検証。
 */
import { launch, log } from "./_browser.mjs";

const { errors, openTab, finish, must, mustEq } = await launch();
// タブはボタンのクリックではなく URL で開きます。
// 以前はここで getByRole("button") を使っていて、タブを正しい
// role="tab" にした瞬間に見つからなくなりました。URL なら壊れません。
const page = await openTab("state", { width: 900, height: 900 });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

/* 1. 成功パス --------------------------------------------------- */
await page.getByRole("button", { name: "保存する" }).click();
await page.waitForTimeout(200);
const pendingText = await page
  .getByRole("button", { name: /処理中/ })
  .textContent();
must("押している間は pending 表示に変わる", /処理中/.test(pendingText ?? ""), pendingText?.trim());
await page.waitForTimeout(1200);
const successText = await page
  .getByRole("button", { name: /保存しました/ })
  .textContent();
must("終わると success 表示に変わる", /保存しました/.test(successText ?? ""), successText?.trim());

/* 2. 二重送信の防止 ---------------------------------------------
   「押せない」ことではなく「連打しても 1 回しか実行されない」ことを見る。 */
await page.waitForTimeout(2200); // idle へ戻る
await page.getByRole("button", { name: "保存する" }).click({ force: true });
await page.waitForTimeout(150);
const pendingBtn = page.locator("button[aria-busy='true']").first();
must(
  "pending 中は disabled になる",
  (await pendingBtn.getAttribute("disabled")) !== null,
);
mustEq("pending 中の aria-busy", await pendingBtn.getAttribute("aria-busy"), "true");
for (let i = 0; i < 5; i++) {
  await pendingBtn.click({ force: true, timeout: 500 }).catch(() => {});
}
await page.waitForTimeout(1500);
const successCount = await page
  .getByRole("button", { name: /保存しました/ })
  .count();
mustEq("5 回連打しても実行は 1 回だけ", successCount, 1);

/* 3. 失敗パス --------------------------------------------------- */
await page.getByRole("button", { name: "送信する" }).click();
await page.waitForTimeout(1100);
const alertText = (await page.getByRole("alert").first().textContent())?.trim();
must(
  "失敗すると role=alert に文言が出る",
  !!alertText && alertText.length > 0,
  alertText,
);

/* 4. フォームのフィールドエラー --------------------------------- */
await page.fill('input[name="email"]', "bad@example.com");
await page.fill('input[name="password"]', "123");
await page.getByRole("button", { name: "アカウントを作成" }).click();
await page.waitForTimeout(1300);
const fieldErrors = await page
  .locator("form p[role=alert]")
  .allTextContents();
must(
  "フィールド単位のエラーが入力欄の下に出る",
  fieldErrors.length >= 1,
  `${fieldErrors.length} 件`,
);
log("   中身:", JSON.stringify(fieldErrors));

await page.screenshot({
  path: "/home/claude/shots/states-form-errors.png",
  fullPage: false,
});

/* 5. 打ち直すとエラーが消える ------------------------------------ */
await page.fill('input[name="password"]', "longenoughpassword");
await page.waitForTimeout(150);
const afterTyping = await page.locator("form p[role=alert]").allTextContents();
must(
  "打ち直したフィールドのエラーだけ消える",
  afterTyping.length < fieldErrors.length,
  `${fieldErrors.length} 件 → ${afterTyping.length} 件`,
);

/* 6. 一覧の失敗 → 再試行 ---------------------------------------- */
await page.getByRole("button", { name: "失敗", exact: true }).click();
// useResource は既定で 1 回リトライするので、700ms x2 + 待ち時間より長く待つ
await page.waitForTimeout(4000);
const retry = page.getByRole("button", { name: "再試行" });
must("取得に失敗したら再試行ボタンが出る", await retry.isVisible());

/* 7. 空状態 ------------------------------------------------------ */
await page.getByRole("button", { name: "空", exact: true }).click();
await page.waitForTimeout(1400);
must(
  "0 件のときは空メッセージが出る",
  await page.getByText("まだデータがありません").isVisible(),
);

/* 8. 中断 -------------------------------------------------------- */
await page.getByRole("button", { name: "重い処理を実行" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "中断" }).click();
await page.waitForTimeout(400);
const status = (await page.getByText(/^status:/).textContent())?.trim();
must(
  "中断すると status が pending のまま残らない",
  !/pending/.test(status ?? ""),
  status,
);

await finish();
