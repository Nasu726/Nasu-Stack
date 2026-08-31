#!/usr/bin/env node
/**
 * 端末幅の崩れを検出します。
 *
 *   node scripts/check-responsive.mjs http://localhost:5173
 *   node scripts/check-responsive.mjs http://localhost:5173/about http://localhost:5173/contact
 *
 * 「スマホで見たら崩れてた」を、目視ではなく数値で捕まえるためのものです。
 * 崩れが見つかると終了コード 1 を返すので、CI にそのまま載せられます。
 *
 * 必要: npm i -D playwright && npx playwright install chromium
 */

/**
 * playwright は**使うときに読み込みます。**
 *
 * これは「あると便利な検査」であって、サイトを作るのに要るものではありません。
 * だから最初から依存には入れていません（実ブラウザは 100MB 以上あります）。
 *
 * 入っていないときに `ERR_MODULE_NOT_FOUND` のスタックだけ出しても、
 * **何をすればいいのか分かりません。** 初めての人には「壊れた」と映ります。
 * 手順をそのまま出します。
 */
let chromium;
async function loadChromium() {
  if (chromium) return chromium;
  try {
    ({ chromium } = await import("playwright"));
    return chromium;
  } catch {
    console.error(
      [
        "",
        "この検査には playwright（実ブラウザ）が要ります。まだ入っていません。",
        "",
        "  npm i -D playwright",
        "  npx playwright install chromium",
        "",
        "サイトを作るのに必須ではありません。崩れを目視ではなく数値で",
        "確かめたくなったときに入れてください。",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }
}

const WIDTHS = [
  { w: 320, label: "320 (小さいスマホ)" },
  { w: 375, label: "375 (標準的なスマホ)" },
  { w: 414, label: "414 (大きめスマホ)" },
  { w: 768, label: "768 (タブレット縦)" },
  { w: 1024, label: "1024 (タブレット横)" },
];

/**
 * HTML だけ届き、外部 CSS がまだ読めていない画面を測らないための入口。
 *
 * 全体検査は複数の Chromium を並列で立てます。負荷が高いときに最初の
 * stylesheet だけ一時的に読めず、素の button（高さ 21px）や input
 *（13.33px）を「レイアウト崩れ」と報告したことがありました。実装の赤と
 * 読込の赤を混ぜず、1 回だけ読み直しても届かなければ理由を名指しします。
 *
 * link が無い inline CSS / CSS-in-JS のページは、そのまま検査できます。
 */
async function gotoWithStyles(page, url, waitUntil) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(url, { waitUntil, timeout: 30000 });
    const linked = await page.locator('link[rel="stylesheet"]').count();
    if (linked === 0) return;

    try {
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('link[rel="stylesheet"]')].every(
            (link) => link.sheet !== null,
          ),
        undefined,
        { timeout: 5000 },
      );
      return;
    } catch {
      // 1 回目だけ再読込します。永続的な 404 を黙って通してはいけません。
    }
  }
  throw new Error("stylesheet を読み込めませんでした（再読込後も未適用）");
}

/**
 * ページ内で走らせる検査。
 * ブラウザ側で実行されるので、外の変数は参照できません。
 */
