/**
 * v0.5 の検証。docs/plan-v05.md の「実測で確かめる項目」14 個に対応します。
 */
import { launch, log } from "./_browser.mjs";

const { errors, openTab, finish } = await launch();
const open = (width = 1200, height = 950) => openTab("forms", { width, height });

/* ===== 9. 複数値 / 10. 未チェック =============================== */
{
  const page = await open();

  await page.fill('input[name="title"]', "テスト件名");
  await page.selectOption('select[name="team"]', "dev");
  await page.selectOption('select[name="langs"]', ["ts", "rs", "cs"]);
  await page.check('input[name="tags"][value="web"]');
  await page.check('input[name="tags"][value="ml"]');
  await page.check('input[name="plan"][value="pro"]');
  await page.fill('input[name="due"]', "2026-12-24");
  // agree は未チェックのまま

  await page.getByRole("button", { name: "送信して中身を見る" }).click();
  await page.waitForTimeout(900);

  const sent = await page.evaluate(() => {
    const pre = document.querySelector("pre code");
    try {
      return JSON.parse(pre?.textContent ?? "{}");
    } catch {
      return null;
    }
  });
  log("9/10. 送信された値:", JSON.stringify(sent));
  log(
    "    複数選択セレクト:",
    Array.isArray(sent?.langs) ? `配列 ${sent.langs.length} 件 ✓` : "✗ 壊れている",
  );
  log(
    "    チェック群:",
    Array.isArray(sent?.tags) ? `配列 ${sent.tags.length} 件 ✓` : "✗ 壊れている",
  );
  log(
    "    未チェック:",
    "agree" in (sent ?? {}) ? `キーが届く ("${sent.agree}") ✓` : "✗ キーごと無い",
  );

  /* ===== 12. 日付の font-size / 11. タップ領域 ================== */
  const sizes = await page.evaluate(() => {
    const date = document.querySelector('input[name="due"]');
    const boxes = [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')];
    const labels = boxes
      .map((b) => b.closest("label"))
      .filter(Boolean)
      .map((l) => {
        const r = l.getBoundingClientRect();
        return Math.round(r.height);
      });
    return {
      dateFontSize: date ? parseFloat(getComputedStyle(date).fontSize) : null,
      // 非表示(カード表示用)のものは 0 になるので除く
      ラベルの高さ: [...new Set(labels.filter((h) => h > 0))],
    };
  });
  log("11/12.", JSON.stringify(sizes));

  /* ===== 13. RadioGroup の構造 ================================== */
  const radio = await page.evaluate(() => {
    const input = document.querySelector('input[name="plan"]');
    const fs = input?.closest("fieldset");
    return {
      fieldset: !!fs,
      legend: fs?.querySelector("legend")?.textContent?.trim(),
    };
  });
  log("13. RadioGroup:", JSON.stringify(radio));

  /* --- フィールドエラーが radio group にも出るか --- */
  // ?tab= を持ったままなので、reload だけで同じタブに戻ります
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill('input[name="title"]', "x");
  await page.getByRole("button", { name: "送信して中身を見る" }).click();
  await page.waitForTimeout(900);
  const fieldErr = await page.locator("fieldset p[role=alert]").allTextContents();
  log("    プラン未選択のエラー:", JSON.stringify(fieldErr));

  await page.close();
}

/* ===== 1〜5. 行選択 ============================================= */
{
  const page = await open();
  const table = page.locator("table").first();

  // 1. indeterminate（属性ではなくプロパティ）
  await page.locator('table tbody input[type="checkbox"]').first().click();
  await page.waitForTimeout(200);
  const ind = await page.evaluate(() => {
    const head = document.querySelector('table thead input[type="checkbox"]');
    return {
      indeterminate: head?.indeterminate,
      checked: head?.checked,
      属性として存在: head?.hasAttribute("indeterminate"),
    };
  });
  log("1. indeterminate:", JSON.stringify(ind));

  // 3. 行クリックに伝播しないか（伝播すると Toast が出る）
  const toasts = await page.locator('[role="status"],[role="alert"]').count();
  log("3. チェックで行クリックが発火しない:", toasts === 0 ? "✓" : `✗ (${toasts})`);

  // 2. ページを移っても残るか
  await page.getByRole("button", { name: "次へ" }).first().click();
  await page.waitForTimeout(300);
  const afterPage = await page.getByText(/^\d+ 件選択中$/).textContent();
  log("2. ページ移動後:", JSON.stringify(afterPage?.trim()));

  // ヘッダで「表示中を全選択」
  await page.locator('table thead input[type="checkbox"]').click();
  await page.waitForTimeout(300);
  const afterAll = await page.getByText(/^\d+ 件選択中$/).textContent();
  log("   表示中を全選択した後:", JSON.stringify(afterAll?.trim()));

  // 5. Shift+クリックの範囲選択
  await page.getByRole("button", { name: "全解除" }).click();
  await page.waitForTimeout(250);
  const boxes = page.locator('table tbody input[type="checkbox"]');
  await boxes.nth(0).click();
  await boxes.nth(3).click({ modifiers: ["Shift"] });
  await page.waitForTimeout(250);
  const afterShift = await page.getByText(/^\d+ 件選択中$/).textContent();
  log("5. Shift+クリック:", JSON.stringify(afterShift?.trim()));

  // 4. 並べ替えても同じ行に付いているか
  const before = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows
      .filter((r) => r.querySelector('input[type="checkbox"]')?.checked)
      .map((r) => r.querySelectorAll("td")[2]?.textContent?.trim());
  });
  await page.locator("th button").nth(3).click(); // 金額で並べ替え
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows
      .filter((r) => r.querySelector('input[type="checkbox"]')?.checked)
      .map((r) => r.querySelectorAll("td")[2]?.textContent?.trim());
  });
  const sortedAmounts = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("table tbody tr")];
    return rows.map((r) =>
      Number(r.querySelectorAll("td")[4]?.textContent?.replace(/[^0-9]/g, "")),
    );
  });
  const ascending = sortedAmounts.every(
    (v, i, a) => i === 0 || a[i - 1] <= v,
  );
  log(
    "4b. 整形済み列の並べ替え:",
    `${JSON.stringify(sortedAmounts)} → 昇順=${ascending ? "✓" : "✗"}`,
  );

  const count = await page.getByText(/^\d+ 件選択中$/).textContent();
  log(
    "4. 並べ替え後:",
    `選択件数=${count?.trim()} / 並べ替え前の可視選択=${JSON.stringify(before)} 後=${JSON.stringify(after)}`,
  );
  await page.close();
}

