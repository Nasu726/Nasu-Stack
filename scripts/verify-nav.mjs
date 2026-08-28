/**
 * v0.6 の検証。docs/plan-v06.md の「実測で確かめる項目」に対応します。
 *
 * ここで測るのは、**目で見ても気づけないもの**です。
 * キーボードだけで操作したときの挙動と、隠れた場所に潜り込む見出し。
 */
import { launch, BASE, isPainted } from "./_browser.mjs";
import { verifyNavFoundations } from "./verify-nav/foundations.mjs";
import { verifySiteNavigation } from "./verify-nav/navigation.mjs";
import { verifyPaginator } from "./verify-nav/paginator.mjs";

const { openTab, finish, must, mustEq } = await launch();

await verifyNavFoundations({ openTab, must, mustEq, isPainted });
await verifySiteNavigation({ openTab, must, mustEq, BASE });
await verifyPaginator({ openTab, must, mustEq });

await finish();