export function inspect(viewportWidth) {
  /** 祖先に横スクロール領域があるか（その中身は外に出ていて当然） */
  const insideScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden") return true;
      p = p.parentElement;
    }
    return false;
  };

  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;

  /* 1. はみ出し ------------------------------------------------ */
  const culprits = [];
  if (overflow > 0) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (getComputedStyle(el).position === "fixed") continue;
      if (insideScroller(el)) continue;
      if (r.right > viewportWidth + 1 || r.left < -1) {
        culprits.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").slice(0, 60),
          over: Math.round(r.right - viewportWidth),
          text: (el.textContent || "").trim().slice(0, 40),
        });
      }
    }
  }

  /* 2. タップ領域 ----------------------------------------------
     測るのは「押せる範囲」であって、要素そのものの大きさではありません。
     チェックボックスが 20px でも、それを包む <label> が 44px なら
     指で押せる範囲は 44px です。包みを辿って実際の当たり判定を測ります。 */
  const smallTargets = [];
  for (const el of document.querySelectorAll(
    "a[href], button, input, select, textarea, [role=button], [role=link], summary",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    // sr-only で隠した入力（幅 1px など）は視覚的なターゲットではありません。
    // ファイル選択のように、見た目を label に差し替えている場合がこれに当たります。
    if (r.width <= 1 || r.height <= 1) continue;

    // 文章の中に混ざったリンクは対象外です。
    // WCAG 2.1 の 2.5.8（ターゲットのサイズ）には「インライン」の例外があり、
    // 文中や段落の中のリンクは 24px 未満でも適合とされています。
    // 行の高さを広げれば直りますが、それは本文が読みにくくなるだけです。
    if (el.tagName === "A") {
      const p = el.parentElement;
      const inText =
        p && /^(P|LI|TD|TH|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|SPAN|EM|STRONG|FIGCAPTION|DD|DT)$/.test(p.tagName);
      /* **`inline-flex` を除外に含めてはいけません。**
         最初 `startsWith("inline")` にしていたら、ナビゲーションのリンク
         （`<li>` の中の `inline-flex`）まで例外になり、
         わざと高さを潰したのに検出できませんでした。

         地の文に混ざったリンクは `display: inline` です。
         `inline-flex` はレイアウトのために明示的に選んだもので、
         文章の一部ではありません。だから `inline` だけを除外します。 */
      if (inText && cs.display === "inline") continue;
    }

    // 包んでいる label / button があれば、それが実際の当たり判定
    const wrapper = el.closest("label, button, a[href]");
    const target = wrapper && wrapper !== el ? wrapper.getBoundingClientRect() : r;

    if (target.width < 24 || target.height < 24) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        size: `${Math.round(target.width)}x${Math.round(target.height)}`,
        label: (el.getAttribute("aria-label") || el.textContent || "")
          .trim()
          .slice(0, 24),
      });
    }
  }

  /* 3. iOS の自動拡大 ------------------------------------------ */
  const zoomOnFocus = [];
  for (const el of document.querySelectorAll(
    "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea, select",
  )) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) {
      zoomOnFocus.push({
        name:
          el.getAttribute("name") ||
          el.getAttribute("aria-label") ||
          el.tagName.toLowerCase(),
        fontSize: fs,
      });
    }
  }

  /* 4. 縮まない固定幅 ------------------------------------------ */
  const rigid = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const w = cs.width;
    const minW = cs.minWidth;
    const px = (v) => (v.endsWith("px") ? parseFloat(v) : 0);
    // 横スクロール領域の中身は、画面より広くて当然です（表やコードがこれ）。
    // min-width も width も、その中では指摘しません。
    if (insideScroller(el)) continue;
    if (px(minW) > viewportWidth) {
      rigid.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 40),
        minWidth: minW,
      });
    } else if (
      cs.flexShrink === "0" &&
      px(w) > viewportWidth * 0.9 &&
      /* **横並びのときだけ問題になります。**
         flex-shrink は主軸の縮み方の指定です。親が縦並び（flex-direction: column）
         なら、これは高さの話であって幅とは関係ありません。
         区別せずに数えると、狭い画面で縦に畳んだ段組みが毎回引っかかります
         （実測: Column が 343px / 375px で誤検知）。 */
      (() => {
        const p = el.parentElement;
        if (!p) return false;
        const ps = getComputedStyle(p);
        if (!ps.display.includes("flex")) return false;
        return ps.flexDirection.startsWith("row");
      })()
    ) {
      rigid.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 40),
        width: w,
        note: "flex-shrink:0",
      });
    }
  }

  /* 5. 1 行が長すぎる本文 --------------------------------------
     1 文字の幅は言語で大きく違います（和文はほぼ全角 = 1em、
     欧文は平均 0.5em 前後）。同じ px 幅でも読みやすさが倍違うので、
     和文の割合を見て閾値を変えます。
     目安: 欧文は 1 行 75〜80 字、和文は 40〜45 字まで。 */
  const longLineDetail = [];
  for (const el of document.querySelectorAll("p, li")) {
    const text = (el.textContent || "").trim();
    if (text.length < 60) continue;
    // URL や長い識別子は「読みやすい行長」の話ではありません。
    // 途中で切れない 1 語なので、はみ出しの検査（1 番）の担当です。
    // ここで数えると、直しようのない指摘が毎回出ます。
    const longestWord = Math.max(...text.split(/\s+/).map((s) => s.length));
    if (longestWord > 40) continue;
    const r = el.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (!fs || !r.width) continue;

    const cjk = (text.match(/[　-ヿ㐀-鿿＀-￯]/g) || [])
      .length;
    const cjkRatio = cjk / text.length;
    const em = r.width / fs;
    // 和文寄りなら 45em(≒45 字)、欧文寄りなら 40em(≒80 字) を上限とする
    const limitEm = cjkRatio > 0.3 ? 45 : 40;
    if (em > limitEm) {
      longLineDetail.push({
        em: Math.round(em),
        limitEm,
        kind: cjkRatio > 0.3 ? "和文" : "欧文",
        text: text.slice(0, 26),
      });
    }
  }

  /* 6. 潰れ ---------------------------------------------------
     **はみ出しの反対側です。** ここまでの判定は「外へ出ていないか」しか
     見ていません。中へ潰れているものは、全部緑のまま通ります。

     v0.9d で実測した実例:
       - 段組を畳んだとき、幅を持たない列が 179px と 48px（親は 678px）
       - Frame の比率の例が 24px
       - カタログ上部のタブが可視幅 13px（中身は 530px）

     どれも「小さくなるだけ」なので、目で見ないと気づけません。
     しかも見た人は「そういうデザイン」だと思うので、報告も来ません。 */
  const squashed = [];
  {
    /** 中身が入る場所があるのに、極端に狭くなっている要素を探します。 */
    const CANDIDATE = ".wt-col, .wt-frame, [data-wt-fill]";
    for (const el of document.querySelectorAll(CANDIDATE)) {
      const p = el.parentElement;
      if (!p) continue;
      const r = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 親が狭ければ子が狭いのは当たり前
      if (pr.width < 200) continue;
      // 横に並んでいるなら、狭いのは正しい姿
      const pcs = getComputedStyle(p);
      const stacked =
        pcs.display === "block" ||
        ((pcs.display === "flex" || pcs.display === "inline-flex") &&
          pcs.flexDirection.startsWith("column"));
      if (!stacked) continue;
      if (r.width / pr.width >= 0.4) continue;
      squashed.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 46),
        width: Math.round(r.width),
        parent: Math.round(pr.width),
        text: (el.textContent || "").trim().slice(0, 24),
      });
    }

    /* スクロールできる器が、1 項目より狭くなっていないか。
       狭くなると「そこに何かある」ことすら分かりません。 */
    for (const list of document.querySelectorAll('[role="tablist"]')) {
      const box = list.parentElement;
      if (!box) continue;
      const first = list.querySelector('[role="tab"]');
      if (!first) continue;
      const need = first.getBoundingClientRect().width;
      const have = box.clientWidth;
      if (need > 0 && have > 0 && have < need) {
        squashed.push({
          tag: "tablist",
          cls: String(list.getAttribute("aria-label") || "").slice(0, 46),
          width: Math.round(have),
          parent: Math.round(list.scrollWidth),
          text: "1 項目 " + Math.round(need) + "px より狭い",
        });
      }
    }
  }

  /* 7. 場所を取っていない画像は、別の走査で調べます（下の checkImageSizing）。
     ここで属性から推測すると、**読み込みが速い環境では見逃します。**
     実際、寸法の無い画像を置いて試したところ、この方式では検出できませんでした
     （プレビューが速すぎて、測るときには既に読み終わっていたため）。 */

  return {
    overflow,
    culprits: culprits.slice(0, 5),
    smallTargets: smallTargets.slice(0, 5),
    smallCount: smallTargets.length,
    zoomOnFocus: zoomOnFocus.slice(0, 5),
    zoomCount: zoomOnFocus.length,
    rigid: rigid.slice(0, 3),
    rigidCount: rigid.length,
    squashed: squashed.slice(0, 5),
    squashedCount: squashed.length,
    longLines: longLineDetail.length,
    longLineDetail: longLineDetail.slice(0, 3),
  };
}