/* ===== 6〜8. 楽観更新 =========================================== */
{
  const page = await open();
  const input = page.getByLabel("やることの題名");

  // 6. 追加が失敗しても、同時に走った削除が復活しないか
  await input.fill("fail-add-me");
  await page.getByRole("button", { name: "追加" }).click();
  await page.waitForTimeout(120); // 追加が保留中のうちに
  // 「レイアウトを直す」を削除する
  const rows = page.locator("section", { hasText: "useOptimisticList" });
  await page
    .getByRole("button", { name: "削除" })
    .first()
    .click();
  await page.waitForTimeout(1600); // 追加(900ms)が失敗、削除(900ms)は成功

  const items = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("h2")];
    const h = heads.find((x) => x.textContent?.includes("useOptimisticList"));
    const panel = h?.closest("div")?.parentElement?.parentElement;
    return [...(panel?.querySelectorAll("span") ?? [])]
      .map((s) => s.textContent?.trim())
      .filter((t) => t && /レイアウト|フォーム|端末幅|fail-add-me/.test(t));
  });
  log("6. 追加失敗後の一覧:", JSON.stringify(items));
  log(
    "   → fail-add-me が消え、削除した項目が復活していないこと",
  );

  // 8. 再取得しても保留中が消えないか
  await input.fill("pending-check");
  await page.getByRole("button", { name: "追加" }).click();
  await page.waitForTimeout(150);
  const pendingBefore = await page.getByText(/保留中: /).textContent();
  await page.getByRole("button", { name: /再取得/ }).click();
  await page.waitForTimeout(300);
  const pendingAfter = await page.getByText(/保留中: /).textContent();
  log(
    "8. 再取得:",
    `${pendingBefore?.trim()} → ${pendingAfter?.trim()}（消えていないこと）`,
  );
  await page.waitForTimeout(1500);
  await page.close();
}

await finish();
