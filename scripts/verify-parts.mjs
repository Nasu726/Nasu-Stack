/**
 * v0.4 の部品を実ブラウザで検証します。
 * docs/plan-v04.md の「実測で確かめる項目」10 個に対応しています。
 */
import { launch, log, isPainted } from "./_browser.mjs";

const { errors, openTab, finish, must, mustEq } = await launch();
const openParts = (width = 1100, height = 900) =>
  openTab("parts", { width, height });


/* ===== 1. dialog::backdrop にスタイルが効くか ===================== */
{
  const page = await openParts();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const d = document.querySelector("dialog");
    if (!d) return null;
    const bd = getComputedStyle(d, "::backdrop");
    return {
      open: d.open,
      backdrop: bd.backgroundColor,
      // top layer に入っているか（他要素より必ず手前）
      matchesTopLayer: d.matches(":modal"),
    };
  });
  must("1. dialog が showModal で開く（:modal にマッチ）", r?.matchesTopLayer, JSON.stringify(r));
  must("   ::backdrop に色が付く", isPainted(r?.backdrop), r?.backdrop);

  /* ===== 2. Esc で閉じ、フォーカスが戻るか ======================== */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const afterEsc = await page.evaluate(() => ({
    open: document.querySelector("dialog")?.open ?? false,
    focused: document.activeElement?.textContent?.trim().slice(0, 12),
  }));
  must("2. Esc で閉じる", afterEsc.open === false);
  must(
    "   閉じたら開いた要素へフォーカスが戻る",
    (afterEsc.focused ?? "").includes("削除"),
    afterEsc.focused,
  );

  /* ===== 3. 決定すると true が返るか（通知で確認） ================ */
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page.waitForTimeout(250);
  await page.locator("dialog").getByRole("button", { name: "削除する" }).click();
  await page.waitForTimeout(400);
  const decided = (
    await page.locator('[role="status"],[role="alert"]').allTextContents()
  )
    .join(" ")
    .trim();
  must("3. 決定すると後続の処理が走る", decided.length > 0, decided.slice(0, 30));
  await page.close();
}

/* ===== 4. 表が Scrollable の中で潰れないか ======================= */
{
  const page = await openParts();
  const r = await page.evaluate(() => {
    const t = document.querySelector("table");
    if (!t) return null;
    const cs = getComputedStyle(t);
    return {
      width: Math.round(t.getBoundingClientRect().width),
      minWidth: cs.minWidth,
      headers: t.querySelectorAll("th").length,
    };
  });
  must("4. 表が潰れない（min-width が効いている）", parseFloat(r?.minWidth ?? "0") > 0, JSON.stringify(r));

  /* ===== 5. 並べ替えの aria-sort とキーボード ==================== */
  const sortBtn = page.locator("th button").first();
  await sortBtn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const sortState = await page.evaluate(() => {
    const ths = [...document.querySelectorAll("th")];
    return ths.map((t) => t.getAttribute("aria-sort")).filter(Boolean);
  });
  const firstCell = await page.locator("tbody tr td").first().textContent();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const firstCell2 = await page.locator("tbody tr td").first().textContent();
  must(
    "5. 並べ替え中の列に aria-sort が付く",
    sortState.some((v) => v === "ascending" || v === "descending"),
    JSON.stringify(sortState),
  );
  must(
    "   キーボード（Enter）で昇順と降順が切り替わる",
    firstCell?.trim() !== firstCell2?.trim(),
    `${firstCell?.trim()} → ${firstCell2?.trim()}`,
  );

  /* ===== 6. ページング ============================================ */
  const pager = await page.getByText(/^\d+ \/ \d+$/).first().textContent();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(250);
  const pager2 = await page.getByText(/^\d+ \/ \d+$/).first().textContent();
  must(
    "6. 次へでページが進む",
    pager?.trim() !== pager2?.trim(),
    `${pager?.trim()} → ${pager2?.trim()}`,
  );
  await page.close();
}

/* ===== 7. 狭い画面でカードに組み替わり、列名が読めるか ============ */
{
  const page = await openParts(375, 800);
  const r = await page.evaluate(() => {
    const table = document.querySelector("table");
    const tableVisible = table
      ? table.getBoundingClientRect().width > 0
      : false;
    // カード側: 「金額」というラベルが本文中に出ているか
    const labels = [...document.querySelectorAll("span")]
      .map((s) => s.textContent?.trim())
      .filter((t) => ["日付", "案件", "状態", "件数", "金額"].includes(t));
    return { tableVisible, カードの列名: [...new Set(labels)] };
  });
  must("7. 375px では表が消える", r.tableVisible === false);
  must(
    "   カードに列名が付く（カードでは列名が唯一の手がかり）",
    r.カードの列名.length >= 4,
    JSON.stringify(r.カードの列名),
  );
  await page.close();
}