/* ================================================================
 * CLI
 * ============================================================== */

/**
 * 画像が「場所を先に取っているか」を調べます。
 * ================================================================
 * **読み込みを止めてから測るのが要点です。**
 *
 * 属性や computed style から推測しようとすると、速い環境では見逃します。
 * 画像が届いてしまえば高さは確定するので、測るときには
 * 「ちゃんと場所を取っている画像」と区別が付きません。
 * 実際、寸法の無い画像を置いて試したら 1 件も検出できませんでした。
 *
 * そこで**画像のリクエストを遮断した状態**で開きます。
 * 場所を取っていない画像は高さがほぼ 0 になり、取っている画像は
 * 指定された高さのまま残ります。これは推測ではなく、
 * 利用者が遅い回線で見るのと同じ状態です。
 */
export async function checkImageSizing(urls, { width = 375 } = {}) {
  const browser = await (await loadChromium()).launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const report = [];

  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    // 画像だけ届かないようにする
    await page.route("**/*", (route) =>
      route.request().resourceType() === "image" ? route.abort() : route.continue(),
    );
    try {
      await gotoWithStyles(page, url, "domcontentloaded");
      await page.waitForTimeout(300);
      const unsized = await page.evaluate(() =>
        [...document.querySelectorAll("img")]
          .filter((img) => {
            const cs = getComputedStyle(img);
            if (cs.display === "none") return false;
            // 遮断できていない画像は判定材料になりません
            if (img.naturalWidth !== 0) return false;

            // 場所を取る方法は 3 つ。どれか 1 つでもあれば問題ありません。
            //   1. width / height 属性（ブラウザが比率に変換します）
            //   2. 自分か親の aspect-ratio（<Frame> がこれ）
            //   3. CSS で高さを決めている（h-48 など）
            const hasAttrs = img.hasAttribute("width") && img.hasAttribute("height");
            const selfAR = cs.aspectRatio !== "auto";
            const parentAR =
              img.parentElement &&
              getComputedStyle(img.parentElement).aspectRatio !== "auto";
            if (hasAttrs || selfAR || parentAR) return false;

            /* 残るのは「CSS で高さを決めている」か「何も無い」かの 2 つです。
               **高さの数値では区別できません。** 届かなかった画像は
               代替テキストの高さになるので、`h-8`（32px）のような指定と
               同じ数字になり得ます（実測で 30px でした）。

               そこで直接調べます。代替テキストを一時的に空にして、
               高さが消えるなら「文字の高さだった」＝場所を取っていない。
               CSS で高さを持っていれば、消しても高さは残ります。
               検査用の使い捨てページなので、書き換えて構いません。 */
            const alt = img.getAttribute("alt");
            img.setAttribute("alt", "");
            const withoutAlt = img.getBoundingClientRect().height;
            if (alt === null) img.removeAttribute("alt");
            else img.setAttribute("alt", alt);
            /* 代替テキストを消しても、壊れた画像の枠が 16px ほど残ります
               （実測: 場所を取っていない画像 16px / 取っている画像 185px）。
               24px を境にすれば、この 2 つは確実に分かれます。 */
            return withoutAlt < 24;
          })
          .map((img) => ({
            src: (img.getAttribute("src") || "").slice(-44),
            alt: (img.getAttribute("alt") || "").slice(0, 24),
          })),
      );
      report.push({ url, unsized });
    } catch (e) {
      report.push({ url, error: String(e).slice(0, 120), unsized: [] });
    }
    await page.close();
  }

  await browser.close();
  return report;
}

