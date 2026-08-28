export async function verifySiteNavigation({ openTab, must, mustEq, BASE }) {
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
      // Paginatorも同じ正しいaria-currentを使います。SiteHeaderの契約だけを
      // 数えるため、linkであるcurrent itemへ対象を絞ります。
      const marked = [...document.querySelectorAll('a[aria-current="page"]')];
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
}
