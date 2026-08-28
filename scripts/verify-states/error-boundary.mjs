export async function verifyErrorBoundaryState({ page, must }) {
  /* ===== ErrorBoundary: render failure だけを局所化 ================== */
  {
    const sibling = page.getByTestId("error-boundary-sibling");
    must("ErrorBoundary の sibling は最初から利用できる", await sibling.isVisible());

    await page.getByRole("button", { name: "この範囲だけを壊す" }).click();
    const fallback = page.locator("[data-error-boundary-fallback]").first();
    await fallback.waitFor({ state: "visible" });
    must("render failure は subtree の fallback に閉じ込める", await fallback.isVisible());
    must("render failure 後も sibling は残る", await sibling.isVisible());
    must(
      "fallback は role=alert を持つ",
      (await fallback.getAttribute("role")) === "alert",
      await fallback.getAttribute("role"),
    );
    must(
      "render failure 後は fallback へ focus する",
      await fallback.evaluate((element) => document.activeElement === element),
    );
    must(
      "onError は render failure 1 回につき 1 回",
      (await sibling.textContent())?.includes("1") ?? false,
      await sibling.textContent(),
    );

    await page.getByRole("button", { name: "もう一度試す" }).click();
    must(
      "retry で壊れた subtree を新しく mount できる",
      await page.getByRole("button", { name: "この範囲だけを壊す" }).isVisible(),
    );

    const probes = page.getByTestId("error-boundary-probes");
    await probes
      .locator("button")
      .filter({ hasText: /^callback probe$/ })
      .evaluate((button) => button.click());
    await page.waitForTimeout(100);
    must(
      "onError callback が throw しても fallback を失わない",
      (await probes.locator("[data-error-boundary-fallback]").count()) === 1,
    );

    await probes
      .locator("button")
      .filter({ hasText: /^fallback probe$/ })
      .evaluate((button) => button.click());
    await page.waitForTimeout(100);
    must(
      "独自 fallback 自身が壊れても最小 fallback を残す",
      (await probes.locator("[data-error-boundary-last-resort]").count()) === 1,
    );

    await probes
      .locator("button")
      .filter({ hasText: /^reset probe$/ })
      .evaluate((button) => button.click());
    await page.waitForTimeout(100);
    must(
      "resetKeys probe は最初にfallbackへ入る",
      (await probes.locator("[data-error-boundary-fallback]").count()) === 2,
    );
    await probes
      .locator("button")
      .filter({ hasText: /^change reset key$/ })
      .evaluate((button) => button.click());
    await page
      .getByTestId("error-boundary-reset-recovered")
      .waitFor({ state: "attached" });
    must(
      "resetKeys が変わるとsubtreeを自動復帰する",
      (await page.getByTestId("error-boundary-reset-recovered").count()) === 1 &&
        (await probes.locator("[data-error-boundary-fallback]").count()) === 1,
    );
  }
}