export function formatImageReport(report) {
  const lines = [];
  let problems = 0;
  for (const r of report) {
    if (r.error) {
      problems++;
      lines.push(`  ✗ ${r.url}  ページを開けませんでした: ${r.error}`);
    } else if (r.unsized.length === 0) {
      lines.push(`  ✓ ${r.url}  画像は全部あらかじめ場所を取っています`);
    } else {
      problems++;
      lines.push(`  ✗ ${r.url}  場所を取っていない画像 ${r.unsized.length} 件`);
      for (const i of r.unsized.slice(0, 5)) {
        lines.push(`      ↳ …${i.src}  "${i.alt}"`);
      }
      lines.push(
        "      → 届いた瞬間に下の文章がずれます。<Frame ratio=\"16/9\"> で囲むか、",
      );
      lines.push(
        "        width と height を書いてください（Markdown なら相対パスにすると自動で付きます）",
      );
    }
  }
  return { text: lines.join("\n"), problems };
}

export async function checkUrls(urls, { widths = WIDTHS } = {}) {
  // CI などで Chromium の場所が固定されている場合に差し替えられるようにする
  const browser = await (await loadChromium()).launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const report = [];

  for (const url of urls) {
    for (const { w, label } of widths) {
      const page = await browser.newPage({
        viewport: { width: w, height: 800 },
        isMobile: w < 768,
        hasTouch: w < 768,
      });
      try {
        await gotoWithStyles(page, url, "networkidle");
        await page.waitForTimeout(400);
        const result = await page.evaluate(inspect, w);
        report.push({ url, width: w, label, ...result });
      } catch (e) {
        report.push({ url, width: w, label, error: String(e).slice(0, 120) });
      }
      await page.close();
    }
  }

  await browser.close();
  return report;
}

