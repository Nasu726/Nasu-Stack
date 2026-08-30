/**
 * v0.5 の検証。docs/plan-v05.md の「実測で確かめる項目」14 個に対応します。
 */
import { launch, log } from "./_browser.mjs";

const { errors, openTab, finish, must, mustEq } = await launch();
const open = (width = 1200, height = 950) => openTab("forms", { width, height });

/* ===== 9. 複数値 / 10. 未チェック =============================== */
{
  const page = await open();

  await page.fill('input[name="title"]', "  テスト件名  ");
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
  must(
    "    validation success の変換済み data が action へ届く",
    sent?.title === "テスト件名" && sent?.agree === false,
    JSON.stringify({ title: sent?.title, agree: sent?.agree }),
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
      ariaRequired: fs?.getAttribute("aria-required"),
      nativeRequired: [...(fs?.querySelectorAll('input[type="radio"]') ?? [])]
        .every((control) => control.required),
    };
  });
  must("13. RadioGroup が fieldset で囲まれている", radio.fieldset);
  must(
    "    legend に見出しが入っている（div+label では代用できない）",
    !!radio.legend,
    radio.legend,
  );
  must(
    "    requiredはfieldsetのARIAとnative radioへ届く",
    radio.ariaRequired === "true" && radio.nativeRequired,
    JSON.stringify(radio),
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

  const validationA11y = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="validation-form"] form');
    const active = document.activeElement;
    const describedBy = active?.getAttribute("aria-describedby") ?? "";
    const described = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    return {
      actionCalls: document
        .querySelector('[data-testid="validation-form"]')
        ?.getAttribute("data-action-calls"),
      activeName: active?.getAttribute("name"),
      activeInvalid: active?.getAttribute("aria-invalid"),
      describedAlerts: described.filter((node) => node.getAttribute("role") === "alert").length,
      allAlerts: form?.querySelectorAll('p[role="alert"]').length ?? 0,
    };
  });
  must(
    "    client validation が失敗したら action を呼ばない",
    validationA11y.actionCalls === "0",
    `${validationA11y.actionCalls} 回`,
  );
  must(
    "    submit 後は DOM 順で最初の invalid field へ focus する",
    validationA11y.activeName === "title",
    validationA11y.activeName,
  );
  must(
    "    focused field は aria-invalid と aria-describedby で error を辿れる",
    validationA11y.activeInvalid === "true" && validationA11y.describedAlerts === 1,
    JSON.stringify(validationA11y),
  );
  must(
    "    field error と form error を二重表示しない",
    validationA11y.allAlerts === 2,
    `${validationA11y.allAlerts} 件`,
  );

  // client error を直した次の送信で server が別 field を拒否する。
  // 前の client error と server error が同時に残らないことを見ます。
  await page.fill('input[name="title"]', "server case");
  await page.selectOption('select[name="team"]', "qa");
  await page.check('input[name="plan"][value="pro"]');
  await page.getByRole("button", { name: "送信して中身を見る" }).click();
  await page.waitForTimeout(700);
  const serverValidation = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="validation-form"] form');
    return {
      actionCalls: document
        .querySelector('[data-testid="validation-form"]')
        ?.getAttribute("data-action-calls"),
      activeName: document.activeElement?.getAttribute("name"),
      alerts: [...(form?.querySelectorAll('p[role="alert"]') ?? [])].map((node) =>
        node.textContent?.trim(),
      ),
    };
  });
  must(
    "    client success 後の server validation は action から戻る",
    serverValidation.actionCalls === "1" && serverValidation.activeName === "team",
    JSON.stringify(serverValidation),
  );
  must(
    "    server error へ切り替わったら古い client error を残さない",
    serverValidation.alerts.length === 1 &&
      serverValidation.alerts[0]?.includes("QA チーム"),
    JSON.stringify(serverValidation.alerts),
  );

  await page.close();
}

