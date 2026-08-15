/**
 * v0.5 の検証。docs/plan-v05.md の「実測で確かめる項目」14 個に対応します。
 */
import { launch, log } from "./_browser.mjs";

const { errors, openTab, finish, must, mustEq } = await launch();
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
  log("送信された値:", JSON.stringify(sent));
  // Object.fromEntries(fd.entries()) に戻すと、ここが 3 つとも落ちます
  must(
    "9. 複数選択セレクトが配列で届く",
    Array.isArray(sent?.langs) && sent.langs.length === 3,
    JSON.stringify(sent?.langs),
  );
  must(
    "   同じ name のチェック群が配列で届く",
    Array.isArray(sent?.tags) && sent.tags.length === 2,
    JSON.stringify(sent?.tags),
  );
  must(
    "10. 未チェックのチェックボックスもキーが届く",
    sent !== null && "agree" in sent,
    JSON.stringify(sent?.agree),
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
  must(
    "12. 日付入力の文字も 16px 以上（iOS の自動拡大よけ）",
    (sizes.dateFontSize ?? 0) >= 16,
    `${sizes.dateFontSize}px`,
  );
  must(
    "11. チェック／ラジオの当たり判定が 44px 以上",
    sizes["ラベルの高さ"].every((h) => h >= 44),
    JSON.stringify(sizes["ラベルの高さ"]),
  );

  /* ===== 13. RadioGroup の構造 ================================== */
  const radio = await page.evaluate(() => {
    const input = document.querySelector('input[name="plan"]');
    const fs = input?.closest("fieldset");
    return {
      fieldset: !!fs,
      legend: fs?.querySelector("legend")?.textContent?.trim(),
    };
  });
  must("13. RadioGroup が fieldset で囲まれている", radio.fieldset);
  must(
    "    legend に見出しが入っている（div+label では代用できない）",
    !!radio.legend,
    radio.legend,
  );

  /* --- フィールドエラーが radio group にも出るか --- */
  // ?tab= を持ったままなので、reload だけで同じタブに戻ります
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill('input[name="title"]', "x");
  await page.getByRole("button", { name: "送信して中身を見る" }).click();
  await page.waitForTimeout(900);
  const fieldErr = await page.locator("fieldset p[role=alert]").allTextContents();
  must(
    "    選択群にもフィールド単位のエラーが出る",
    fieldErr.length >= 1,
    JSON.stringify(fieldErr),
  );

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
  must("1. 一部選択で indeterminate が立つ", ind.indeterminate === true, JSON.stringify(ind));
  must(
    "   indeterminate は属性ではなくプロパティ（JSX に書いても効かない）",
    ind["属性として存在"] === false,
  );

  // 3. 行クリックに伝播しないか（伝播すると Toast が出る）
  const toasts = await page.locator('[role="status"],[role="alert"]').count();
  must("3. チェックのクリックが行クリックへ伝播しない", toasts === 0, `通知 ${toasts} 件`);

  // 2. ページを移っても残るか
  await page.getByRole("button", { name: "次へ" }).first().click();
  await page.waitForTimeout(300);
  const afterPage = await page.getByText(/^\d+ 件選択中$/).textContent();
  must(
    "2. ページを移っても選択が残る（キーで保持している）",
    /^1 件選択中$/.test(afterPage?.trim() ?? ""),
    afterPage?.trim(),
  );

  // ヘッダで「表示中を全選択」。
  // **件数をべた書きで期待してはいけません。** 1 ページの行数を変えた瞬間に
  // 落ちて、しかも部品は壊れていません。見たい性質は
  // 「増えたのは、いま表示している行のぶんだけ」です。
  const num = (t) => Number((t ?? "").replace(/[^0-9]/g, ""));
  const visibleUnselected = await page.evaluate(
    () =>
      [...document.querySelectorAll("table tbody tr")].filter(
        (r) => !r.querySelector('input[type="checkbox"]')?.checked,
      ).length,
  );
  await page.locator('table thead input[type="checkbox"]').click();
  await page.waitForTimeout(300);
  const afterAll = await page.getByText(/^\d+ 件選択中$/).textContent();
  must(
    "   ヘッダのチェックは「表示中の行」だけを足す",
    num(afterAll) === num(afterPage) + visibleUnselected,
    `${num(afterPage)} + 表示中 ${visibleUnselected} = ${num(afterAll)}`,
  );

  // 5. Shift+クリックの範囲選択
  await page.getByRole("button", { name: "全解除" }).click();
  await page.waitForTimeout(250);
  const boxes = page.locator('table tbody input[type="checkbox"]');
  await boxes.nth(0).click();
  await boxes.nth(3).click({ modifiers: ["Shift"] });
  await page.waitForTimeout(250);
  const afterShift = await page.getByText(/^\d+ 件選択中$/).textContent();
  must(
    "5. Shift+クリックで範囲選択できる",
    /^4 件選択中$/.test(afterShift?.trim() ?? ""),
    afterShift?.trim(),
  );

  /* 4. 並べ替えても同じ行に付いているか。
     **画面に見えている選択行を比べてはいけません。** 並べ替えると
     選ばれた行が別のページへ移るので、見えなくなるのが正常です。
     見たい性質は「選択そのものが失われていないこと」です。 */
  const countBefore = await page.getByText(/^\d+ 件選択中$/).textContent();
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
  // get で "¥12,400" のように整形した列を、整形後の文字列で並べ替えると
  // "¥2,600" が "¥12,400" より後ろに来ます。元の値で並ぶことを見ます。
  must(
    "4b. 整形済みの列でも数値として正しく並ぶ",
    ascending,
    JSON.stringify(sortedAmounts),
  );

  const countAfter = await page.getByText(/^\d+ 件選択中$/).textContent();
  must(
    "4. 並べ替えても選択件数が変わらない（index ではなくキーで持っている）",
    num(countAfter) === num(countBefore),
    `${countBefore?.trim()} → ${countAfter?.trim()}`,
  );
  // 見えている行は入れ替わって当然なので、参考として出すだけにします
  log("   並べ替え前の可視選択:", JSON.stringify(before), "後:", JSON.stringify(after));
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
  // 「配列を控えて戻す」実装だと、ここで削除した項目が復活します
  must(
    "6. 追加が失敗しても、同時に走った削除が取り消されない",
    !items.includes("fail-add-me") && !items.some((t) => /レイアウトを直す/.test(t)),
    JSON.stringify(items),
  );

  // 8. 再取得しても保留中が消えないか
  await input.fill("pending-check");
  await page.getByRole("button", { name: "追加" }).click();
  await page.waitForTimeout(150);
  const pendingBefore = await page.getByText(/保留中: /).textContent();
  await page.getByRole("button", { name: /再取得/ }).click();
  await page.waitForTimeout(300);
  const pendingAfter = await page.getByText(/保留中: /).textContent();
  must(
    "8. 再取得しても保留中の操作が消えない",
    pendingAfter?.trim() === pendingBefore?.trim(),
    `${pendingBefore?.trim()} → ${pendingAfter?.trim()}`,
  );
  await page.waitForTimeout(1500);
  await page.close();
}

await finish();
