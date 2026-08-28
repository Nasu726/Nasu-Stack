export async function verifyCopyState({ page, must, mustEq }) {
  /* ===== CopyButton / useCopy: success / fallback / race / cleanup === */
  {
    const button = page.getByTestId("copy-main");
    const input = page.getByTestId("copy-text");
    const wrapper = button.locator("..");

    // Clipboard API成功。画面の文字ではなく、browserへ渡した値そのものを見ます。
    await page.evaluate(() => {
      window.__copiedTexts = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copiedTexts.push(text);
          },
        },
      });
    });
    await input.fill("https://example.com/copied?long=value");
    await button.click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status") === "success",
    );
    const modern = await page.evaluate(() => ({
      copied: window.__copiedTexts,
      status: document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status"),
      method: document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-method"),
    }));
    must(
      "CopyButton A. Clipboard API成功をsuccessへ返す",
      modern.status === "success" &&
        modern.method === "clipboard" &&
        JSON.stringify(modern.copied) ===
          JSON.stringify(["https://example.com/copied?long=value"]),
      JSON.stringify(modern),
    );
    must(
      "    成功をpoliteなstatusで読み上げる",
      (await wrapper.getByRole("status").textContent())?.trim() ===
        "クリップボードにコピーしました",
      await wrapper.getByRole("status").textContent(),
    );

    // Clipboard APIが無い環境。programmatic clickなら入力focusを動かさず、
    // temporary textareaを挟んだ後のfocus / selection復帰まで測れます。
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      window.__fallbackValue = null;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: (command) => {
          const active = document.activeElement;
          window.__fallbackValue =
            command === "copy" && active instanceof HTMLTextAreaElement
              ? active.value
              : null;
          return command === "copy";
        },
      });
    });
    await input.focus();
    await input.evaluate((element) => element.setSelectionRange(2, 9));
    await button.evaluate((element) => element.click());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status") === "success",
    );
    const fallback = await page.evaluate(() => {
      const input = document.querySelector('[data-testid="copy-text"]');
      const button = document.querySelector('[data-testid="copy-main"]');
      return {
        value: window.__fallbackValue,
        method: button?.getAttribute("data-copy-method"),
        temporaryTextareas: document.querySelectorAll(
          'textarea[readonly][aria-hidden="true"]',
        ).length,
        focusRestored: document.activeElement === input,
        selection:
          input instanceof HTMLInputElement
            ? `${input.selectionStart}:${input.selectionEnd}`
            : "",
      };
    });
    must(
      "CopyButton B. APIなしではfallbackで同じ文字をcopyする",
      fallback.method === "fallback" &&
        fallback.value === "https://example.com/copied?long=value",
      JSON.stringify(fallback),
    );
    must(
      "    temporary textareaを消し、focusと選択を戻す",
      fallback.temporaryTextareas === 0 &&
        fallback.focusRestored &&
        fallback.selection === "2:9",
      JSON.stringify(fallback),
    );

    // Clipboard APIもfallbackも拒否する場合は、raw errorを表示せずretry可能にする。
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("permission denied", "NotAllowedError");
          },
        },
      });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: () => false,
      });
    });
    await button.click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status") === "error",
    );
    must(
      "CopyButton C. 両経路の拒否はerrorにしてbuttonをretry可能にする",
      (await button.getAttribute("data-copy-status")) === "error" &&
        !(await button.isDisabled()) &&
        (await button.textContent())?.trim() === "もう一度コピー",
      `${await button.getAttribute("data-copy-status")} / ${await button.textContent()}`,
    );
    must(
      "    失敗をrole=alertで読み上げる",
      (await wrapper.getByRole("alert").textContent())?.trim() ===
        "コピーできませんでした",
      await wrapper.getByRole("alert").textContent(),
    );

    // Reactのdisabled描画を待たない同期guard。同じtaskの5 clickでもwriteは1回。
    await page.evaluate(() => {
      window.__copyCalls = 0;
      window.__resolveCopy = null;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () => {
            window.__copyCalls += 1;
            return new Promise((resolve) => {
              window.__resolveCopy = resolve;
            });
          },
        },
      });
      const button = document.querySelector('[data-testid="copy-main"]');
      for (let index = 0; index < 5; index += 1) button?.click();
    });
    mustEq(
      "CopyButton D. 同じbrowser taskで5回押してもwriteは1回",
      await page.evaluate(() => window.__copyCalls),
      1,
    );
    await page.evaluate(() => window.__resolveCopy?.());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status") === "success",
    );

    // 1回目のtimerが残っていると、2回目のsuccessが300msより前に消えます。
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => {} },
      });
    });
    await button.click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-main"]')?.getAttribute("data-copy-status") === "success",
    );
    await page.waitForTimeout(180);
    mustEq(
      "CopyButton E. 2回目のsuccessを1回目のtimerが早く消さない",
      await button.getAttribute("data-copy-status"),
      "success",
    );
    await page.waitForTimeout(150);
    mustEq(
      "    2回目自身のresetAfterでidleへ戻る",
      await button.getAttribute("data-copy-status"),
      "idle",
    );

    // children render関数は全状態を置き換えられる。
    const custom = page.getByTestId("copy-custom");
    await custom.evaluate((element) => element.click());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-custom"]')?.getAttribute("data-copy-status") === "success",
    );
    mustEq(
      "CopyButton F. custom child renderへ状態を渡す",
      (await custom.textContent())?.trim(),
      "custom-success",
    );

    const callbackFailure = page.getByTestId("copy-callback-failure");
    await callbackFailure.evaluate((element) => element.click());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-callback-failure"]')?.getAttribute("data-copy-status") === "success",
    );
    mustEq(
      "    onCopied callbackがthrowしても完了済みcopyはsuccessのまま",
      await callbackFailure.getAttribute("data-copy-status"),
      "success",
    );

    // reset timerがある状態でunmountし、該当timerがclearされたことを直接見る。
    await page.evaluate(() => {
      window.__copyTimerCleared = false;
      window.__copyTimerId = null;
      window.__originalSetTimeout = window.setTimeout;
      window.__originalClearTimeout = window.clearTimeout;
      window.setTimeout = function (handler, delay, ...args) {
        const id = window.__originalSetTimeout.call(window, handler, delay, ...args);
        if (delay === 777) window.__copyTimerId = id;
        return id;
      };
      window.clearTimeout = function (id) {
        if (id === window.__copyTimerId) window.__copyTimerCleared = true;
        return window.__originalClearTimeout.call(window, id);
      };
    });
    const unmount = page.getByTestId("copy-unmount");
    await unmount.evaluate((element) => element.click());
    await page.waitForFunction(
      () => document.querySelector('[data-testid="copy-unmount"]')?.getAttribute("data-copy-status") === "success",
    );
    await page
      .getByTestId("copy-unmount-toggle")
      .evaluate((element) => element.click());
    await page.waitForTimeout(50);
    const timerCleanup = await page.evaluate(() => {
      const result = {
        tracked: window.__copyTimerId !== null,
        cleared: window.__copyTimerCleared,
      };
      window.setTimeout = window.__originalSetTimeout;
      window.clearTimeout = window.__originalClearTimeout;
      return result;
    });
    must(
      "CopyButton G. unmountでreset timerをclearする",
      timerCleanup.tracked && timerCleanup.cleared,
      JSON.stringify(timerCleanup),
    );
  }
}
