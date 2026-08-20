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
  // guard は 150ms 待つ。その間に押し切ります。
  for (let i = 0; i < 5; i++) await btn.click({ force: true, timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const t = await page.getByTestId("calls-guard").textContent();
  const n = Number(t.match(/\d+/)?.[0] ?? -1);
  must("遅い guard を 5 回連打しても action は 1 回だけ", n === 1, `${n} 回`);
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
const retry = page.getByRole("button", { name: "再試行" });
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


await finish();
