export async function verifyAutosaveState({ page, must }) {
  /* ===== useAutosave: debounce / queue / stale / abort =============== */
  {
    const input = page.getByTestId("autosave-input");
    const state = page.getByTestId("autosave-state");
    const seen = async () => ({
      status: await state.getAttribute("data-status"),
      dirty: await state.getAttribute("data-dirty"),
      calls: JSON.parse((await state.getAttribute("data-calls")) ?? "[]"),
      saved: await state.getAttribute("data-saved"),
      aborts: Number((await state.getAttribute("data-aborts")) ?? -1),
    });

    // debounce 中の値は送らず、最後だけを 1 回送る。
    await input.fill("a");
    await input.fill("ab");
    await input.fill("abc");
    await page.waitForTimeout(500);
    let current = await seen();
    must(
      "高速入力は最新値 1 件へ debounce する",
      JSON.stringify(current.calls) === JSON.stringify(["abc"]),
      JSON.stringify(current.calls),
    );
    must("最新値の保存後は saved", current.status === "saved", current.status);
    must("保存結果は最新値", current.saved === "abc", current.saved);

    // 進行中は壊さず、途中の待機値を捨てて最新だけを次へ送る。
    await input.fill("slow:first");
    await page.getByRole("button", { name: "今すぐ保存" }).click();
    await page.waitForTimeout(100);
    await input.fill("middle");
    await input.fill("final");
    await page.waitForTimeout(900);
    current = await seen();
    must(
      "保存中の変更は途中を捨て、最新値だけを次へ送る",
      JSON.stringify(current.calls.slice(-2)) ===
        JSON.stringify(["slow:first", "final"]),
      JSON.stringify(current.calls),
    );
    must("古い成功responseは最新結果を上書きしない", current.saved === "final", current.saved);

    // 古い失敗も最新値の error にしてはいけない。
    await input.fill("slow:fail");
    await page.getByRole("button", { name: "今すぐ保存" }).click();
    await page.waitForTimeout(100);
    await input.fill("after-stale-error");
    await page.waitForTimeout(900);
    current = await seen();
    must("古い失敗responseは最新値を error にしない", current.status === "saved", current.status);
    must("古い失敗の後も最新値を保存する", current.saved === "after-stale-error", current.saved);

    // 最新値の失敗は保持し、retry / 再編集の両方を選べる。
    await input.fill("fail");
    await page.getByRole("button", { name: "今すぐ保存" }).click();
    await page.waitForTimeout(150);
    current = await seen();
    must("最新値の失敗は error と dirty を公開する", current.status === "error" && current.dirty === "true", `${current.status}/${current.dirty}`);
    const failedCalls = current.calls.length;
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await page.waitForTimeout(150);
    current = await seen();
    must("retry は同じ最新値をもう一度送る", current.calls.length === failedCalls + 1 && current.calls.at(-1) === "fail", JSON.stringify(current.calls));

    await input.fill("recovered");
    await page.getByRole("button", { name: "今すぐ保存" }).click();
    await page.waitForTimeout(150);
    current = await seen();
    must("失敗後の再編集で保存へ復帰できる", current.status === "saved" && current.saved === "recovered", `${current.status}/${current.saved}`);

    // debounce 前の cancel は transport を呼ばない。
    const beforeCancel = current.calls.length;
    await input.fill("cancel-before-start");
    await page.getByRole("button", { name: "未保存を破棄" }).click();
    await page.waitForTimeout(350);
    current = await seen();
    must("debounce 中の cancel は保存を始めない", current.calls.length === beforeCancel, JSON.stringify(current.calls));
    must("cancel 後は dirty を残さない", current.dirty === "false", current.dirty);

    // 進行中は AbortSignal を通知し、遅い結果を state へ戻さない。
    await input.fill("slow:cancel-active");
    await page.getByRole("button", { name: "今すぐ保存" }).click();
    await page.waitForTimeout(80);
    const abortsBefore = (await seen()).aborts;
    await page.getByRole("button", { name: "未保存を破棄" }).click();
    await page.waitForTimeout(120);
    current = await seen();
    must("進行中の cancel は AbortSignal を通知する", current.aborts === abortsBefore + 1, `${abortsBefore} → ${current.aborts}`);
    must("cancelled response は以前の保存結果を変えない", current.saved === "recovered", current.saved);

    await page.getByTestId("autosave-reset").evaluate((button) => button.click());
    await page.waitForTimeout(50);
    current = await seen();
    must(
      "reset は成功値も消して idle へ戻す",
      current.status === "idle" && current.saved === "" && current.dirty === "false",
      `${current.status}/${current.saved}/${current.dirty}`,
    );

    // unmount cleanup でも同じ signal contract を守る。
    const unmountProbe = page.getByTestId("autosave-unmount-probe");
    await unmountProbe.locator("button").filter({ hasText: "start" }).evaluate((button) => button.click());
    await page.waitForTimeout(50);
    await unmountProbe.locator("button").filter({ hasText: "unmount" }).evaluate((button) => button.click());
    await page.waitForTimeout(100);
    must(
      "unmount は進行中の autosave へ abort を通知する",
      (await page.getByTestId("autosave-unmount-aborts").textContent()) === "1",
      await page.getByTestId("autosave-unmount-aborts").textContent(),
    );
  }
}
