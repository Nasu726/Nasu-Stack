/**
 * v0.6 の検証。docs/plan-v06.md の「実測で確かめる項目」に対応します。
 *
 * ここで測るのは、**目で見ても気づけないもの**です。
 * キーボードだけで操作したときの挙動と、隠れた場所に潜り込む見出し。
 */
import { launch, log, BASE, isPainted } from "./_browser.mjs";

const { openTab, finish, must, mustEq } = await launch();

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

  await page.getByRole("button", { name: "操作" }).click();
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

/* ===== 15〜17. ナビゲーション ====================================
   カタログのデモは「ページの途中に置いた sticky でないヘッダ」なので、
   画面に収まるかの判定には使えません。実際の使われ方に近い
   Astro サイト（上端に貼り付いたヘッダ）で測ります。 */
{
  const page = await openTab("nav", { width: 390, height: 780 });

  const mobile = await page.evaluate(() => {
    const d = document.querySelector("header details");
    const s = d?.querySelector("summary");
    const r = s?.getBoundingClientRect();
    return {
      detailsがある: !!d,
      開いている: d?.open ?? null,
      ハンバーガーの大きさ: `${Math.round(r?.width ?? 0)}x${Math.round(r?.height ?? 0)}`,
    };
  });
  must("15. 狭い画面では details のメニューになる", mobile["detailsがある"], JSON.stringify(mobile));
  mustEq("    ハンバーガーの当たり判定", mobile["ハンバーガーの大きさ"], "44x44");

  await page.close();

  // 実サイト側（上端に貼り付いたヘッダ）
  const site = await (async () => {
    const { chromium } = await import("playwright");
    const b = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
    const ctx = await b.newContext({
      viewport: { width: 390, height: 780 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await ctx.newPage();
    p.on("close", () => b.close());
    await p.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle" });
    return p;
  })();

  await site.locator("header details > summary").first().click();
  await site.waitForTimeout(300);
  const afterOpen = await site.evaluate(() => {
    const d = document.querySelector("header details");
    const nav = d?.querySelector("nav");
    const r = nav?.getBoundingClientRect();
    return {
      開いた: d?.open,
      リンクの数: nav?.querySelectorAll("a").length,
      画面内に収まっている: (r?.bottom ?? 0) <= window.innerHeight + 1,
      パネルの高さ: Math.round(r?.height ?? 0),
    };
  });
  must("16. 実サイトでメニューが開く", afterOpen["開いた"] === true, JSON.stringify(afterOpen));
  must("    開いたパネルが画面内に収まる", afterOpen["画面内に収まっている"]);
  must("    リンクが入っている", (afterOpen["リンクの数"] ?? 0) > 0);

  await site.close();

  // aria-current はカタログのデモで測ります。
  // 実サイトはアンカー（#works）だけのナビなので、
  // どのリンクも「いま開いているページ」ではないのが正しい状態です。
  const cat = await openTab("nav");
  const current = await cat.evaluate(() => {
    const marked = [...document.querySelectorAll('[aria-current="page"]')];
    return marked.map((a) => a.textContent?.trim());
  });
  // 広い画面用と狭い画面用に同じリンクを 2 回書き出すので 2 件が正常です
  must(
    "17. いま開いているページに aria-current が付く",
    current.length === 2 && current.every((t) => t === "料金"),
    JSON.stringify(current),
  );
  await cat.close();
}

/* ===== 18〜19. レイアウトシフトと画像 ============================ */
{
  const page = await openTab("text");

  // 画像を読み込ませて、包んだ側と包まない側のずれを測ります
  const shift = await page.evaluate(async () => {
    let total = 0;
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) total += e.value;
      }
    });
    po.observe({ type: "layout-shift", buffered: true });

    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("画像を読み込む"),
    );
    // 包んだ側・包まない側それぞれの、下にある文章の位置を控えます
    const before = [...document.querySelectorAll("p")]
      .filter((p) => /位置が変わりません|下へ動きます/.test(p.textContent ?? ""))
      .map((p) => Math.round(p.getBoundingClientRect().top));

    btn?.click();
    await new Promise((r) => setTimeout(r, 1200));

    const after = [...document.querySelectorAll("p")]
      .filter((p) => /位置が変わりません|下へ動きます/.test(p.textContent ?? ""))
      .map((p) => Math.round(p.getBoundingClientRect().top));

    po.disconnect();
    return { before, after, cls: Number(total.toFixed(4)) };
  });
  /* 座標そのものを判定にしてはいけません（環境で変わります）。
     判定するのは「片方だけ動いた」という関係です。 */
  const movedUnwrapped = Math.abs(shift.after[0] - shift.before[0]);
  const movedWrapped = Math.abs(shift.after[1] - shift.before[1]);
  must(
    "18. Frame で包むと、画像が届いても下の文章が動かない",
    movedWrapped === 0,
    `包んだ側 ${movedWrapped}px / 包まない側 ${movedUnwrapped}px`,
  );
  must("    包まない側は実際に動く（比較が成立している）", movedUnwrapped > 0, `${movedUnwrapped}px`);

  const imgAttrs = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((i) => ({
      loading: i.loading,
      fetchPriority: i.fetchPriority,
      比率が指定された箱の中: !!i.closest("[style*='aspect-ratio']"),
    })),
  );
  const priority = imgAttrs.find((i) => i["比率が指定された箱の中"]);
  must(
    "19. priority を付けた画像は lazy にならない",
    priority?.loading === "eager" && priority?.fetchPriority === "high",
    JSON.stringify(priority),
  );

  await page.close();
}