/* ===== 8. AsyncSelect: キーボード操作と APG 属性 ================= */
{
  const page = await openParts();
  const input = page.getByRole("combobox", { name: /担当者/ });
  await input.click();
  await page.waitForTimeout(700);

  const attrs = await page.evaluate(() => {
    const el = document.querySelector('[role="combobox"]');
    return {
      expanded: el?.getAttribute("aria-expanded"),
      autocomplete: el?.getAttribute("aria-autocomplete"),
      controls: !!el?.getAttribute("aria-controls"),
      activedescendant: el?.getAttribute("aria-activedescendant"),
      options: document.querySelectorAll('[role="option"]').length,
      fontSize: el ? parseFloat(getComputedStyle(el).fontSize) : null,
    };
  });
  mustEq("8. combobox の aria-expanded", attrs.expanded, "true");
  mustEq("   aria-autocomplete", attrs.autocomplete, "list");
  must("   aria-controls がある", attrs.controls);
  must("   候補が出る", attrs.options > 0, `${attrs.options} 件`);
  must(
    "   入力欄の文字が 16px 以上（iOS の自動拡大よけ）",
    (attrs.fontSize ?? 0) >= 16,
    `${attrs.fontSize}px`,
  );

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  const activeIdx = await page.evaluate(
    () =>
      document
        .querySelector('[role="combobox"]')
        ?.getAttribute("aria-activedescendant") ?? "",
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const chosen = await page.getByText(/^選択中:/).textContent();
  // 開いた時点で先頭（0）が選ばれているので、↓ を 2 回押すと 2 になります
  must(
    "9. ↓ を 2 回で aria-activedescendant が 3 番目（index 2）を指す",
    activeIdx.endsWith("-opt-2"),
    activeIdx,
  );
  must(
    "   Enter で選択が確定する",
    /選択中: .+/.test(chosen?.trim() ?? "") && !/選択中: *$/.test(chosen?.trim() ?? ""),
    chosen?.trim(),
  );

  /* ===== 10. 前の要求が中断されるか（打ち直し） ================== */
  await input.click();
  await input.fill("");
  await input.type("Bo", { delay: 30 });
  await page.waitForTimeout(120);
  await input.fill("");
  await input.type("千葉", { delay: 30 });
  await page.waitForTimeout(900);
  const finalOptions = await page
    .locator('[role="option"]')
    .allTextContents();
  // 古い応答が新しい応答を上書きしていたら "Bo" の結果が残ります
  must(
    "10. 打ち直すと前の要求が中断され、古い候補が残らない",
    finalOptions.length > 0 && finalOptions.every((t) => !/^Bo/i.test(t.trim())),
    JSON.stringify(finalOptions.slice(0, 3)),
  );
  await page.close();
}

/* ===== 11. 320px 最下部で候補が画面内に収まるか ================== */
{
  const page = await openParts(320, 600);
  // AsyncSelect が画面の下端に来るまでスクロール
  await page.evaluate(() => {
    const el = document.querySelector('[role="combobox"]');
    el?.scrollIntoView({ block: "end" });
    window.scrollBy(0, -40); // 入力欄を画面下部に置く
  });
  await page.waitForTimeout(300);
  await page.locator('[role="combobox"]').click();
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const list = document.querySelector('[role="listbox"]');
    const input = document.querySelector('[role="combobox"]');
    if (!list || !input) return null;
    const lr = list.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    return {
      入力欄の下端: Math.round(ir.bottom),
      画面の高さ: window.innerHeight,
      候補の上端: Math.round(lr.top),
      候補の下端: Math.round(lr.bottom),
      画面内に収まる: lr.top >= -1 && lr.bottom <= window.innerHeight + 1,
      出た向き: lr.top < ir.top ? "上" : "下",
    };
  });
  must("11. 320px の最下部でも候補が画面内に収まる", r?.画面内に収まる, JSON.stringify(r));
  await page.close();
}

/* ===== 12. FileDrop: 進捗・失敗・再送・中断 ====================== */
{
  const page = await openParts();
  const input = page.locator('input[type="file"]');

  // 成功する 1 件と、失敗する 1 件を同時に積む
  await input.setInputFiles([
    { name: "ok-photo.png", mimeType: "image/png", buffer: Buffer.alloc(120000) },
    { name: "fail-doc.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(90000) },
  ]);
  await page.waitForTimeout(400);
  const mid = await page.evaluate(() => ({
    progressbars: document.querySelectorAll('[role="progressbar"]').length,
    now: [...document.querySelectorAll('[role="progressbar"]')].map((p) =>
      p.getAttribute("aria-valuenow"),
    ),
  }));
  must(
    "12. アップロード中に進捗バーが出る",
    mid.progressbars >= 2,
    JSON.stringify(mid),
  );

  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({
    エラー表示: [...document.querySelectorAll('[role="alert"]')]
      .map((e) => e.textContent?.trim())
      .filter(Boolean),
    再送ボタン: [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "再送",
    ).length,
  }));
  must(
    "13. 失敗した 1 件だけにエラーと再送が出る",
    after.再送ボタン === 1 && after.エラー表示.length >= 1,
    JSON.stringify(after),
  );

  // サイズ超過が弾かれるか
  await input.setInputFiles([
    { name: "big.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(3 * 1024 * 1024) },
  ]);
  await page.waitForTimeout(400);
  const tooBig = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"]')]
      .map((e) => e.textContent?.trim())
      .filter((t) => t?.includes("超えて")),
  );
  must("14. サイズ超過が弾かれる", tooBig.length >= 1, JSON.stringify(tooBig));
  await page.close();
}

await finish();
