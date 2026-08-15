/**
 * v0.6 の検証。docs/plan-v06.md の「実測で確かめる項目」に対応します。
 *
 * ここで測るのは、**目で見ても気づけないもの**です。
 * キーボードだけで操作したときの挙動と、隠れた場所に潜り込む見出し。
 */
import { launch, log, BASE } from "./_browser.mjs";

const { openTab, finish } = await launch();

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
  log("1. アンカーの逃げ:", JSON.stringify(r));
  log("   → scroll-padding-top が 0 でなければ、見出しはヘッダの下に隠れません");
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
  log("2. 開いた直後:", JSON.stringify(opened));
  log("   → modal=true なら top layer。htmlOverflow=hidden なら背面は動きません");

  // 背面が本当に動かないか。
  // **window.scrollBy では測れません。** あれはプログラムからの操作で、
  // overflow: hidden でも動いてしまいます。止めたいのは指とホイールなので、
  // 実際のホイール入力を送って測ります。
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  log("3. ホイールでの背面スクロール:", `${before} → ${after}（動いていないこと）`);

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
  log("4. Tab 12 回でダイアログ外の要素へ移った回数:", escaped.length, JSON.stringify(escaped));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({
    open: !!document.querySelector("dialog[open]"),
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  }));
  log("5. Esc の後:", JSON.stringify(closed), "（背面のスクロールも戻ること）");

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
  log("6. roving tabindex:", JSON.stringify(roving));
  log("   → tabIndex が 0 なのは 1 つだけ。aria-controls の先が実在すること");

  // 矢印キー
  await list.getByRole("tab", { name: "概要" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  log("7. → を 1 回:", JSON.stringify(await active(page)));
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  log("   もう 1 回（無効なタブを飛ばすこと）:", JSON.stringify(await active(page)));
  await page.keyboard.press("End");
  await page.waitForTimeout(150);
  log("   End:", JSON.stringify(await active(page)));

  // 入力がタブ切り替えで消えないか
  await list.getByRole("tab", { name: "詳細" }).click();
  await page.waitForTimeout(200);
  await page.locator('input[placeholder^="何か入力"]').fill("消えないで");
  await list.getByRole("tab", { name: "履歴" }).click();
  await page.waitForTimeout(200);
  await list.getByRole("tab", { name: "詳細" }).click();
  await page.waitForTimeout(200);
  const kept = await page.locator('input[placeholder^="何か入力"]').inputValue();
  log("8. タブを往復した後の入力:", JSON.stringify(kept));

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
  log("9. 12 個のタブ:", JSON.stringify(many));

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
  log("10. summary:", JSON.stringify(marker), "（矢印が無いと開けると分からない）");

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
  log(
    "11. name による排他:",
    `${JSON.stringify(accordion)} → 2 つ目を開いた後に開いている数=${openCount}（1 なら効いている）`,
  );

  await page.close();
}

/* ===== 12〜14. DropdownMenu / NavDropdown ======================== */
{
  const page = await openTab("nav");

  await page.getByRole("button", { name: "操作" }).click();
  await page.waitForTimeout(250);
  log("12. 開いた直後のフォーカス:", JSON.stringify(await active(page)));

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  log("    ↓ を 1 回:", JSON.stringify(await active(page)));
  await page.keyboard.press("End");
  await page.waitForTimeout(120);
  log("    End:", JSON.stringify(await active(page)));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  log(
    "13. Esc の後（開いたボタンへ戻ること）:",
    JSON.stringify(await active(page)),
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
  log("14. NavDropdown:", JSON.stringify(navRoles));
  log("    → role は null、中身は a。menuitem が 0 であること");

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
  log("15. 狭い画面のメニュー:", JSON.stringify(mobile));

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
  log("16. 実サイトで開いた後:", JSON.stringify(afterOpen));

  await site.close();

  // aria-current はカタログのデモで測ります。
  // 実サイトはアンカー（#works）だけのナビなので、
  // どのリンクも「いま開いているページ」ではないのが正しい状態です。
  const cat = await openTab("nav");
  const current = await cat.evaluate(() => {
    const marked = [...document.querySelectorAll('[aria-current="page"]')];
    return marked.map((a) => a.textContent?.trim());
  });
  log(
    "17. aria-current:",
    JSON.stringify(current),
    "（広い画面用と狭い画面用に同じリンクを 2 回書き出すので 2 件が正常）",
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
  log("18. 画像の読み込み前後の位置:", JSON.stringify(shift));
  log("   → 包まない側だけが動き、Frame で包んだ側は動かないこと");

  const imgAttrs = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((i) => ({
      loading: i.loading,
      fetchPriority: i.fetchPriority,
      比率が指定された箱の中: !!i.closest("[style*='aspect-ratio']"),
    })),
  );
  log("19. img の属性:", JSON.stringify(imgAttrs));

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
  log("20. prose:", JSON.stringify(prose));
  log("   → wt-prose 自身は外側の余白を持たないこと（0px / 0px）");

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
  log("21. JavaScript を切った Astro ページ:", JSON.stringify(noJs));
  log("   → JS 無しでメニューが開くこと（<details> の力）");
  await page.close();
}

console.log(`\n（対象: ${BASE} / http://127.0.0.1:4321）`);
await finish();
