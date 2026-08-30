export async function verifySearchState({ page, must }) {
  /* ===== Search list recipe: debounce / stale / abort / retry ======== */
  {
    const demo = page.getByTestId("search-list-demo");
    const input = demo.getByRole("searchbox", { name: "サイト内検索" });
    const probe = page.getByTestId("search-list-probe");
    const seen = async () => ({
      calls: JSON.parse((await probe.getAttribute("data-calls")) ?? "[]"),
      aborts: Number((await probe.getAttribute("data-aborts")) ?? -1),
    });

    const controlledResultsExist = async () => {
      const id = await input.getAttribute("aria-controls");
      return !!id && (await demo.locator(`#${id}`).count()) === 1;
    };

    must(
      "検索前は最小文字数の案内を表示する",
      await demo.getByText("2文字以上入力すると検索します。").isVisible(),
    );
    must(
      "最小文字数未満でもaria-controlsの参照先が存在する",
      await controlledResultsExist(),
    );
    await input.fill("a");
    await page.waitForTimeout(400);
    must(
      "最小文字数未満ではsearch actionを呼ばない",
      (await seen()).calls.length === 0,
      JSON.stringify((await seen()).calls),
    );

    await input.fill("n");
    await input.fill("na");
    await input.fill("nasu");
    must(
      "debounce中もaria-controlsの参照先が存在する",
      await controlledResultsExist(),
    );
    await page.waitForTimeout(550);
    let current = await seen();
    must(
      "高速入力は最後の検索語1件へdebounceする",
      JSON.stringify(current.calls) === JSON.stringify(["nasu"]),
      JSON.stringify(current.calls),
    );
    must(
      "成功すると本物のresult linkを表示する",
      (await demo.locator('a[href="/docs/boundaries"]').count()) === 1,
    );

    // いったん古い結果を成功表示してから、次の語を入力します。
    await input.fill("slow");
    await demo.getByText("古い検索結果").waitFor({ state: "visible" });
    await input.fill("fast");
    must(
      "新しい語のdebounce中は、前の成功結果をすぐ隠す",
      (await demo.getByText("古い検索結果").count()) === 0,
    );

    // 待機表示と結果を同時に残す実装へ戻すと、切替の途中で前の成功結果が
    // 再び現れ得ます。目視では見落とすためMutationObserverでも記録します。
    await demo.evaluate((root) => {
      window.__searchListSawStale = false;
      window.__searchListObserver = new MutationObserver(() => {
        if (root.textContent?.includes("古い検索結果")) {
          window.__searchListSawStale = true;
        }
      });
      window.__searchListObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    await demo.getByText("新しい検索結果").waitFor({ state: "visible" });
    const flashed = await page.evaluate(() => {
      window.__searchListObserver?.disconnect();
      return window.__searchListSawStale;
    });
    must("query切替時に古い成功結果が1 frameも復活しない", !flashed);

    // 今度はslow requestが進行中の間に語を変え、AbortSignalまで届くことを見ます。
    const abortsBefore = (await seen()).aborts;
    await input.fill("slow");
    await page.waitForTimeout(380);
    await input.fill("fast");
    await demo.getByText("新しい検索結果").waitFor({ state: "visible" });
    current = await seen();
    must(
      "新しい検索語は進行中の前requestをabortする",
      current.aborts === abortsBefore + 1,
      `${abortsBefore} → ${current.aborts}`,
    );

    await input.fill("error");
    await demo.getByRole("alert").waitFor({ state: "visible" });
    must(
      "検索失敗は画面内のalertに閉じ込める",
      (await demo.getByRole("alert").textContent())?.includes("検索に失敗しました") ?? false,
    );
    await demo.getByRole("button", { name: "検索を再試行" }).click();
    await demo
      .getByText("再試行で取得できた結果")
      .waitFor({ state: "visible" });
    must(
      "明示的な再試行で同じqueryから復帰できる",
      await demo.getByText("再試行で取得できた結果").isVisible(),
    );

    await input.fill("empty");
    await demo.getByText("一致する結果はありません。").waitFor({ state: "visible" });
    must("0件は空状態として明示する", true);

    // 長い切れないidentifierを実データで戻し、320pxでもpageを押し広げない。
    await input.fill("nasu");
    await demo.locator('a[href="/docs/boundaries"]').waitFor({ state: "visible" });
    await page.setViewportSize({ width: 320, height: 900 });
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      demo: (() => {
        const element = document.querySelector('[data-testid="search-list-demo"]');
        return element ? element.scrollWidth - element.clientWidth : -1;
      })(),
    }));
    must(
      "長い検索結果も320pxで横にはみ出さない",
      overflow.document <= 1 && overflow.demo <= 1,
      JSON.stringify(overflow),
    );
    await page.setViewportSize({ width: 900, height: 900 });

    await input.focus();
    await page.keyboard.press("Tab");
    must(
      "検索結果へTabで移ると本物のlinkへfocusする",
      await demo.locator('a[href="/docs/boundaries"]').evaluate(
        (link) => document.activeElement === link,
      ),
    );
  }
}
