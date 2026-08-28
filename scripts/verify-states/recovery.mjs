export async function verifyRecoveryState({ page, must }) {
  /* 6. 一覧の失敗 → 再試行 ---------------------------------------- */
  await page.getByRole("button", { name: "失敗", exact: true }).click();
  // useResource は既定で 1 回リトライするので、700ms x2 + 待ち時間より長く待つ
  await page.waitForTimeout(4000);
  const retry = page
    .locator("button:not([disabled])")
    .filter({ hasText: /^再試行$/ });
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
  /* **印で名指しします。** 文字で探すと、同じ書き方の表示が増えた瞬間に
     「2 つ見つかった」で落ちます（実際 v0.9e で落ちました）。 */
  const status = (await page.getByTestId("abort-status").textContent())?.trim();
  must(
    "中断すると status が pending のまま残らない",
    !/pending/.test(status ?? ""),
    status,
  );

  /* ===== guard を待っている間の中断（外部レビュー P1-02） ============
     v0.9d までは AbortController を guard の**後**に作っていたので、
     確認や通信を待っている間に中断しても止まりませんでした。
     画面を離れた後に削除や決済が始まる、という壊れ方をします。

     **見た目では分かりません。** action が何回呼ばれたかを数えます。 */
  {
    const num = async (id) =>
      Number((await page.getByTestId(id).textContent())?.match(/\d+/)?.[0] ?? -1);

    /* **名前は他と重ならないものにします。** 「中断」は AbortSection にもあり、
       どちらを押しているのか分からない検査になります。 */
    const runBtn = page.getByRole("button", { name: "確認してから実行" });
    const abortBtn = page.getByRole("button", { name: "確認中にやめる" });

    // 1. guard を待っている間に中断 → action は 0 回
    await runBtn.click();
    await page.waitForTimeout(200); // guard は 1000ms 待つ
    await abortBtn.click();
    await page.waitForTimeout(1600); // guard が解けきるまで待つ
    must("guard を待っている間に中断したら action は動かない", (await num("guard-calls")) === 0, `${await num("guard-calls")} 回`);

    // 2. 中断したあと、もう一度実行すれば動く（止めすぎていないか）
    await runBtn.click();
    await page.waitForTimeout(1600);
    must("  中断のあと、もう一度実行すれば動く", (await num("guard-calls")) === 1, `${await num("guard-calls")} 回`);

    // 3. guard を待っている間に画面から消す → action は増えない
    await runBtn.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "画面から消す" }).click();
    await page.waitForTimeout(1600);
    must("guard を待っている間に画面を離れたら action は動かない", (await num("guard-calls")) === 1, `${await num("guard-calls")} 回`);

    // 4. ここまでで握られなかった失敗が 0 件
    must("握られなかった失敗が出ていない", (await num("unhandled-rejections")) === 0, `${await num("unhandled-rejections")} 件`);
  }
}
