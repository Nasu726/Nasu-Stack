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
import { chromium } from "playwright";

const WIDTHS = [
  { w: 320, label: "320 (小さいスマホ)" },
  { w: 375, label: "375 (標準的なスマホ)" },
  { w: 414, label: "414 (大きめスマホ)" },
  { w: 768, label: "768 (タブレット縦)" },
  { w: 1024, label: "1024 (タブレット横)" },
];

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
      if (inText && cs.display.startsWith("inline")) continue;
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
    } else if (cs.flexShrink === "0" && px(w) > viewportWidth * 0.9) {
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

  /* 6. 場所を取っていない画像 ----------------------------------
     画像は読み込みが終わるまで大きさが分かりません。比率も寸法も
     決まっていないと、届いた瞬間に高さを持ち、その下の文章が下へずれます。
     読んでいる最中に行が動く、押そうとしたボタンが逃げる、あれです。
     ここでは「まだ届いていない画像のうち、場所を取っていないもの」を数えます。 */
  const unsizedImages = [];
  for (const img of document.querySelectorAll("img")) {
    const cs = getComputedStyle(img);
    // 親か自分に aspect-ratio があるか、height が px で決まっていれば場所は取れている
    const hasRatio =
      cs.aspectRatio !== "auto" ||
      (img.parentElement &&
        getComputedStyle(img.parentElement).aspectRatio !== "auto");
    const hasAttrs = img.hasAttribute("width") && img.hasAttribute("height");
    const fixedHeight = cs.height.endsWith("px") && parseFloat(cs.height) > 0;
    if (hasRatio || hasAttrs) continue;
    // 既に読み終わっていて高さが確定しているものは、これ以上ずれません
    if (img.complete && fixedHeight) continue;
    unsizedImages.push({
      src: (img.getAttribute("src") || "").slice(-40),
      alt: (img.getAttribute("alt") || "").slice(0, 20),
    });
  }

  return {
    overflow,
    unsizedImages: unsizedImages.slice(0, 3),
    unsizedCount: unsizedImages.length,
    culprits: culprits.slice(0, 5),
    smallTargets: smallTargets.slice(0, 5),
    smallCount: smallTargets.length,
    zoomOnFocus: zoomOnFocus.slice(0, 5),
    zoomCount: zoomOnFocus.length,
    rigid: rigid.slice(0, 3),
    rigidCount: rigid.length,
    longLines: longLineDetail.length,
    longLineDetail: longLineDetail.slice(0, 3),
  };
}

/* ================================================================
 * CLI
 * ============================================================== */

export async function checkUrls(urls, { widths = WIDTHS } = {}) {
  // CI などで Chromium の場所が固定されている場合に差し替えられるようにする
  const browser = await chromium.launch({
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
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
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
    if (r.unsizedCount > 0) {
      issues.push(
        `場所を取っていない画像: ${r.unsizedCount} 件 ` +
          `(${(r.unsizedImages ?? []).map((i) => `…${i.src}`).join(", ")})`,
      );
      issues.push(
        "  → 読み込んだ瞬間に下の文章がずれます。<Frame ratio=\"16/9\"> で囲むか、width と height を書いてください",
      );
    }
    if (r.rigidCount > 0) {
      issues.push(
        `画面幅より縮まない要素: ${r.rigidCount} 件 ` +
          `(${r.rigid.map((x) => `${x.tag} ${x.minWidth ?? x.width}`).join(", ")})`,
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
  process.exit(problems > 0 ? 1 : 0);
}
