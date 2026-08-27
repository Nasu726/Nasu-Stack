/** 共通check harness自身がfalse-greenを作らないことを、別processのexitまで確かめます。 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCheckHarness } from "./_check.mjs";

if (process.env.NASU_CHECK_HARNESS_CHILD) {
  const { must, exit } = createCheckHarness();
  must("intentional failure", process.env.NASU_CHECK_HARNESS_CHILD === "pass", "broken");
  exit();
}

const output = [];
const harness = createCheckHarness({ write: (line) => output.push(line) });
harness.must("truthyを成功として数える", 1, "detail");
harness.must("falseを失敗として数える", false, "reason");
harness.mustEq("同じ値", "2", 2);
harness.mustEq("違う値", 2, 3);
const result = harness.report({ pageErrors: ["render failed"] });

const self = fileURLToPath(import.meta.url);
const child = (value) =>
  spawnSync(process.execPath, [self], {
    env: { ...process.env, NASU_CHECK_HARNESS_CHILD: value },
    encoding: "utf8",
  });
const failedChild = child("fail");
const passedChild = child("pass");

const assertions = [
  ["判定数", result.checkCount === 4],
  ["失敗数", result.failedCount === 2],
  ["pageerror数", result.pageErrorCount === 1],
  ["全体を失敗にする", result.ok === false],
  ["失敗詳細を出す", output.some((line) => line.includes("falseを失敗") && line.includes("reason"))],
  ["pageerrorを出す", output.some((line) => line.includes("render failed"))],
  ["intentional failureがexit 1", failedChild.status === 1],
  ["成功だけならexit 0", passedChild.status === 0],
];
const broken = assertions.filter(([, ok]) => !ok);
for (const [label, ok] of assertions) console.log(`  ${ok ? "✓" : "✗"} ${label}`);
if (broken.length > 0) {
  console.error(`\n❌ 判定 ${assertions.length} 件中 ${broken.length} 件が失敗`);
  process.exit(1);
}
console.log(`\n✅ 判定 ${assertions.length} 件すべて成功`);
