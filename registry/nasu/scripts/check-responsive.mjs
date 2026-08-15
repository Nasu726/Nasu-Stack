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

  /* 2. タップ領域 ---------------------------------------------- */
  const smallTargets = [];
  for (const el of document.querySelectorAll(
    "a[href], button, input, select, textarea, [role=button], [role=link], summary",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    if (r.width < 24 || r.height < 24) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
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
    if (px(minW) > viewportWidth) {
      rigid.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 40),
        minWidth: minW,
      });
    } else if (
      cs.flexShrink === "0" &&
      px(w) > viewportWidth * 0.9 &&
      !insideScroller(el)
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

  return {
    overflow,
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
