export async function verifyPaginator({ openTab, must, mustEq }) {
  /* ===== Paginator: URL / 省略 / 読み上げ / 320px =================== */
  {
    const page = await openTab("nav", { width: 320, height: 900 });
    const pager = page.getByTestId("paginator-large");

    const middle = await pager.evaluate((root) => {
      const targets = [...root.querySelectorAll("a,[aria-current='page'],[aria-disabled='true']")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
        });
      return {
        current: root.getAttribute("data-current-page"),
        currentLabel: root.querySelector('[aria-current="page"] .sr-only')?.textContent?.trim(),
        previousHref: root.querySelector('a[rel="prev"]')?.getAttribute("href"),
        nextHref: root.querySelector('a[rel="next"]')?.getAttribute("href"),
        links: root.querySelectorAll("a").length,
        listItems: root.querySelectorAll("li").length,
        ellipses: [...root.querySelectorAll('[aria-hidden="true"]')]
          .filter((element) => element.textContent?.trim() === "…").length,
        targets,
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    must(
      "Paginator A. 1000 pageでもDOM数を抑え、中央の両側をellipsisにする",
      middle.current === "500" &&
        middle.links <= 6 &&
        middle.listItems <= 9 &&
        middle.ellipses === 2,
      JSON.stringify(middle),
    );
    must(
      "    現在位置と前後linkの実URLを辿れる",
      middle.currentLabel === "ページ 500" &&
        /page=499/.test(middle.previousHref ?? "") &&
        /page=501/.test(middle.nextHref ?? ""),
      JSON.stringify(middle),
    );
    must(
      "    320pxでdocumentをはみ出さず、操作targetを40px未満へ潰さない",
      middle.documentOverflow <= 0 &&
        middle.targets.every((size) => {
          const [width, height] = size.split("x").map(Number);
          return width >= 40 && height >= 40;
        }),
      JSON.stringify(middle),
    );

    await pager.getByRole("link", { name: "ページ 499" }).click();
    mustEq(
      "Paginator B. 通常clickをclient router callbackへ渡す",
      await pager.getAttribute("data-current-page"),
      "499",
    );
    must(
      "    callback後もURLとstateが同じpageを指す",
      new URL(page.url()).searchParams.get("page") === "499",
      page.url(),
    );

    const modified = await pager.evaluate((root) => {
      const before = root.getAttribute("data-current-page");
      const target = root.querySelector('a[rel="next"]');
      let prevented = null;
      const observe = (event) => {
        prevented = event.defaultPrevented;
        // test自体のnavigationだけを止めます。React handlerがpreventしたかは
        // このdocument listenerへ来た時点で既に観測できます。
        event.preventDefault();
      };
      document.addEventListener("click", observe, { once: true });
      target?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
          ctrlKey: true,
        }),
      );
      return {
        before,
        after: root.getAttribute("data-current-page"),
        preventedByComponent: prevented,
      };
    });
    must(
      "Paginator C. modifier clickを横取りせずnative link経路へ残す",
      modified.before === modified.after && modified.preventedByComponent === false,
      JSON.stringify(modified),
    );

    await page.getByRole("button", { name: "中間へ" }).click();
    const next = pager.locator('a[rel="next"]');
    await next.focus();
    await page.keyboard.press("Enter");
    mustEq(
      "Paginator D. 前後linkをkeyboardで実行できる",
      await pager.getAttribute("data-current-page"),
      "501",
    );

    await page.getByRole("button", { name: "先頭へ" }).click();
    const first = await pager.evaluate((root) => ({
      current: root.getAttribute("data-current-page"),
      previousLink: root.querySelector('a[rel="prev"]') !== null,
      previousDisabled:
        root.querySelector('[aria-disabled="true"]')?.getAttribute("aria-label"),
      firstNumbers: [...root.querySelectorAll('[aria-current="page"],a[aria-label^="ページ "]')]
        .map((element) =>
          element.hasAttribute("aria-current")
            ? root.getAttribute("data-current-page")
            : element.textContent?.trim(),
        ),
    }));
    must(
      "Paginator E. 先頭ではpreviousをTab順から外し、近いpageを省略しない",
      first.current === "1" &&
        !first.previousLink &&
        first.previousDisabled === "前のページ" &&
        ["1", "2", "3", "4", "5"].every((number) =>
          first.firstNumbers.includes(number),
        ),
      JSON.stringify(first),
    );

    await page.getByRole("button", { name: "末尾へ" }).click();
    const last = await pager.evaluate((root) => ({
      current: root.getAttribute("data-current-page"),
      nextLink: root.querySelector('a[rel="next"]') !== null,
      disabled: [...root.querySelectorAll('[aria-disabled="true"]')]
        .map((element) => element.getAttribute("aria-label")),
      lastNumbers: [...root.querySelectorAll('[aria-current="page"],a[aria-label^="ページ "]')]
        .map((element) =>
          element.hasAttribute("aria-current")
            ? root.getAttribute("data-current-page")
            : element.textContent?.trim(),
        ),
    }));
    must(
      "Paginator F. 末尾ではnextをTab順から外し、末尾付近を省略しない",
      last.current === "1000" &&
        !last.nextLink &&
        last.disabled.includes("次のページ") &&
        ["996", "997", "998", "999", "1000"].every((number) =>
          last.lastNumbers.includes(number),
        ),
      JSON.stringify(last),
    );

    const small = await page.evaluate(() => {
      const read = (testId) => {
        const root = document.querySelector(`[data-testid="${testId}"]`);
        return {
          links: root?.querySelectorAll("a").length,
          disabled: root?.querySelectorAll('[aria-disabled="true"]').length,
          ellipses: [...(root?.querySelectorAll('[aria-hidden="true"]') ?? [])]
            .filter((element) => element.textContent?.trim() === "…").length,
          pages: [...(root?.querySelectorAll('[aria-current="page"],a[aria-label^="ページ "]') ?? [])]
            .map((element) =>
              element.hasAttribute("aria-current")
                ? root?.getAttribute("data-current-page")
                : element.textContent?.trim(),
            ),
          listItems: root?.querySelectorAll("li").length,
        };
      };
      return {
        one: read("paginator-one"),
        five: read("paginator-five"),
        hostile: read("paginator-hostile-count"),
      };
    });
    must(
      "Paginator G. 1 pageでは移動linkもellipsisも作らない",
      small.one.links === 0 &&
        small.one.disabled === 2 &&
        small.one.ellipses === 0 &&
        JSON.stringify(small.one.pages) === JSON.stringify(["1"]),
      JSON.stringify(small.one),
    );
    must(
      "    2〜5 pageの範囲では全pageを出しellipsisを作らない",
      small.five.ellipses === 0 &&
        JSON.stringify(small.five.pages) ===
          JSON.stringify(["1", "2", "3", "4", "5"]),
      JSON.stringify(small.five),
    );
    must(
      "    巨大な表示countを誤指定してもDOM数に上限がある",
      small.hostile.listItems <= 45 && small.hostile.ellipses === 2,
      JSON.stringify(small.hostile),
    );

    await page.close();
  }
}
