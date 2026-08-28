/**
 * v0.1（非同期の状態）の実ブラウザ検証。
 */
import { launch, log, shot } from "./_browser.mjs";
import { verifyActionState } from "./verify-states/action.mjs";
import { verifySearchState } from "./verify-states/search.mjs";
import { verifyCursorState } from "./verify-states/cursor.mjs";
import { verifyRecoveryState } from "./verify-states/recovery.mjs";
import { verifyErrorBoundaryState } from "./verify-states/error-boundary.mjs";
import { verifyAutosaveState } from "./verify-states/autosave.mjs";
import { verifyCopyState } from "./verify-states/copy.mjs";

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
  if (
    m.text().includes("[useCopy] callback failed") &&
    m.text().includes("intentional copy callback failure")
  ) return;
  errors.push(m.text());
});

await verifyActionState({ page, must, mustEq, log, shot });
await verifySearchState({ page, must });
await verifyCursorState({ page, must });
await verifyRecoveryState({ page, must });
await verifyErrorBoundaryState({ page, must });
await verifyAutosaveState({ page, must });
await verifyCopyState({ page, must, mustEq });

await finish();
