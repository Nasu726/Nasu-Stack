/**
 * レイアウト部品に「壊しにくる中身」を入れて、狭い画面で耐えるか調べます。
 *   node scripts/audit-stress.mjs
 *
 * 実際のサイトでスマホ表示が壊れる原因は、ほぼこの 5 つです。
 *   1. 折り返せない長い文字列（URL・ID・英単語の羅列）
 *   2. 実寸の大きい画像
 *   3. 列の多い表
 *   4. 長い行を含むコードブロック
 *   5. px / rem で幅を固定した要素
 */
import { chromium } from "playwright";

const CASES = [
  {
    name: "折り返せない長い URL",
    html: `<div class="flex flex-col wt-gap" style="--wt-gap:var(--space-md)">
      <p>https://example.com/very/long/path/that/never/breaks/anywhere/at/all/because/it/has/no/spaces/1234567890</p>
    </div>`,
  },
  {
    name: "長い英単語の羅列",
    html: `<div class="flex flex-col wt-gap" style="--wt-gap:var(--space-md)">
      <p>Supercalifragilisticexpialidocious_Pneumonoultramicroscopicsilicovolcanoconiosis</p>
    </div>`,
  },
  {
    name: "実寸の大きい画像",
    html: `<div class="flex flex-col wt-gap" style="--wt-gap:var(--space-md)">
      <img alt="" width="1600" height="900"
        src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><rect width='1600' height='900' fill='%23ccc'/></svg>" />
    </div>`,
  },
  {
    name: "列の多い表",
    html: `<div class="flex flex-col wt-gap" style="--wt-gap:var(--space-md)">
      <table><thead><tr>
        ${Array.from({ length: 9 }, (_, i) => `<th>見出し${i + 1}</th>`).join("")}
      </tr></thead><tbody><tr>
        ${Array.from({ length: 9 }, (_, i) => `<td>データ${i + 1}</td>`).join("")}
      </tr></tbody></table>
    </div>`,
  },
  {
    name: "長い行を含むコードブロック",
    html: `<div class="flex flex-col wt-gap" style="--wt-gap:var(--space-md)">
      <pre><code>const result = await fetchSomethingWithAVeryLongName({ option: true, another: false, third: 42 });</code></pre>
    </div>`,
  },
  {
    name: "Column に固定幅 18rem（畳んだ状態）",
    html: `<div class="flex w-full wt-gap flex-col md:flex-row" style="--wt-gap:var(--space-md)">
      <div class="wt-col wt-col--sized wt-col--at-tablet" style="--wt-w:18rem"><div>固定幅</div></div>
      <div class="wt-col"><div>auto</div></div>
    </div>`,
  },
  {
    name: "Tiles に 4 列を強制",
    html: `<div class="grid wt-cols wt-gap" style="--wt-cols:repeat(4, minmax(0, 1fr)); --wt-gap:var(--space-md)">
      ${Array.from({ length: 4 }, (_, i) => `<div>タイル${i + 1}のやや長いラベル</div>`).join("")}
    </div>`,
  },
  {
    name: "Inline に長いタグを大量に",
    html: `<div class="flex flex-wrap wt-gap" style="--wt-gap:var(--space-sm)">
      ${Array.from({ length: 8 }, (_, i) => `<span>とても長いタグの名前${i + 1}</span>`).join("")}
    </div>`,
  },
];

const WIDTHS = [320, 375, 768];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 700 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

  for (const c of CASES) {
    const overflow = await page.evaluate(
      ({ html, vw }) => {
        const host = document.createElement("div");
        // PageBlock 相当（最大幅 + 左右の余白）の中に入れて試す
        host.className = "w-full wt-maxw wt-px mx-auto";
        host.style.setProperty("--wt-maxw", "var(--width-content)");
        host.style.setProperty("--wt-px", "var(--space-md)");
        host.innerHTML = html;
        document.body.appendChild(host);

        // 元ページ由来のはみ出しを混ぜないよう、他を一時的に隠す
        const others = [...document.body.children].filter((e) => e !== host);
        const prev = others.map((e) => e.style.display);
        others.forEach((e) => (e.style.display = "none"));

        const doc = document.documentElement;
        const over = doc.scrollWidth - doc.clientWidth;

        // 祖先が横スクロール領域なら、中身が外へ出ているのは正常
        const insideScroller = (el) => {
          let p = el.parentElement;
          while (p && p !== document.body) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden") return true;
            p = p.parentElement;
          }
          return false;
        };

        let worst = 0;
        for (const el of host.querySelectorAll("*")) {
          if (insideScroller(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1) worst = Math.max(worst, Math.round(r.right - vw));
        }

        others.forEach((e, i) => (e.style.display = prev[i]));
        host.remove();
        return { over, worst };
      },
      { html: c.html, vw: width },
    );
    rows.push({ width, name: c.name, ...overflow });
  }
  await page.close();
}
await browser.close();

const byCase = new Map();
for (const r of rows) {
  if (!byCase.has(r.name)) byCase.set(r.name, []);
  byCase.get(r.name).push(r);
}

let broken = 0;
for (const [name, list] of byCase) {
  const bad = list.filter((r) => r.over > 0 || r.worst > 0);
  if (bad.length === 0) {
    console.log(`✓ ${name}`);
  } else {
    broken++;
    console.log(
      `✗ ${name}  →  ` +
        bad.map((r) => `${r.width}px で ${Math.max(r.over, r.worst)}px はみ出し`).join(" / "),
    );
  }
}

console.log(
  broken === 0
    ? "\n✅ どのケースでもはみ出しませんでした"
    : `\n❌ ${broken} / ${byCase.size} ケースで崩れます`,
);

// 崩れたら落とします。以前は印字するだけで、
// **壊れていても pnpm verify は緑のまま**でした。
process.exit(broken > 0 ? 1 : 0);
