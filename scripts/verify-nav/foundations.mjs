/** その要素にフォーカスが当たっているかを、読める形で返します。 */
const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      text: (el.getAttribute("aria-label") || el.textContent || "")
        .trim()
        .slice(0, 20),
    };
  });

export async function verifyNavFoundations({ openTab, must, mustEq, isPainted }) {
  /* ===== 1. アンカーが貼り付いたヘッダに隠れないか ================= */
  {
    const page = await openTab("nav");
    const r = await page.evaluate(() => ({
      scrollPaddingTop: getComputedStyle(document.documentElement)
        .scrollPaddingTop,
      headerH: getComputedStyle(document.documentElement)
        .getPropertyValue("--header-h")
        .trim(),
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    }));
    // 実測で 64px のヘッダに見出しが 64px ぶん完全に隠れていました
    must(
      "1. アンカーがヘッダの下に潜らない（scroll-padding-top がある）",
      parseFloat(r.scrollPaddingTop) > 0,
      JSON.stringify(r),
    );
    must("   ヘッダの高さがトークンとして 1 か所にある", r.headerH.length > 0, r.headerH);
    mustEq("   開閉で横に揺れない（scrollbar-gutter）", r.scrollbarGutter, "stable");
    await page.close();
  }

  /* ===== 2〜4. Dialog ============================================== */
  {
    const page = await openTab("nav");

    await page.getByRole("button", { name: "中央に出す" }).click();
    await page.waitForTimeout(300);


    const opened = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      return {
        modal: d?.matches(":modal") ?? false, // showModal() で開いているか
        backdrop: getComputedStyle(d, "::backdrop").backgroundColor,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        dialogの数: document.querySelectorAll("dialog").length,
      };
    });
    must("2. showModal で開いている（open 属性ではない）", opened.modal, JSON.stringify(opened));
    must("   ::backdrop に色が付く", isPainted(opened.backdrop), opened.backdrop);
    mustEq("   背面のスクロールを止めている", opened.htmlOverflow, "hidden");

    // 背面が本当に動かないか。
    // **window.scrollBy では測れません。** あれはプログラムからの操作で、
    // overflow: hidden でも動いてしまいます。止めたいのは指とホイールなので、
    // 実際のホイール入力を送って測ります。
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.scrollY);
    must("3. ホイールでも背面がスクロールしない", before === after, `${before} → ${after}`);

    /* Tab を 12 回押して、ダイアログの外の**ページ内要素**へ移らないか。
       body に落ちるのは数えません。Chrome はモーダルの端でブラウザ UI
       （アドレスバー等）へ移り、そのとき activeElement が body になります。
       背面は inert なので、ページ内の要素は掴めません。それを確かめます。 */
    let escaped = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const out = await page.evaluate(() => {
        const d = document.querySelector("dialog[open]");
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement)
          return null;
        if (d?.contains(el)) return null;
        return el.tagName.toLowerCase() + ":" + (el.textContent || "").slice(0, 12);
      });
      if (out) escaped.push(out);
    }
    must(
      "4. Tab を 12 回押してもダイアログ外の要素へ移らない",
      escaped.length === 0,
      JSON.stringify(escaped),
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => ({
      open: !!document.querySelector("dialog[open]"),
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
    }));
    must("5. Esc で閉じる", closed.open === false);
    must("   閉じたら背面のスクロールが戻る", closed.htmlOverflow !== "hidden", closed.htmlOverflow);

    await page.close();
  }

  /* ===== 6〜9. Tabs ================================================ */
  {
    const page = await openTab("nav");
    const list = page.locator('[role="tablist"][aria-label="例"]');

    const roving = await page.evaluate(() => {
      const tl = document.querySelector('[role="tablist"][aria-label="例"]');
      return [...(tl?.querySelectorAll('[role="tab"]') ?? [])].map((t) => ({
        label: t.textContent?.trim(),
        tabIndex: t.tabIndex,
        selected: t.getAttribute("aria-selected"),
        controls: t.getAttribute("aria-controls"),
        パネルが存在: !!document.getElementById(t.getAttribute("aria-controls") ?? ""),
      }));
    });
    must(
      "6. Tab キーで止まるタブは 1 つだけ（roving tabindex）",
      roving.filter((t) => t.tabIndex === 0).length === 1,
      JSON.stringify(roving.map((t) => `${t.label}:${t.tabIndex}`)),
    );
    must("   aria-controls の先がすべて実在する", roving.every((t) => t["パネルが存在"]));
    must(
      "   aria-selected が立っているのは 1 つだけ",
      roving.filter((t) => t.selected === "true").length === 1,
    );

    // 矢印キー
    await list.getByRole("tab", { name: "概要" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const t1 = await active(page);
    must("7. → で隣のタブへ移る", t1?.text === "詳細", JSON.stringify(t1));
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const t2 = await active(page);
    must("   無効なタブを飛ばす", t2?.text === "履歴", JSON.stringify(t2));
    await page.keyboard.press("End");
    await page.waitForTimeout(150);
    const t3 = await active(page);
    must("   End で最後のタブへ", t3?.text === "履歴", JSON.stringify(t3));

    // 入力がタブ切り替えで消えないか
    await list.getByRole("tab", { name: "詳細" }).click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder^="何か入力"]').fill("消えないで");
    await list.getByRole("tab", { name: "履歴" }).click();
    await page.waitForTimeout(200);
    await list.getByRole("tab", { name: "詳細" }).click();
    await page.waitForTimeout(200);
    const kept = await page.locator('input[placeholder^="何か入力"]').inputValue();
    must(
      "8. タブを往復しても入力が消えない（既定は hidden で隠すだけ）",
      kept === "消えないで",
      JSON.stringify(kept),
    );

    // 多いタブが潰れずに横スクロールするか。
    // **広い画面では入りきってしまうので、狭くしてから測ります。**
    await page.setViewportSize({ width: 380, height: 900 });
    await page.waitForTimeout(400);
    const many = await page.evaluate(() => {
      const tl = document.querySelector('[role="tablist"][aria-label="たくさんある例"]');
      const first = tl?.querySelector('[role="tab"]');
      const scroller = tl?.parentElement;
      return {
        タブの幅: Math.round(first?.getBoundingClientRect().width ?? 0),
        スクロールできる: (scroller?.scrollWidth ?? 0) > (scroller?.clientWidth ?? 0),
      };
    });
    must(
      "9. タブが多いとき、潰さずに横スクロールする",
      many["スクロールできる"] && many["タブの幅"] > 40,
      JSON.stringify(many),
    );

    /* 横にしか動けない領域は、**ホイールの横の動きを見ないと動きません。**
       指でも矢印キーでも動くので、作った側は気づけません。

       **縦では動いてはいけません。** v0.9c では縦を横へ回していましたが、
       コード例や表の上を通っただけでページの縦読みが止まるので、やめました。

       ここで作る wheel は合成イベントなので、ブラウザ自身のスクロールは
       起きません。**動いたなら、こちらの処理が動いたということです。** */
    const wheel = await page.evaluate(async () => {
      const tl = document.querySelector('[role="tablist"][aria-label="たくさんある例"]');
      const el = tl?.parentElement;
      if (!el) return { 横: -1, 縦: -1 };
      const fire = async (init) => {
        el.scrollLeft = 0;
        el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init }));
        await new Promise((r) => setTimeout(r, 100));
        return el.scrollLeft;
      };
      return { 横: await fire({ deltaX: 120 }), 縦: await fire({ deltaY: 120 }) };
    });
    must("   ホイールの横で横スクロールできる", wheel["横"] > 0, JSON.stringify(wheel));
    must("   ホイールの縦では横に動かない", wheel["縦"] === 0, JSON.stringify(wheel));

    await page.close();
  }

  /* ===== 10〜11. Disclosure / Accordion ============================ */
  {
    const page = await openTab("nav");

    const marker = await page.evaluate(() => {
      // ヘッダのハンバーガーも .wt-summary なので、
      // 広い画面では高さ 0 です。Disclosure のほうを選びます。
      const s = document.querySelector(".wt-disclosure > .wt-summary");
      return {
        listStyle: getComputedStyle(s).listStyleType,
        矢印がある: !!s?.querySelector("svg"),
        高さ: Math.round(s?.getBoundingClientRect().height ?? 0),
      };
    });
    mustEq("10. summary の既定マーカーを消している", marker.listStyle, "none");
    must("    代わりの矢印を出している（消しっぱなしは不可）", marker["矢印がある"]);
    must("    当たり判定が 44px 以上", marker["高さ"] >= 44, `${marker["高さ"]}px`);

    // name 属性の排他がブラウザで効くか
    const accordion = await page.evaluate(() => {
      const all = [...document.querySelectorAll("details[name]")];
      return { 数: all.length, name: all[0]?.getAttribute("name")?.slice(0, 8) };
    });
    const summaries = page.locator("details[name] > summary");
    await summaries.nth(1).click();
    await page.waitForTimeout(250);
    const openCount = await page.evaluate(
      () => document.querySelectorAll("details[name][open]").length,
    );
    must(
      "11. details[name] の排他がブラウザで効く（JS なし）",
      openCount === 1,
      `${accordion["数"]} 個中 開いている=${openCount}`,
    );

    await page.close();
  }

  /* ===== 12〜14. DropdownMenu / NavDropdown ======================== */
  {
    const page = await openTab("nav");

    await page.getByRole("button", { name: "操作", exact: true }).click();
    await page.waitForTimeout(250);
    const m0 = await active(page);
    must("12. 開くとフォーカスが先頭の項目へ移る", m0?.role === "menuitem", JSON.stringify(m0));

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(120);
    const m1 = await active(page);
    must("    ↓ で次の項目へ", m1?.text === "書き出す", JSON.stringify(m1));
    await page.keyboard.press("End");
    await page.waitForTimeout(120);
    const m2 = await active(page);
    must("    End で最後の項目へ（区切り線は飛ばす）", m2?.text === "削除する", JSON.stringify(m2));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const m3 = await active(page);
    must(
      "13. Esc で閉じると、開いたボタンへフォーカスが戻る",
      m3?.tag === "button" && (m3?.text ?? "").startsWith("操作"),
      JSON.stringify(m3),
    );

    // リンクの下ろし物に role=menu を使っていないこと
    await page.getByRole("button", { name: "製品" }).click();
    await page.waitForTimeout(250);
    const navRoles = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim().startsWith("製品"),
      );
      const panel = document.getElementById(btn?.getAttribute("aria-controls") ?? "");
      return {
        タグ: panel?.tagName.toLowerCase(),
        role: panel?.getAttribute("role"),
        中身: panel?.firstElementChild?.firstElementChild?.tagName.toLowerCase(),
        menuitemの数: panel?.querySelectorAll('[role="menuitem"]').length,
      };
    });
    must(
      "14. リンクの下ろし物に role=menu を使っていない",
      navRoles.role === null && navRoles["menuitemの数"] === 0,
      JSON.stringify(navRoles),
    );
    mustEq("    中身はただのリンク", navRoles["中身"], "a");

    await page.close();
  }

  /* ===== Popover foundation ========================================
     固定座標ではなく「viewportの内側」「focusの移り方」という関係を測ります。
     320pxの右端かつ最下部へ置き、希望がbelowでも必要ならaboveへ反転することを
     実際のtouch contextで確かめます。 */
  {
    const page = await openTab("nav", { width: 320, height: 520 });
    const trigger = page.getByRole("button", { name: "詳細を表示" });
    const outside = page.getByTestId("popover-outside-action");

    must(
      "Popover A. defaultOpen のuncontrolled contentが初期描画される",
      (await page.getByTestId("popover-default-open").count()) === 1,
    );

    // scrollIntoViewのbottomはmobile emulationのlayout / visual viewport差で
    // 「指定した520pxの下端」に揃わないことがあります。anchor自体をfixedにし、
    // window.innerWidth / innerHeight上の右端・最下部という前提を確実に作ります。
    await trigger.evaluate((element) => {
      const anchor = element.parentElement;
      if (!anchor) return;
      Object.assign(anchor.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        zIndex: "60",
      });
    });
    await trigger.press("Enter");
    await page.waitForTimeout(250);

    const geometry = await trigger.evaluate((button) => {
      const content = document.getElementById(button.getAttribute("aria-controls") ?? "");
      const rect = content?.getBoundingClientRect();
      return {
        expanded: button.getAttribute("aria-expanded"),
        role: content?.getAttribute("role"),
        placement: content?.getAttribute("data-placement"),
        rect: rect
          ? {
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
            }
          : null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
    const r = geometry.rect;
    must(
      "Popover B. 320pxの右端・最下部でもpanelがviewport内へ収まる",
      !!r &&
        r.left >= 7 &&
        r.top >= 7 &&
        r.right <= geometry.viewport.width - 7 &&
        r.bottom <= geometry.viewport.height - 7,
      JSON.stringify(geometry),
    );
    mustEq("    aria-expanded が開閉状態を表す", geometry.expanded, "true");
    mustEq("    below希望でも下に入らなければaboveへ反転", geometry.placement, "above");
    mustEq("    generic contentへ誤ったroleを足さない", geometry.role, null);

    // DOM順序を保つため、開いた直後のTabはcontent内の最初のbuttonへ進みます。
    await page.keyboard.press("Tab");
    const inside = await active(page);
    must(
      "Popover C. keyboardで開き、次のTabでcontentへ入れる",
      inside?.tag === "button" && inside?.text === "内容から閉じる",
      JSON.stringify(inside),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const afterEscape = await active(page);
    must(
      "    Escで閉じるとtriggerへfocusが戻る",
      afterEscape?.tag === "button" && afterEscape?.text === "詳細を表示",
      JSON.stringify(afterEscape),
    );
    mustEq("    Esc後はcontentを外す", await page.getByTestId("popover-content").count(), 0);

    // content自身の完了buttonで閉じた場合も、消えるbuttonへfocusを残しません。
    await trigger.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const afterContentClose = await active(page);
    must(
      "Popover D. contentのclose()でもtriggerへfocusが戻る",
      afterContentClose?.tag === "button" && afterContentClose?.text === "詳細を表示",
      JSON.stringify(afterContentClose),
    );

    // outside pointerは閉じるだけ。押した先のclickとfocusを奪ってはいけません。
    await trigger.click();
    await outside.click();
    await page.waitForTimeout(200);
    const afterOutside = await page.evaluate(() => ({
      active: document.activeElement?.getAttribute("data-testid"),
      count: document.querySelector('[data-testid="popover-outside-action"]')?.textContent?.trim(),
      content: document.querySelector('[data-testid="popover-content"]') !== null,
    }));
    must(
      "Popover E. outside pointerで閉じても移動先のfocusとclickを奪わない",
      afterOutside.active === "popover-outside-action" &&
        /1$/.test(afterOutside.count ?? "") &&
        !afterOutside.content,
      JSON.stringify(afterOutside),
    );

    // openTabは狭い幅でhasTouch=true。合成pointerではなく実際のtapを送ります。
    await trigger.tap();
    mustEq("Popover F. touchのtapで開く", await trigger.getAttribute("aria-expanded"), "true");
    await outside.tap();
    mustEq("    touchのoutside tapで閉じる", await trigger.getAttribute("aria-expanded"), "false");

    const controlled = page.getByRole("button", { name: "制御されたPopover" });
    await controlled.click();
    mustEq("Popover G. controlled triggerから開く", await controlled.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    mustEq("    controlledでもEscで閉じる", await controlled.getAttribute("aria-expanded"), "false");
    await page.getByRole("button", { name: "親から開閉" }).click();
    mustEq("    親のstateからも開ける", await controlled.getAttribute("aria-expanded"), "true");

    await page.close();
  }
}