export function formatReport(report) {
  const lines = [];
  let problems = 0;

  for (const r of report) {
    const issues = [];

    if (r.error) {
      issues.push(`ページを開けませんでした: ${r.error}`);
    }
    if (r.overflow > 0) {
      issues.push(`横に ${r.overflow}px はみ出しています`);
      for (const c of r.culprits) {
        issues.push(
          `  ↳ <${c.tag} class="${c.cls}"> が ${c.over}px 外へ  "${c.text}"`,
        );
      }
      issues.push(
        "  → 長い文字列なら overflow-wrap、表やコードなら <Scrollable> で囲んでください",
      );
    }
    if (r.zoomCount > 0) {
      issues.push(
        `入力欄の文字が 16px 未満: ${r.zoomCount} 件 ` +
          `(${r.zoomOnFocus.map((z) => `${z.name}=${z.fontSize}px`).join(", ")})`,
      );
      issues.push("  → iOS では触れた瞬間に画面が自動拡大されます");
    }
    if (r.smallCount > 0) {
      issues.push(
        `タップ領域が 24px 未満: ${r.smallCount} 件 ` +
          `(${r.smallTargets.map((s) => `${s.tag} ${s.size} "${s.label}"`).join(", ")})`,
      );
      issues.push("  → 指で押しづらく、WCAG 2.1 AA の最低基準を下回ります");
    }
    if (r.rigidCount > 0) {
      issues.push(
        `画面幅より縮まない要素: ${r.rigidCount} 件 ` +
          `(${r.rigid.map((x) => `${x.tag} ${x.minWidth ?? x.width}`).join(", ")})`,
      );
    }
    if (r.squashedCount > 0) {
      issues.push(`場所があるのに潰れている要素: ${r.squashedCount} 件`);
      for (const s of r.squashed) {
        issues.push(
          `  ↳ <${s.tag} class="${s.cls}"> が ${s.width}px（親は ${s.parent}px）  "${s.text}"`,
        );
      }
      issues.push(
        "  → 畳んだときの align、flex-1 での縮み、幅を持たない子を疑ってください",
      );
    }
    if (r.longLines > 0) {
      issues.push(
        `1 行が長すぎる本文: ${r.longLines} 件 ` +
          (r.longLineDetail ?? [])
            .map((d) => `${d.kind} ${d.em}em(上限 ${d.limitEm}em) "${d.text}…"`)
            .join(", "),
      );
      issues.push(
        "  → <ContentBlock width=\"prose\"> で囲むと、文字サイズに応じた読みやすい幅に収まります",
      );
    }

    const head = `${r.url}  @ ${r.label}`;
    if (issues.length === 0) {
      lines.push(`  ✓ ${head}`);
    } else {
      problems++;
      lines.push(`  ✗ ${head}`);
      for (const i of issues) lines.push(`      ${i}`);
    }
  }

  lines.push("");
  lines.push(
    problems === 0
      ? "✅ どの画面幅でも崩れは見つかりませんでした"
      : `⚠️  ${problems} / ${report.length} の組み合わせで指摘があります`,
  );
  return { text: lines.join("\n"), problems };
}

// 直接実行されたときだけ CLI として動く
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())
) {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error(
      "使い方: node scripts/check-responsive.mjs <URL> [URL...]\n" +
        "例:     node scripts/check-responsive.mjs http://localhost:5173",
    );
    process.exit(2);
  }
  console.log(`端末幅チェック: ${urls.length} ページ × ${WIDTHS.length} 幅\n`);
  const report = await checkUrls(urls);
  const { text, problems } = formatReport(report);
  console.log(text);

  console.log("\n画像が場所を先に取っているか（画像の読み込みを止めて確認）\n");
  const imgReport = await checkImageSizing(urls);
  const img = formatImageReport(imgReport);
  console.log(img.text);
  console.log(
    img.problems === 0
      ? "\n✅ どのページでも画像は場所を先に取っています"
      : `\n⚠️  ${img.problems} ページで画像が場所を取っていません`,
  );

  process.exit(problems + img.problems > 0 ? 1 : 0);
}
