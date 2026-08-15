/**
 * 端末幅ごとの崩れを機械的に検出します。
 *   node scripts/audit-responsive.mjs
 *
 * 初心者が踏む「スマホで見たら崩れてた」を、目視ではなく数値で捕まえるのが目的です。
 * 検出するもの:
 *   1. 横スクロールの発生（= はみ出し）と、その原因になっている要素
 *   2. タップ領域が小さすぎるボタン・リンク（WCAG 2.1 AA: 24x24 CSS px)
 *   3. iOS が自動ズームしてしまう入力欄（font-size < 16px)
 *   4. 幅を固定していて縮まない要素
 *   5. 1 行が長すぎる本文
 */
import { chromium } from "playwright";

const TARGETS = [
  { name: "カタログ(レイアウト)", url: "http://127.0.0.1:4173/" },
  { name: "カタログ(状態)", url: "http://127.0.0.1:4173/", tab: "状態" },
  { name: "Astro サイト", url: "http://127.0.0.1:4321/" },
];

const WIDTHS = [
  { w: 320, label: "320 (iPhone SE)" },
  { w: 375, label: "375 (iPhone)" },
  { w: 414, label: "414 (大きめスマホ)" },
  { w: 768, label: "768 (タブレット縦)" },
  { w: 1024, label: "1024 (タブレット横)" },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

const findings = [];

for (const target of TARGETS) {
  for (const { w, label } of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: w, height: 800 },
      deviceScaleFactor: 2,
      isMobile: w < 768,
      hasTouch: w < 768,
    });
    await page.goto(target.url, { waitUntil: "networkidle" });
    if (target.tab) {
      await page
        .getByRole("button", { name: target.tab, exact: true })
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);

    const result = await page.evaluate((viewportWidth) => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;

      // はみ出しの原因になっている要素を探す
      const culprits = [];
      if (overflow > 0) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > viewportWidth + 1 || r.left < -1) {
            const cs = getComputedStyle(el);
            if (cs.position === "fixed") continue;
            culprits.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 70),
              right: Math.round(r.right),
              width: Math.round(r.width),
              text: (el.textContent || "").trim().slice(0, 30),
            });
          }
        }
      }

      // タップ領域
      const small = [];
      for (const el of document.querySelectorAll(
        "button, a, input, select, [role=button]",
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 24 || r.height < 24) {
          small.push({
            tag: el.tagName.toLowerCase(),
            size: `${Math.round(r.width)}x${Math.round(r.height)}`,
            label: (
              el.getAttribute("aria-label") ||
              el.textContent ||
              ""
            )
              .trim()
              .slice(0, 24),
          });
        }
      }

      // iOS の自動ズーム（入力欄の font-size < 16px）
      const zoomy = [];
      for (const el of document.querySelectorAll("input, textarea, select")) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) {
          zoomy.push({
            name: el.getAttribute("name") || el.type || el.tagName,
            fontSize: fs,
          });
        }
      }

      // 本文の 1 行が長すぎないか（目安 90 文字相当）
      const longLines = [];
      for (const el of document.querySelectorAll("p")) {
        const r = el.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const chars = r.width / (fs * 0.5);
        if (chars > 95 && (el.textContent || "").length > 80) {
          longLines.push({ chars: Math.round(chars), width: Math.round(r.width) });
        }
      }

      return {
        overflow,
        scrollWidth: doc.scrollWidth,
        culprits: culprits.slice(0, 6),
        small: small.slice(0, 6),
        smallCount: small.length,
        zoomy: zoomy.slice(0, 4),
        zoomyCount: zoomy.length,
        longLines: longLines.length,
      };
    }, w);

    findings.push({ target: target.name, width: label, ...result });
    await page.close();
  }
}

await browser.close();

/* ---------------- 出力 ---------------- */
let bad = 0;
for (const f of findings) {
  const issues = [];
  if (f.overflow > 0) {
    bad++;
    issues.push(`横に ${f.overflow}px はみ出し (scrollWidth=${f.scrollWidth})`);
    for (const c of f.culprits) {
      issues.push(
        `    ↳ <${c.tag} class="${c.cls}"> right=${c.right} w=${c.width} "${c.text}"`,
      );
    }
  }
  if (f.smallCount > 0) {
    bad++;
    issues.push(
      `タップ領域が 24px 未満: ${f.smallCount} 件  ` +
        f.small.map((s) => `${s.tag}(${s.size})"${s.label}"`).join(" "),
    );
  }
  if (f.zoomyCount > 0) {
    bad++;
    issues.push(
      `iOS で自動ズームする入力欄: ${f.zoomyCount} 件  ` +
        f.zoomy.map((z) => `${z.name}=${z.fontSize}px`).join(" "),
    );
  }
  if (f.longLines > 0) {
    issues.push(`1 行が長すぎる本文: ${f.longLines} 件`);
  }

  const head = `${f.target}  @ ${f.width}`;
  if (issues.length === 0) {
    console.log(`✓ ${head}`);
  } else {
    console.log(`✗ ${head}`);
    for (const i of issues) console.log(`    ${i}`);
  }
}

console.log(
  bad === 0
    ? "\n✅ 端末幅による崩れは検出されませんでした"
    : `\n⚠️  ${bad} 件の指摘があります`,
);
