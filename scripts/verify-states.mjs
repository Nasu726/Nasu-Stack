/**
 * v0.1（非同期の状態）の実ブラウザ検証。
 */
import { launch, log, shot } from "./_browser.mjs";

const { errors, openTab, finish, must, mustEq } = await launch();
// タブはボタンのクリックではなく URL で開きます。
// 以前はここで getByRole("button") を使っていて、タブを正しい
// role="tab" にした瞬間に見つからなくなりました。URL なら壊れません。
const page = await openTab("state", { width: 900, height: 900 });
page.on("console", (m) => {
  if (m.type() !== "error") return;
  /* カタログの「callback が投げる」は**わざと投げています。**
     useAction が握り潰さずに console へ出すのが正しい振る舞いなので、
     これは異常ではありません。

     **全部を無視してはいけません。** ここで丸ごと捨てると、本物の
     例外まで見えなくなります。意図したもの 1 種類だけを名指しで外します。 */
  if (m.text().includes("[action] onSuccess が例外を投げました")) return;
  // ErrorBoundary の治具は render / callback / fallback を意図的に壊します。
  // 文言を名指しし、ほかの React error は従来どおり失敗へ数えます。
  if (m.text().includes("intentional render failure probe")) return;
  if (m.text().includes("intentional callback boundary probe")) return;
  if (m.text().includes("intentional onError failure probe")) return;
  if (m.text().includes("intentional last resort probe")) return;
  if (m.text().includes("intentional fallback failure probe")) return;
  if (m.text().includes("intentional reset key probe")) return;
  errors.push(m.text());
});

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

/* 6. 一覧の失敗 → 再試行 ---------------------------------------- */
await page.getByRole("button", { name: "失敗", exact: true }).click();
// useResource は既定で 1 回リトライするので、700ms x2 + 待ち時間より長く待つ
await page.waitForTimeout(4000);
const retry = page
  .locator("button:not([disabled])")
  .filter({ hasText: /^再試行$/ });
must("取得に失敗したら再試行ボタンが出る", await retry.isVisible());

/* 7. 空状態 ------------------------------------------------------ */
await page.getByRole("button", { name: "空", exact: true }).click();
await page.waitForTimeout(1400);
must(
  "0 件のときは空メッセージが出る",
  await page.getByText("まだデータがありません").isVisible(),
);

/* 8. 中断 -------------------------------------------------------- */
await page.getByRole("button", { name: "重い処理を実行" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "中断" }).click();
await page.waitForTimeout(400);
/* **印で名指しします。** 文字で探すと、同じ書き方の表示が増えた瞬間に
   「2 つ見つかった」で落ちます（実際 v0.9e で落ちました）。 */
const status = (await page.getByTestId("abort-status").textContent())?.trim();
must(
  "中断すると status が pending のまま残らない",
  !/pending/.test(status ?? ""),
  status,
);

/* ===== guard を待っている間の中断（外部レビュー P1-02） ============
   v0.9d までは AbortController を guard の**後**に作っていたので、
   確認や通信を待っている間に中断しても止まりませんでした。
   画面を離れた後に削除や決済が始まる、という壊れ方をします。

   **見た目では分かりません。** action が何回呼ばれたかを数えます。 */
{
  const num = async (id) =>
    Number((await page.getByTestId(id).textContent())?.match(/\d+/)?.[0] ?? -1);

  /* **名前は他と重ならないものにします。** 「中断」は AbortSection にもあり、
     どちらを押しているのか分からない検査になります。 */
  const runBtn = page.getByRole("button", { name: "確認してから実行" });
  const abortBtn = page.getByRole("button", { name: "確認中にやめる" });

  // 1. guard を待っている間に中断 → action は 0 回
  await runBtn.click();
  await page.waitForTimeout(200); // guard は 1000ms 待つ
  await abortBtn.click();
  await page.waitForTimeout(1600); // guard が解けきるまで待つ
  must("guard を待っている間に中断したら action は動かない", (await num("guard-calls")) === 0, `${await num("guard-calls")} 回`);

  // 2. 中断したあと、もう一度実行すれば動く（止めすぎていないか）
  await runBtn.click();
  await page.waitForTimeout(1600);
  must("  中断のあと、もう一度実行すれば動く", (await num("guard-calls")) === 1, `${await num("guard-calls")} 回`);

  // 3. guard を待っている間に画面から消す → action は増えない
  await runBtn.click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "画面から消す" }).click();
  await page.waitForTimeout(1600);
  must("guard を待っている間に画面を離れたら action は動かない", (await num("guard-calls")) === 1, `${await num("guard-calls")} 回`);

  // 4. ここまでで握られなかった失敗が 0 件
  must("握られなかった失敗が出ていない", (await num("unhandled-rejections")) === 0, `${await num("unhandled-rejections")} 件`);
}

