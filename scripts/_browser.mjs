/**
 * 検証スクリプト共通の土台。
 *
 * 各 verify-*.mjs が同じ「起動してカタログのタブを開く」処理を持っていたので、
 * ここに 1 つだけ置きます。片方だけ直してもう片方が古いまま、を防ぐためです。
 */
import { chromium } from "playwright";
import { TAB_KEYS } from "../apps/playground/src/tabs.mjs";

export const BASE = process.env.PLAYGROUND_URL || "http://127.0.0.1:4173";

/**
 * カタログのタブ。**定義はカタログ側の 1 か所にしかありません。**
 * ここに書き写すと、タブを足したときに検査対象から漏れます。
 */
export { TAB_KEYS as TABS } from "../apps/playground/src/tabs.mjs";

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  /** ページ内で投げられた例外。0 件であることを最後に確かめます。 */
  const errors = [];

  /**
   * タブを開きます。
   *
   * ボタンをクリックして切り替えるのではなく `?tab=` で直接開きます。
   * クリックだと「ボタンの文言が変わっただけ」でスクリプトが黙って
   * 別のタブを検査してしまうためです。URL なら開けなければ失敗します。
   */
  async function openTab(tab, { width = 1200, height = 950 } = {}) {
    if (!TAB_KEYS.includes(tab)) throw new Error(`知らないタブです: ${tab}`);
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/?tab=${tab}`, { waitUntil: "networkidle" });
    // 開いたタブが本当にそれか確かめる（黙って別のタブを検査しないため）
    const opened = await page.evaluate(
      () => document.querySelector("[data-active-tab]")?.dataset.activeTab,
    );
    if (opened && opened !== tab) {
      throw new Error(`タブ ${tab} を開いたつもりが ${opened} でした`);
    }
    await page.waitForTimeout(500);
    return page;
  }

  /** 例外が 0 件なら 0、あれば 1 で終了します。 */
  async function finish() {
    console.log(
      errors.length === 0
        ? "\n✅ pageerror 0 件"
        : `\n❌ pageerror ${errors.length} 件:\n` + errors.join("\n"),
    );
    await browser.close();
    process.exit(errors.length ? 1 : 0);
  }

  return { browser, errors, openTab, finish };
}

export const log = (...a) => console.log("·", ...a);