/* ===== FormData / inherited options / prop ownership ============= */
{
  const page = await open();

  const fold = page.getByTestId("form-fold-probe");
  await fold.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(100);
  const folded = JSON.parse(
    (await page.getByTestId("form-fold-result").textContent()) || "null",
  );
  must(
    "FormDataはnull prototypeでprototype系nameを通常dataとして保持する",
    folded?.nullPrototype === true &&
      folded.values?.__proto__ === "prototype-safe" &&
      folded.values?.constructor === "constructor-safe",
    JSON.stringify(folded),
  );
  must(
    "    同名の空文字+値は順序を保った配列になる",
    JSON.stringify(folded?.values?.repeated) === JSON.stringify(["", "hello"]),
    JSON.stringify(folded?.values?.repeated),
  );
  must(
    "    旧sentinel文字列は利用者dataとして保持し、未checkは別経路で空にする",
    folded?.values?.["sentinel-literal"] === "__wt_unchecked__" &&
      folded?.values?.unchecked === "",
    JSON.stringify(folded?.values),
  );

  const propProbe = page.getByTestId("form-prop-probe");
  await propProbe.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(80);
  const guardPhase = await propProbe.evaluate((root) => {
    const submit = root.querySelector('button[type="submit"]');
    return { disabled: submit?.disabled, busy: submit?.getAttribute("aria-busy") };
  });
  must(
    "AsyncFormはpendingDuringGuard=falseをuseActionへforwardする",
    guardPhase.disabled === false && guardPhase.busy !== "true",
    JSON.stringify(guardPhase),
  );

  await page.waitForTimeout(200);
  const actionPhase = await propProbe.evaluate((root) =>
    [...root.querySelectorAll("input, select")]
      .filter((control) => control.getAttribute("type") !== "hidden")
      .every((control) => control.disabled),
  );
  must(
    "    action pending中は利用者のdisabled=falseでも全controlを無効にする",
    actionPhase,
  );

  await page.waitForTimeout(250);
  const errors = await propProbe.evaluate((root) =>
    ["field", "select", "checkbox", "date"].map((name) => {
      const control = root.querySelector(`[name="${name}"]`);
      const ids = (control?.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(Boolean);
      return {
        name,
        invalid: control?.getAttribute("aria-invalid"),
        hasOwner: ids.some((id) => id.startsWith("owner-")),
        hasError: ids.some(
          (id) => document.getElementById(id)?.getAttribute("role") === "alert",
        ),
      };
    }),
  );
  must(
    "    内部ARIAは利用者ARIAとcomposeし、error時のinvalidを上書きさせない",
    errors.every(
      (item) => item.invalid === "true" && item.hasOwner && item.hasError,
    ),
    JSON.stringify(errors),
  );
  must(
    "    HTTP 400でもfield errorは自動retryしない",
    (await page.getByTestId("form-prop-calls").textContent()) === "1",
    await page.getByTestId("form-prop-calls").textContent(),
  );

  await propProbe.locator('input[name="field"]').evaluate((control) =>
    control.dispatchEvent(new Event("input", { bubbles: true })),
  );
  await propProbe.locator('select[name="select"]').evaluate((control) =>
    control.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await propProbe.locator('input[name="checkbox"]').evaluate((control) =>
    control.click(),
  );
  await propProbe.locator('input[name="date"]').evaluate((control) =>
    control.dispatchEvent(new Event("input", { bubbles: true })),
  );
  await page.waitForTimeout(100);
  must(
    "    内部error clearの後に利用者event handlerも全て呼ぶ",
    (await propProbe.locator('p[role="alert"]').count()) === 0 &&
      (await propProbe.getAttribute("data-owner-events")) === "4",
    `${await propProbe.locator('p[role="alert"]').count()} errors / ` +
      `${await propProbe.getAttribute("data-owner-events")} owner events`,
  );

  const unknown = page.getByTestId("unknown-field-probe");
  await unknown.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(100);
  must(
    "存在しないfield名だけのfailureは一般errorとして画面に残る",
    (await unknown.textContent())?.includes("unknown field is visible") ?? false,
  );

  await page.close();
}

/* ===== FieldArray: stable key / min-max / focus / nested path ===== */
{
  const page = await open();
  const form = page.getByTestId("field-array-form");
  const array = form.locator('[data-field-array="members"]');

  const initial = await array.evaluate((root) => ({
    legend: root.querySelector("legend")?.textContent?.trim(),
    names: [...root.querySelectorAll('[data-field-array-item]')].map((node) =>
      node.getAttribute("data-field-array-item"),
    ),
    keys: [...root.querySelectorAll('[data-field-array-key]')].map((node) =>
      node.getAttribute("data-field-array-key"),
    ),
  }));
  must(
    "FieldArray は fieldset / legend と連続した nested name を作る",
    initial.legend === "メンバー" &&
      JSON.stringify(initial.names) ===
        JSON.stringify(["members.0", "members.1"]),
    JSON.stringify(initial),
  );

  // 再描画前に2回 clickされても、maxを越えず、実際に足した行へfocusする。
  await form.getByRole("button", { name: "メンバーを追加" }).dblclick();
  await page.waitForTimeout(100);
  const afterAdd = await array.evaluate((root) => ({
    count: root.querySelectorAll('[data-field-array-item]').length,
    activeName: document.activeElement?.getAttribute("name"),
    addDisabled: root.querySelector('[data-field-array-add]')?.disabled,
    status: root.querySelector('[role="status"]')?.textContent?.trim(),
  }));
  must(
    "    同一描画内の連打でもmaxを越えず、追加した行へ focus する",
    afterAdd.count === 3 && afterAdd.activeName === "members.2.email",
    JSON.stringify(afterAdd),
  );
  must(
    "    max では追加を無効にし、polite status へ操作を出す",
    afterAdd.addDisabled === true && afterAdd.status === "メンバーを追加",
    JSON.stringify(afterAdd),
  );

  const emails = array.locator('input[name$=".email"]');
  await emails.nth(0).fill("keep-first@example.com");
  await emails.nth(1).fill("keep-second@example.com");
  await emails.nth(2).fill("keep-third@example.com");
  const beforeRemove = await array.evaluate((root) => ({
    keys: [...root.querySelectorAll('[data-field-array-key]')].map((node) =>
      node.getAttribute("data-field-array-key"),
    ),
    values: [...root.querySelectorAll('input[name$=".email"]')].map(
      (node) => node.value,
    ),
  }));

  await form.getByRole("button", { name: "メンバー 1 を削除" }).click();
  await page.waitForTimeout(100);
  const afterRemove = await array.evaluate((root) => ({
    keys: [...root.querySelectorAll('[data-field-array-key]')].map((node) =>
      node.getAttribute("data-field-array-key"),
    ),
    names: [...root.querySelectorAll('input[name$=".email"]')].map((node) =>
      node.getAttribute("name"),
    ),
    values: [...root.querySelectorAll('input[name$=".email"]')].map(
      (node) => node.value,
    ),
    activeName: document.activeElement?.getAttribute("name"),
  }));
  must(
    "    行を消しても残った stable key と入力値を保つ",
    JSON.stringify(afterRemove.keys) ===
      JSON.stringify(beforeRemove.keys.slice(1)) &&
      JSON.stringify(afterRemove.values) ===
        JSON.stringify(beforeRemove.values.slice(1)),
    JSON.stringify({ beforeRemove, afterRemove }),
  );
  must(
    "    削除後は隣の行へ focus し、name の index を詰める",
    afterRemove.activeName === "members.0.email" &&
      JSON.stringify(afterRemove.names) ===
        JSON.stringify(["members.0.email", "members.1.email"]),
    JSON.stringify(afterRemove),
  );

  // 2 行目だけ失敗させ、正確な nested path / ARIA / focus を見ます。
  await array.locator('input[name="members.1.email"]').fill("");
  await form.getByRole("button", { name: "メンバーを保存" }).click();
  await page.waitForTimeout(100);
  const nestedError = await array.evaluate((root) => {
    const active = document.activeElement;
    const ids = (active?.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean);
    return {
      activeName: active?.getAttribute("name"),
      invalid: active?.getAttribute("aria-invalid"),
      alertLinked: ids.some(
        (id) => document.getElementById(id)?.getAttribute("role") === "alert",
      ),
    };
  });
  must(
    "    nested validation path は該当 control の ARIA と focus へ届く",
    nestedError.activeName === "members.1.email" &&
      nestedError.invalid === "true" &&
      nestedError.alertLinked,
    JSON.stringify(nestedError),
  );

  // index 1 の error がある状態で index 0 を消す。古い error を残すと、
  // 同じ行が index 0 になった後も誤った path の表示が居残ります。
  await form.getByRole("button", { name: "メンバー 1 を削除" }).click();
  await page.waitForTimeout(100);
  const afterErrorRemove = await array.evaluate((root) => ({
    count: root.querySelectorAll('[data-field-array-item]').length,
    alerts: root.querySelectorAll('[role="alert"]').length,
    activeName: document.activeElement?.getAttribute("name"),
    removeDisabled: root.querySelector('[data-field-array-remove]')?.disabled,
  }));
  must(
    "    構造変更時は古い nested error を消して隣の行へ focus する",
    afterErrorRemove.alerts === 0 &&
      afterErrorRemove.activeName === "members.0.email",
    JSON.stringify(afterErrorRemove),
  );
  must(
    "    min では削除を無効にする",
    afterErrorRemove.count === 1 && afterErrorRemove.removeDisabled === true,
    JSON.stringify(afterErrorRemove),
  );

  await array
    .locator('input[name="members.0.email"]')
    .fill("saved@example.com");
  await form.getByRole("button", { name: "メンバーを保存" }).click();
  await page.waitForTimeout(350);
  const success = await page.evaluate(() => {
    const result = document.querySelector('[data-testid="field-array-result"] code');
    const root = document.querySelector('[data-field-array="members"]');
    let sent = null;
    try {
      sent = JSON.parse(result?.textContent ?? "null");
    } catch {}
    return {
      sent,
      resetNames: [...(root?.querySelectorAll('input[name$=".email"]') ?? [])].map(
        (node) => node.getAttribute("name"),
      ),
      resetValues: [
        ...(root?.querySelectorAll('input[name$=".email"]') ?? []),
      ].map((node) => node.value),
    };
  });
  must(
    "    action には変換した配列が届く",
    success.sent?.members?.[0]?.email === "saved@example.com",
    JSON.stringify(success.sent),
  );
  must(
    "    AsyncForm の native reset で defaultItems へ戻る",
    JSON.stringify(success.resetNames) ===
      JSON.stringify(["members.0.email", "members.1.email"]) &&
      JSON.stringify(success.resetValues) ===
        JSON.stringify(["first@example.com", "second@example.com"]),
    JSON.stringify(success),
  );

  const optional = page.getByTestId("field-array-empty");
  must(
    "    min=0 の 0 行では empty state を表示する",
    (await optional.locator('[data-field-array-empty="notes"]').count()) === 1,
  );
  await optional.getByRole("button", { name: "補足を追加" }).click();
  await page.waitForTimeout(100);
  must(
    "    empty state からの追加も新しい control へ focus する",
    (await page.evaluate(() => document.activeElement?.getAttribute("name"))) ===
      "notes.0.text",
  );
  await optional.getByRole("button", { name: "補足を削除" }).click();
  await page.waitForTimeout(100);
  const emptyAgain = await optional.evaluate((root) => ({
    empty: !!root.querySelector('[data-field-array-empty="notes"]'),
    focusedAdd:
      document.activeElement?.getAttribute("data-field-array-add") === "notes",
  }));
  must(
    "    最後の行を削除すると empty state と Add button focus へ戻る",
    emptyAgain.empty && emptyAgain.focusedAdd,
    JSON.stringify(emptyAgain),
  );

  await optional.getByRole("button", { name: "最低行数を 2 にする" }).click();
  await page.waitForTimeout(100);
  const afterMinIncrease = await optional.evaluate((root) => ({
    names: [...root.querySelectorAll('[data-field-array-item]')].map((node) =>
      node.getAttribute("data-field-array-item"),
    ),
  }));
  must(
    "    dynamic min を増やすと不足行を補う",
    JSON.stringify(afterMinIncrease.names) ===
      JSON.stringify(["notes.0", "notes.1"]),
    JSON.stringify(afterMinIncrease),
  );

  await optional.getByRole("button", { name: "補足をリセット" }).click();
  await page.waitForTimeout(100);
  const afterDynamicMinReset = await optional.evaluate((root) => ({
    names: [...root.querySelectorAll('[data-field-array-item]')].map((node) =>
      node.getAttribute("data-field-array-item"),
    ),
    removeDisabled: [...root.querySelectorAll('[data-field-array-remove]')].every(
      (node) => node.disabled,
    ),
  }));
  must(
    "    dynamic min を増やした後の native reset でも現在の min を守る",
    JSON.stringify(afterDynamicMinReset.names) ===
      JSON.stringify(["notes.0", "notes.1"]) &&
      afterDynamicMinReset.removeDisabled,
    JSON.stringify(afterDynamicMinReset),
  );

  await page
    .getByTestId("field-array-late-defaults")
    .evaluate((button) => button.click());
  await page.waitForTimeout(100);
  const afterIgnoredDefaults = await optional.evaluate((root) => ({
    names: [...root.querySelectorAll('[data-field-array-item]')].map((node) =>
      node.getAttribute("data-field-array-item"),
    ),
    values: [...root.querySelectorAll('input[name$=".text"]')].map(
      (node) => node.value,
    ),
  }));
  must(
    "    mount後のdefaultItems変更はmax超過でもuncontrolled stateへ同期しない",
    JSON.stringify(afterIgnoredDefaults.names) ===
      JSON.stringify(["notes.0", "notes.1"]) &&
      afterIgnoredDefaults.values.every((value) => value === ""),
    JSON.stringify(afterIgnoredDefaults),
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
  const toasts = await page
    .getByRole("button", { name: "通知を閉じる" })
    .count();
  must("3. チェックのクリックが行クリックへ伝播しない", toasts === 0, `通知 ${toasts} 件`);
  const firstBox = page.locator('table tbody input[type="checkbox"]').first();
  await firstBox.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const afterSpaceToasts = await page
    .getByRole("button", { name: "通知を閉じる" })
    .count();
  must("   チェックの Space も行 action へ伝播しない", afterSpaceToasts === 0, `通知 ${afterSpaceToasts} 件`);

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
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await page.waitForTimeout(120); // 追加が保留中のうちに
  // 「レイアウトを直す」を削除する
  const rows = page.locator("section", { hasText: "useOptimisticList" });
  await page
    .getByRole("button", { name: "削除", exact: true })
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

  // 7. 保留中の追加を利用者が削除したあと、create が成功しても復活しないか。
  // save はわざと AbortSignal を見ません。abort だけに頼る実装では落ちず、
  // operation の cancelled/stale 判定が無ければ約 900ms 後に復活します。
  await input.fill("cancel-pending-add");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  const cancelledRow = page
    .getByText("cancel-pending-add", { exact: true })
    .locator("xpath=../..");
  await cancelledRow
    .getByRole("button", { name: "削除", exact: true })
    .click();
  await page.waitForTimeout(1200);
  must(
    "7. 保留中の追加を削除したら、create 成功後も復活しない",
    (await page.getByText("cancel-pending-add", { exact: true }).count()) === 0,
  );

  // 8. 再取得しても保留中が消えないか
  await input.fill("pending-check");
  await page.getByRole("button", { name: "追加", exact: true }).click();
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
