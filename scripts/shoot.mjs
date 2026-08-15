import { chromium } from "playwright";

const themes = process.argv[2]?.split(",") ?? ["neutral"];
const base = "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
for (const spec of themes) {
  const [theme, mode = "light"] = spec.split(":");
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  await page.addInitScript(
    ([t, m]) => {
      localStorage.setItem(
        "webtemplate.theme",
        JSON.stringify({ theme: t, mode: m }),
      );
    },
    [theme, mode],
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({
    path: `/home/claude/shots/${theme}-${mode}.png`,
    fullPage: true,
  });
  console.log("shot", theme, mode);
  await page.close();
}
await browser.close();