/* ===== 20. prose ================================================= */
{
  const page = await openTab("text");
  const prose = await page.evaluate(() => {
    const root = document.querySelector(".wt-prose");
    // 先頭の要素は margin-block-start: 0 にしているので、2 つ目の見出しで測ります
    const h2 = root?.querySelector("h3");
    const p = root?.querySelector("p");
    const pre = root?.querySelector("pre");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      本文の幅: Math.round(root?.getBoundingClientRect().width ?? 0),
      本文のフォント: cs(p)?.fontSize,
      h3の上余白: cs(h2)?.marginBlockStart,
      preの横スクロール: cs(pre)?.overflowX,
      リンクの下線: cs(root?.querySelector("a"))?.textDecorationLine,
      wtProse自身の外余白: `${cs(root)?.marginTop} / ${cs(root)?.marginBottom}`,
    };
  });
  must(
    "20. wt-prose 自身は外側の余白を持たない（原則を守る）",
    prose["wtProse自身の外余白"] === "0px / 0px",
    prose["wtProse自身の外余白"],
  );
  must("    見出しの上に余白が入る", parseFloat(prose["h3の上余白"]) > 0, prose["h3の上余白"]);
  mustEq("    本文の文字は 16px", prose["本文のフォント"], "16px");
  mustEq("    pre は横スクロール（base 層と競合しない）", prose["preの横スクロール"], "auto");
  mustEq("    リンクの下線を消していない", prose["リンクの下線"], "underline");
  must(
    "    本文の幅が読みやすい範囲に収まる",
    prose["本文の幅"] > 0 && prose["本文の幅"] <= 720,
    `${prose["本文の幅"]}px`,
  );

  await page.close();
}

/* ===== 21. Astro 側（JS 無しでメニューが開くか） ================= */
{
  const page = await (async () => {
    const { chromium } = await import("playwright");
    const b = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
    // **JavaScript を切って**開きます。
    const ctx = await b.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 780 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await ctx.newPage();
    p.on("close", () => b.close());
    await p.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded" });
    return p;
  })();

  await page.locator("header details > summary").first().click();
  await page.waitForTimeout(300);
  const noJs = await page.evaluate(() => {
    const d = document.querySelector("header details");
    return {
      開いた: d?.open,
      リンクの数: d?.querySelectorAll("a").length,
    };
  });
  must(
    "21. JavaScript を切ってもメニューが開く（<details> の力）",
    noJs["開いた"] === true && (noJs["リンクの数"] ?? 0) > 0,
    JSON.stringify(noJs),
  );
  await page.close();
}

console.log(`\n（対象: ${BASE} / http://127.0.0.1:4321）`);
/* ===== SiteFooter: 列が多いとき（Δ-P2-01） ======================
   v0.9d でリンクの列を shrink-0 にしましたが、試したのは 2 列だけでした。
   API は列数を制限していないので、**6 列でも器から出ないこと**を見ます。 */
{
  const page = await openTab("nav", { width: 1280, height: 900 });
  for (const w of [768, 1024, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="footer-demo"]');
      const navs = [...box.querySelectorAll("nav")];
      const r = box.getBoundingClientRect();
      return {
        列数: navs.length,
        はみ出し: Math.round(Math.max(0, ...navs.map((n) => n.getBoundingClientRect().right - r.right))),
        いちばん狭い列: Math.round(Math.min(...navs.map((n) => n.getBoundingClientRect().width))),
        中身が入りきらない列: navs.filter((n) => n.scrollWidth > n.clientWidth + 1).length,
        ページのはみ出し: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    must(
      `12. SiteFooter が 6 列でも器から出ない (${w}px)`,
      m.はみ出し === 0 && m.ページのはみ出し <= 0 && m.中身が入りきらない列 === 0,
      JSON.stringify(m),
    );
  }
  await page.close();
}


await finish();
