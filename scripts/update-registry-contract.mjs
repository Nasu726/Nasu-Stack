/**
 * Stableとして扱うregistryの構造契約を、意図的な変更後にだけ更新する。
 *
 *   node scripts/update-registry-contract.mjs
 *
 * 実装本文や説明文は固定しない。item、依存、配布先、public exportだけを記録する。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeRegistryContract } from "./_registry-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = writeRegistryContract(root);
const files = contract.items.reduce((count, item) => count + item.files.length, 0);
const exports = contract.items.reduce(
  (count, item) =>
    count +
    item.files.reduce(
      (fileCount, file) => fileCount + (file.exports?.length ?? 0),
      0,
    ),
  0,
);

console.log(
  `✓ public contractを更新しました（${contract.items.length} item / ${files} file / ${exports} export）`,
);
