export async function verifyActionState({ page, must, mustEq, log, shot }) {
  /* 1. 成功パス --------------------------------------------------- */
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForTimeout(200);
  const pendingText = await page
    .getByRole("button", { name: /処理中/ })
    .textContent();
  must("押している間は pending 表示に変わる", /処理中/.test(pendingText ?? ""), pendingText?.trim());
  await page.waitForTimeout(1200);
  const successText = await page
    .getByRole("button", { name: /保存しました/ })
    .textContent();
  must("終わると success 表示に変わる", /保存しました/.test(successText ?? ""), successText?.trim());

  /* 1.5. 成功したまま、ポインタが乗っていても色が残るか ---------------
     **押したあと、マウスはボタンの上に残ります。** つまり成功の見た目は、
     ほぼ必ず hover と同時に出ます。variant 側は `hover:bg-muted` などを
     持っているので、成功色を背景だけ差し替えると hover が上書きし、
     **ほぼ白の文字が薄い背景に溶けて読めなくなります。**
     実測で 0.968（薄い灰）まで飛びました。利用者からの報告で見つけています。 */
  {
    /* **既定（primary）のボタンでは検出できません。** primary の hover は
       brightness なので背景色そのものは変わらず、壊れていても緑のまま通ります。
       実際、最初にこの判定を primary に当てて書いたら、わざと壊しても
       赤くなりませんでした。背景を差し替える hover を持つ outline を見ます。 */
    const btn = page.getByRole("button", { name: /控えめに実行|できました/ });
    await btn.click();
    await page.waitForTimeout(1200);
    await btn.hover();
    await page.waitForTimeout(150);
    const seen = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      const want = getComputedStyle(document.documentElement)
        .getPropertyValue("--success")
        .trim();
      // 比較用に、同じ色を一度ブラウザに解釈させて表記を揃えます
      const probe = document.createElement("span");
      probe.style.backgroundColor = want;
      document.body.appendChild(probe);
      const normalized = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { bg: cs.backgroundColor, want: normalized };
    });
    must(
      "成功したボタンは、ポインタが乗っても成功色のまま",
      seen.bg === seen.want,
      `実測 ${seen.bg} / 期待 ${seen.want}`,
    );
    await page.mouse.move(0, 0);
  }

  /* 1.6. callback が投げても、成功済みの action を retry しない ---------
     ----------------------------------------------------------------
     action は成功し、**サーバ側の副作用はもう起きています。**
     その後 onSuccess が投げたとき、それを「action の失敗」と解釈して
     retry すると、決済もメールも登録も削除も 2 回走ります。

     retry の境界と callback の境界は別物です。
     ここは「押せたか」ではなく **action が何回呼ばれたか** を見ます。 */
  {
    const calls = () =>
      page.getByTestId("calls-cb").textContent().then((t) => Number(t.match(/\d+/)?.[0] ?? -1));
    await page.getByTestId("calls-cb").locator("xpath=../..").getByRole("button").click();
    // retry=3 / retryDelay=50 なので、繰り返すならこの間に終わります
    await page.waitForTimeout(1500);
    const n = await calls();
    must("callback が投げても action は 1 回だけ", n === 1, `${n} 回`);
  }

  /* 1.7. 遅い guard を連打しても、action は 1 回だけ -------------------
     ----------------------------------------------------------------
     `await guard(...)` の**後**に鍵をかけていると、待っている間に
     後続の呼び出しが全部その隙間を通り抜けます。
     下の「5 回連打」の判定は guard の無い経路を見ているので、
     **この race を見ていません。** 別に置きます。 */
  {
    const btn = page.getByTestId("calls-guard").locator("xpath=../..").getByRole("button");
    // guard は150ms待ちます。Playwrightから5回を逐次awaitすると、CIの負荷次第で
    // 合計150msを越え、後半が「連打」ではなく正当な次回操作になります。
    // 同じbrowser task内で同期発火し、同一描画を本当に5回通します。
    await btn.evaluate((button) => {
      for (let i = 0; i < 5; i++) button.click();
    });
    await page.waitForTimeout(1500);
    const t = await page.getByTestId("calls-guard").textContent();
    const n = Number(t.match(/\d+/)?.[0] ?? -1);
    must("遅い guard を 5 回連打しても action は 1 回だけ", n === 1, `${n} 回`);
  }

  /* 1.75. 上位componentがuseAction optionを本当にforwardする ---------- */
  {
    const btn = page.getByTestId("action-guard-forward-run");
    await btn.evaluate((button) => button.click());
    await page.waitForTimeout(80);
    const duringGuard = {
      disabled: await btn.getAttribute("disabled"),
      busy: await btn.getAttribute("aria-busy"),
    };
    must(
      "ActionButtonは自前guardのpendingDuringGuard=falseを尊重する",
      duringGuard.disabled === null && duringGuard.busy !== "true",
      JSON.stringify(duringGuard),
    );

    await page.waitForTimeout(200);
    const duringAction = {
      disabled: await btn.getAttribute("disabled"),
      busy: await btn.getAttribute("aria-busy"),
    };
    must(
      "    guard後にactionが始まれば通常のpendingになる",
      duringAction.disabled !== null && duringAction.busy === "true",
      JSON.stringify(duringAction),
    );
    await page.waitForTimeout(250);
    must(
      "    forwarded guard経路でもactionは1回だけ",
      (await page.getByTestId("action-guard-forward-calls").textContent()) === "1",
    );
  }

  {
    await page
      .getByTestId("validation-retry-run")
      .evaluate((button) => button.click());
    await page.waitForTimeout(100);
    const state = await page.getByTestId("validation-retry-state").textContent();
    must(
      "HTTP 400でも正規化済みfield errorはretryしない",
      state === "error:1",
      state,
    );
  }

  /* 1.8. 同期操作だけなら、完全な Action を要求しない ----------------
     ----------------------------------------------------------------
     disabled の再描画より先に同じイベントが重なる場合でも、ref の鍵が
     同期的に閉じる必要があります。hidden の probe は disabled にしません。
     これで「見た目が押せない」ではなく、tryLock 自体の契約を見ます。 */
  {
    const probe = page.getByTestId("interaction-guard-probe");
    const state = page.getByTestId("interaction-guard-state");
    const count = async () =>
      Number((await state.textContent())?.match(/\d+/)?.[0] ?? -1);

    await probe.evaluate((button) => {
      for (let i = 0; i < 5; i++) button.click();
    });
    await page.waitForTimeout(100);

    must(
      "軽量 guard を同じ描画で 5 回呼んでも 1 回だけ通る",
      (await count()) === 1,
      `${await count()} 回`,
    );
    mustEq(
      "鍵を取ると isLocked が true になる",
      await state.getAttribute("data-locked"),
      "true",
    );

    await page.getByRole("button", { name: "もう一度許可する" }).click();
    mustEq(
      "release すると同じ操作を再び受け付ける",
      await state.getAttribute("data-locked"),
      "false",
    );

    await probe.evaluate((button) => button.click());
    await page.waitForTimeout(100);
    must(
      "release の後は次の 1 回が通る",
      (await count()) === 2,
      `${await count()} 回`,
    );
  }

  /* 2. 二重送信の防止 ---------------------------------------------
     「押せない」ことではなく「連打しても 1 回しか実行されない」ことを見る。 */
  await page.waitForTimeout(2200); // idle へ戻る
  await page.getByRole("button", { name: "保存する" }).click({ force: true });
  await page.waitForTimeout(150);
  const pendingBtn = page.locator("button[aria-busy='true']").first();
  must(
    "pending 中は disabled になる",
    (await pendingBtn.getAttribute("disabled")) !== null,
  );
  mustEq("pending 中の aria-busy", await pendingBtn.getAttribute("aria-busy"), "true");
  for (let i = 0; i < 5; i++) {
    await pendingBtn.click({ force: true, timeout: 500 }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  const successCount = await page
    .getByRole("button", { name: /保存しました/ })
    .count();
  mustEq("5 回連打しても実行は 1 回だけ", successCount, 1);

  /* 3. 失敗パス --------------------------------------------------- */
  await page.getByRole("button", { name: "送信する" }).click();
  await page.waitForTimeout(1100);
  const alerts = page.getByRole("alert");
  const alertText =
    (await alerts.count()) > 0 ? (await alerts.first().textContent())?.trim() : "";
  must(
    "失敗すると role=alert に文言が出る",
    !!alertText && alertText.length > 0,
    alertText,
  );

  /* 4. フォームのフィールドエラー --------------------------------- */
  await page.fill('input[name="email"]', "bad@example.com");
  await page.fill('input[name="password"]', "123");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await page.waitForTimeout(1300);
  const fieldErrors = await page
    .locator("form p[role=alert]")
    .allTextContents();
  must(
    "フィールド単位のエラーが入力欄の下に出る",
    fieldErrors.length >= 1,
    `${fieldErrors.length} 件`,
  );
  log("   中身:", JSON.stringify(fieldErrors));

  await shot(page, "states-form-errors");

  /* 5. 打ち直すとエラーが消える ------------------------------------ */
  await page.fill('input[name="password"]', "longenoughpassword");
  await page.waitForTimeout(150);
  const afterTyping = await page.locator("form p[role=alert]").allTextContents();
  must(
    "打ち直したフィールドのエラーだけ消える",
    afterTyping.length < fieldErrors.length,
    `${fieldErrors.length} 件 → ${afterTyping.length} 件`,
  );

  /* 5.5 AsyncForm が async onSuccess の Promise を返すか ------------
     fixture は name=async-callback のときだけ、await 後に例外を投げます。
     Promise を wrapper が捨てると pageerror（unhandled rejection）へ出ます。
     正しく返せば useAction の callSafely が受け止め、成功状態は維持されます。 */
  await page.fill('input[name="name"]', "async-callback");
  await page.fill('input[name="email"]', "ok@nasu.dev");
  await page.fill('input[name="password"]', "longenoughpassword");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  await page.waitForTimeout(1300);
  must(
    "AsyncForm の async onSuccess が失敗しても送信は成功のまま",
    await page.getByText("登録が完了しました").isVisible(),
  );

  /* 5.6 不正な retryDelay は制御された error になる ------------------
     callback の throw は上の「失敗する」で pageerror にならないことを見ます。
     数値の境界は別です。NaN / Infinity / 負数を setTimeout に渡すと、
     実行環境ごとの暗黙変換で即時 retry になり得るため、すべて明示的に拒否します。 */
  for (const [id, label] of [
    ["nan", "NaN"],
    ["infinity", "Infinity"],
    ["negative", "負数"],
  ]) {
    await page
      .getByTestId(`retry-delay-${id}-run`)
      .evaluate((button) => button.click());
    await page.waitForTimeout(100);
    const seen = await page.getByTestId(`retry-delay-${id}-state`).textContent();
    must(
      `retryDelay=${label} は INVALID_RETRY_DELAY になる`,
      seen === "error:INVALID_RETRY_DELAY",
      seen,
    );
  }
}