/* ===== ErrorBoundary: render failure だけを局所化 ================== */
{
  const sibling = page.getByTestId("error-boundary-sibling");
  must("ErrorBoundary の sibling は最初から利用できる", await sibling.isVisible());

  await page.getByRole("button", { name: "この範囲だけを壊す" }).click();
  const fallback = page.locator("[data-error-boundary-fallback]").first();
  await fallback.waitFor({ state: "visible" });
  must("render failure は subtree の fallback に閉じ込める", await fallback.isVisible());
  must("render failure 後も sibling は残る", await sibling.isVisible());
  must(
    "fallback は role=alert を持つ",
    (await fallback.getAttribute("role")) === "alert",
    await fallback.getAttribute("role"),
  );
  must(
    "render failure 後は fallback へ focus する",
    await fallback.evaluate((element) => document.activeElement === element),
  );
  must(
    "onError は render failure 1 回につき 1 回",
    (await sibling.textContent())?.includes("1") ?? false,
    await sibling.textContent(),
  );

  await page.getByRole("button", { name: "もう一度試す" }).click();
  must(
    "retry で壊れた subtree を新しく mount できる",
    await page.getByRole("button", { name: "この範囲だけを壊す" }).isVisible(),
  );

  const probes = page.getByTestId("error-boundary-probes");
  await probes
    .locator("button")
    .filter({ hasText: /^callback probe$/ })
    .evaluate((button) => button.click());
  await page.waitForTimeout(100);
  must(
    "onError callback が throw しても fallback を失わない",
    (await probes.locator("[data-error-boundary-fallback]").count()) === 1,
  );

  await probes
    .locator("button")
    .filter({ hasText: /^fallback probe$/ })
    .evaluate((button) => button.click());
  await page.waitForTimeout(100);
  must(
    "独自 fallback 自身が壊れても最小 fallback を残す",
    (await probes.locator("[data-error-boundary-last-resort]").count()) === 1,
  );

  await probes
    .locator("button")
    .filter({ hasText: /^reset probe$/ })
    .evaluate((button) => button.click());
  await page.waitForTimeout(100);
  must(
    "resetKeys probe は最初にfallbackへ入る",
    (await probes.locator("[data-error-boundary-fallback]").count()) === 2,
  );
  await probes
    .locator("button")
    .filter({ hasText: /^change reset key$/ })
    .evaluate((button) => button.click());
  await page
    .getByTestId("error-boundary-reset-recovered")
    .waitFor({ state: "attached" });
  must(
    "resetKeys が変わるとsubtreeを自動復帰する",
    (await page.getByTestId("error-boundary-reset-recovered").count()) === 1 &&
      (await probes.locator("[data-error-boundary-fallback]").count()) === 1,
  );
}

