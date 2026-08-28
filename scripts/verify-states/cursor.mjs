export async function verifyCursorState({ page, must }) {
  /* ===== LoadMoreList / useCursorList =============================== */
  {
    const demo = page.getByTestId("load-more-demo");
    const probe = page.getByTestId("load-more-probe");
    const seen = async () => ({
      calls: JSON.parse((await probe.getAttribute("data-calls")) ?? "[]"),
      aborts: Number((await probe.getAttribute("data-aborts")) ?? -1),
    });
    const callCount = async (name) =>
      (await seen()).calls.filter((value) => value === name).length;

    await demo.getByText("cursor一覧の最初の記事").waitFor({ state: "visible" });
    must(
      "Load moreは最初のpageだけを自動取得する",
      (await callCount("normal:initial")) === 1,
      JSON.stringify((await seen()).calls),
    );
    await page.waitForTimeout(850);
    must(
      "自動infinite scrollで次pageを取得しない",
      (await callCount("normal:page-2")) === 0,
      JSON.stringify((await seen()).calls),
    );

    // componentのdisabled再描画に頼らず、hookを同じtaskで5回直接呼びます。
    const raceState = page.getByTestId("cursor-hook-race-state");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="cursor-hook-race-state"]')
          ?.getAttribute("data-status") === "success",
    );
    await page
      .getByTestId("cursor-hook-race-run")
      .evaluate((button) => button.click());
    await page.waitForTimeout(30);
    const raceCalls = JSON.parse(
      (await raceState.getAttribute("data-calls")) ?? "[]",
    );
    must(
      "useCursorListを同期的に5回呼んでも同じcursorは1 request",
      raceCalls.filter((value) => value === "next").length === 1,
      JSON.stringify(raceCalls),
    );

    let loadButton = demo.getByRole("button", { name: "さらに読み込む" });
    await loadButton.focus();
    await loadButton.evaluate((button) => {
      for (let index = 0; index < 5; index++) button.click();
    });
    await page.waitForTimeout(80);
    must(
      "Load more buttonの連打もpage-2を1回だけ取得する",
      (await callCount("normal:page-2")) === 1,
      JSON.stringify((await seen()).calls),
    );
    const pendingMore = demo.getByRole("button", {
      name: "次のpageを読込中…",
    });
    must(
      "追加取得中は同じ位置のbuttonをdisabled / aria-busyにする",
      (await pendingMore.isDisabled()) &&
        (await pendingMore.getAttribute("aria-busy")) === "true",
    );
    await demo.getByText("追加された記事A").waitFor({ state: "visible" });
    must(
      "次pageは既存itemを消さず後ろへ追加する",
      (await demo.locator("li").count()) === 4,
      `${await demo.locator("li").count()} items`,
    );
    loadButton = demo.getByRole("button", { name: "さらに読み込む" });
    must(
      "追加後もLoad more buttonへfocusを保つ",
      await loadButton.evaluate((button) => document.activeElement === button),
    );

    await loadButton.click();
    const end = demo.getByText("すべての記事を読み込みました。");
    await end.waitFor({ state: "visible" });
    must(
      "nextCursorが無ければ5件を残してend stateにする",
      (await demo.locator("li").count()) === 5 &&
        (await demo.getByRole("button", { name: "さらに読み込む" }).count()) === 0,
    );
    must(
      "末尾でbuttonを外すとend stateへfocusを移す",
      await end.evaluate((element) => document.activeElement === element),
    );

    // errorになっても前pageを残し、失敗したcursorだけをretryします。
    await page.getByRole("button", { name: "次page失敗" }).click();
    await demo.getByText("cursor一覧の最初の記事").waitFor({ state: "visible" });
    await demo.getByRole("button", { name: "さらに読み込む" }).click();
    const loadError = demo.getByRole("alert");
    await loadError.waitFor({ state: "visible" });
    must(
      "次page失敗でも取得済み2件を残す",
      (await demo.locator("li").count()) === 2,
      `${await demo.locator("li").count()} items`,
    );
    const retryPage = demo.getByRole("button", { name: "このpageを再試行" });
    must(
      "Load more失敗後はretry buttonへfocusを移す",
      await retryPage.evaluate((button) => document.activeElement === button),
    );
    await retryPage.click();
    await demo.getByText("追加された記事A").waitFor({ state: "visible" });
    must(
      "retryはinitialを取り直さず失敗したpage-2だけを再実行する",
      (await callCount("error:initial")) === 1 &&
        (await callCount("error:page-2")) === 2,
      JSON.stringify((await seen()).calls),
    );

    // transportがabortを無視して遅れて成功しても、deps変更後へ混ぜません。
    await page.getByRole("button", { name: "通常のcursor list" }).click();
    await demo.getByText("cursor一覧の最初の記事").waitFor({ state: "visible" });
    const abortsBefore = (await seen()).aborts;
    await demo.getByRole("button", { name: "さらに読み込む" }).click();
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "空のcursor list" }).click();
    must(
      "deps変更renderでは前queryのitemを即座に隠す",
      (await demo.getByText("cursor一覧の最初の記事").count()) === 0,
    );
    await demo.getByText("記事はまだありません。").waitFor({ state: "visible" });
    await page.waitForTimeout(650);
    const afterReset = await seen();
    must(
      "AbortSignalを無視した古い成功responseも新しいlistへ戻さない",
      (await demo.locator("li").count()) === 0 &&
        (await demo.getByText("追加された記事A").count()) === 0 &&
        (await demo.getByText("記事はまだありません。").isVisible()),
    );
    must(
      "deps変更は進行中transportへabortを通知する",
      afterReset.aborts === abortsBefore + 1,
      `${abortsBefore} → ${afterReset.aborts}`,
    );

    await page.getByRole("button", { name: "0件だが次があるpage" }).click();
    await demo.getByText("記事はまだありません。").waitFor({ state: "visible" });
    must(
      "0件でもnextCursorがあれば真の末尾にせずLoad moreを残す",
      await demo.getByRole("button", { name: "さらに読み込む" }).isVisible(),
    );
    await demo.getByRole("button", { name: "さらに読み込む" }).click();
    await demo.getByText("追加された記事A").waitFor({ state: "visible" });
    must(
      "空pageの次も通常どおりappendできる",
      (await demo.locator("li").count()) === 2,
      `${await demo.locator("li").count()} items`,
    );

    await page.getByRole("button", { name: "cursor loop" }).click();
    await demo.getByText("cursor一覧の最初の記事").waitFor({ state: "visible" });
    await demo.getByRole("button", { name: "さらに読み込む" }).click();
    await demo.getByRole("alert").waitFor({ state: "visible" });
    must(
      "既出cursorへ戻るpageはCURSOR_LOOPでfail closedにする",
      (await demo.locator('[data-cursor-error-code="CURSOR_LOOP"]').count()) === 1,
    );
    must(
      "cursor loopのitemsをappendしない",
      (await demo.getByText("追加してはいけないloop結果").count()) === 0 &&
        (await demo.locator("li").count()) === 2,
    );

    await page.getByRole("button", { name: "不正なcursor page" }).click();
    await demo.getByRole("alert").waitFor({ state: "visible" });
    must(
      "itemsがarrayでないresponseはINVALID_CURSOR_PAGEになる",
      (await demo.locator('[data-cursor-error-code="INVALID_CURSOR_PAGE"]').count()) === 1,
    );

    await page.getByRole("button", { name: "通常のcursor list" }).click();
    await demo
      .getByText(/LoadMoreResultWithAnIntentionallyLong/)
      .waitFor({ state: "visible" });
    await page.setViewportSize({ width: 320, height: 900 });
    const overflow = await page.evaluate(() => ({
      document:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      demo: (() => {
        const element = document.querySelector('[data-testid="load-more-demo"]');
        return element ? element.scrollWidth - element.clientWidth : -1;
      })(),
    }));
    must(
      "長いcursor resultも320pxで横にはみ出さない",
      overflow.document <= 1 && overflow.demo <= 1,
      JSON.stringify(overflow),
    );
    await page.setViewportSize({ width: 900, height: 900 });
  }
}
