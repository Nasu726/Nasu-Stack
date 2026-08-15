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

  /* ================================================================
   * 判定
   * ================================================================
   * 以前はここが全部 `log()` でした。つまり**壊れても落ちませんでした。**
   * タップ領域が 44px から 20px に戻っても、数字が印字されるだけで
   * `pnpm verify` は緑のまま通ります。人が毎回 80 行以上の数字を
   * 読む前提の仕組みで、部品が増えるほど破綻します。
   *
   * 判定にするのは「壊れたら困る性質」と「トークンから決まる値」だけです。
   * 要素の絶対座標のような、配置で変わる値を判定にしてはいけません。
   * フォントの太さが変わっただけで落ちるようになり、
   * やがて誰も見なくなります。
   * ============================================================== */

  const checks = [];

  /**
   * 満たしていなければ最後に失敗として報告します。
   *
   * **その場では止めません。** 1 個目で止めると、残りが直っているか
   * 分からないまま何度も走らせることになります。
   */
  function must(label, ok, detail = "") {
    checks.push({ label, ok: !!ok, detail: String(detail) });
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
    return !!ok;
  }

  /** 値がぴったり一致することを求めます（トークン由来の値など）。 */
  function mustEq(label, actual, expected) {
    const ok = Object.is(actual, expected) || String(actual) === String(expected);
    checks.push({ label, ok, detail: `${actual} / 期待 ${expected}` });
    console.log(
      `  ${ok ? "✓" : "✗"} ${label}  (${actual}${ok ? "" : ` ← 期待 ${expected}`})`,
    );
    return ok;
  }

  /** 判定と pageerror が両方 0 件なら 0、あれば 1 で終了します。 */
  async function finish() {
    const failed = checks.filter((c) => !c.ok);
    console.log("");
    console.log(
      failed.length === 0
        ? `✅ 判定 ${checks.length} 件すべて成功`
        : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
    );
    for (const f of failed) console.log(`   ✗ ${f.label}  ${f.detail}`);
    console.log(
      errors.length === 0
        ? "✅ pageerror 0 件"
        : `❌ pageerror ${errors.length} 件:\n` + errors.join("\n"),
    );
    await browser.close();
    process.exit(failed.length || errors.length ? 1 : 0);
  }

  return { browser, errors, openTab, finish, must, mustEq, checks };
}

/**
 * 判定に向かない値を、参考として出します。
 * 送信された JSON の中身や、環境で変わる座標などがこれに当たります。
 */
export const log = (...a) => console.log("·", ...a);