/* ===== useAutosave: debounce / queue / stale / abort =============== */
{
  const input = page.getByTestId("autosave-input");
  const state = page.getByTestId("autosave-state");
  const seen = async () => ({
    status: await state.getAttribute("data-status"),
    dirty: await state.getAttribute("data-dirty"),
    calls: JSON.parse((await state.getAttribute("data-calls")) ?? "[]"),
    saved: await state.getAttribute("data-saved"),
    aborts: Number((await state.getAttribute("data-aborts")) ?? -1),
  });

  // debounce 中の値は送らず、最後だけを 1 回送る。
  await input.fill("a");
  await input.fill("ab");
  await input.fill("abc");
  await page.waitForTimeout(500);
  let current = await seen();
  must(
    "高速入力は最新値 1 件へ debounce する",
    JSON.stringify(current.calls) === JSON.stringify(["abc"]),
    JSON.stringify(current.calls),
  );
  must("最新値の保存後は saved", current.status === "saved", current.status);
  must("保存結果は最新値", current.saved === "abc", current.saved);

  // 進行中は壊さず、途中の待機値を捨てて最新だけを次へ送る。
  await input.fill("slow:first");
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.waitForTimeout(100);
  await input.fill("middle");
  await input.fill("final");
  await page.waitForTimeout(900);
  current = await seen();
  must(
    "保存中の変更は途中を捨て、最新値だけを次へ送る",
    JSON.stringify(current.calls.slice(-2)) ===
      JSON.stringify(["slow:first", "final"]),
    JSON.stringify(current.calls),
  );
  must("古い成功responseは最新結果を上書きしない", current.saved === "final", current.saved);

  // 古い失敗も最新値の error にしてはいけない。
  await input.fill("slow:fail");
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.waitForTimeout(100);
  await input.fill("after-stale-error");
  await page.waitForTimeout(900);
  current = await seen();
  must("古い失敗responseは最新値を error にしない", current.status === "saved", current.status);
  must("古い失敗の後も最新値を保存する", current.saved === "after-stale-error", current.saved);

  // 最新値の失敗は保持し、retry / 再編集の両方を選べる。
  await input.fill("fail");
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.waitForTimeout(150);
  current = await seen();
  must("最新値の失敗は error と dirty を公開する", current.status === "error" && current.dirty === "true", `${current.status}/${current.dirty}`);
  const failedCalls = current.calls.length;
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await page.waitForTimeout(150);
  current = await seen();
  must("retry は同じ最新値をもう一度送る", current.calls.length === failedCalls + 1 && current.calls.at(-1) === "fail", JSON.stringify(current.calls));

  await input.fill("recovered");
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.waitForTimeout(150);
  current = await seen();
  must("失敗後の再編集で保存へ復帰できる", current.status === "saved" && current.saved === "recovered", `${current.status}/${current.saved}`);

  // debounce 前の cancel は transport を呼ばない。
  const beforeCancel = current.calls.length;
  await input.fill("cancel-before-start");
  await page.getByRole("button", { name: "未保存を破棄" }).click();
  await page.waitForTimeout(350);
  current = await seen();
  must("debounce 中の cancel は保存を始めない", current.calls.length === beforeCancel, JSON.stringify(current.calls));
  must("cancel 後は dirty を残さない", current.dirty === "false", current.dirty);

  // 進行中は AbortSignal を通知し、遅い結果を state へ戻さない。
  await input.fill("slow:cancel-active");
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.waitForTimeout(80);
  const abortsBefore = (await seen()).aborts;
  await page.getByRole("button", { name: "未保存を破棄" }).click();
  await page.waitForTimeout(120);
  current = await seen();
  must("進行中の cancel は AbortSignal を通知する", current.aborts === abortsBefore + 1, `${abortsBefore} → ${current.aborts}`);
  must("cancelled response は以前の保存結果を変えない", current.saved === "recovered", current.saved);

  await page.getByTestId("autosave-reset").evaluate((button) => button.click());
  await page.waitForTimeout(50);
  current = await seen();
  must(
    "reset は成功値も消して idle へ戻す",
    current.status === "idle" && current.saved === "" && current.dirty === "false",
    `${current.status}/${current.saved}/${current.dirty}`,
  );

  // unmount cleanup でも同じ signal contract を守る。
  const unmountProbe = page.getByTestId("autosave-unmount-probe");
  await unmountProbe.locator("button").filter({ hasText: "start" }).evaluate((button) => button.click());
  await page.waitForTimeout(50);
  await unmountProbe.locator("button").filter({ hasText: "unmount" }).evaluate((button) => button.click());
  await page.waitForTimeout(100);
  must(
    "unmount は進行中の autosave へ abort を通知する",
    (await page.getByTestId("autosave-unmount-aborts").textContent()) === "1",
    await page.getByTestId("autosave-unmount-aborts").textContent(),
  );
}


await finish();
