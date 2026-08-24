/**
 * validation result contract を、React や特定の schema library を起動せずに確かめます。
 * client / server の adapter が別の優先順位で field error を扱うと、同じ validator
 * なのに表示が変わるため、配る原本そのものを compile して測ります。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".verify-validation");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      outDir: ".",
      rootDir: path.join(root, "registry", "nasu"),
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
      skipLibCheck: true,
      types: [],
      lib: ["es2022", "dom"],
    },
    files: [path.join(root, "registry", "nasu", "lib", "validation.ts")],
  }),
);
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    path.join(out, "tsconfig.json"),
  ],
  { stdio: "inherit", cwd: root },
);
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const validation = await import(
  pathToFileURL(path.join(out, "lib", "validation.js")).href
);
const {
  normalizeValidationFailure,
  normalizeValidationFields,
  runValidation,
  validationFailurePayload,
  validationFailureResponse,
} = validation;

const checks = [];
function must(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail) });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}

const transformed = await runValidation(
  (input) => ({
    ok: true,
    data: { email: String(input.email).trim().toLowerCase(), age: Number(input.age) },
  }),
  { email: " A@EXAMPLE.COM ", age: "20" },
);
must(
  "success は変換済み data を保つ",
  transformed.ok &&
    transformed.data.email === "a@example.com" &&
    transformed.data.age === 20,
  JSON.stringify(transformed),
);

const asyncResult = await runValidation(
  async (input) => ({ ok: true, data: input + 1 }),
  4,
);
must("同期 / 非同期 validator が同じ契約", asyncResult.ok && asyncResult.data === 5);

const normalized = normalizeValidationFields({
  email: ["", "形式を確認してください", "二つ目"],
  "members.0.name": "名前を入力してください",
});
must(
  "複数文言は先頭の有効な 1 件へ揃える",
  normalized?.email === "形式を確認してください",
  JSON.stringify(normalized),
);
must(
  "nested field path を書き換えない",
  normalized?.["members.0.name"] === "名前を入力してください",
);

const magicFields = Object.create(null);
magicFields.__proto__ = "このfieldを確認してください";
const normalizedMagic = normalizeValidationFields(magicFields);
must(
  "magic nameをprototypeとして解釈しない",
  Object.prototype.hasOwnProperty.call(normalizedMagic, "__proto__") &&
    normalizedMagic.__proto__ === "このfieldを確認してください",
);

const fieldOnly = await runValidation(
  () => ({ ok: false, fields: { email: ["必須です"] } }),
  null,
);
must(
  "field error だけの failure を受け付ける",
  !fieldOnly.ok && normalizeValidationFailure(fieldOnly).fields?.email === "必須です",
);

const formOnly = await runValidation(
  () => ({ ok: false, message: "この招待は期限切れです" }),
  null,
);
must(
  "form-level error だけの failure を受け付ける",
  !formOnly.ok && normalizeValidationFailure(formOnly).message === "この招待は期限切れです",
);

const invalidCases = [
  ["boolean flag が無い", { data: 1 }],
  ["success に data が無い", { ok: true }],
  ["failure が空", { ok: false }],
  ["field 文言の型が違う", { ok: false, fields: { email: 3 } }],
  ["field 文言が空", { ok: false, fields: { email: [""] } }],
];
for (const [label, value] of invalidCases) {
  let caught;
  try {
    await runValidation(() => value, null);
  } catch (error) {
    caught = error;
  }
  must(`${label}なら fail closed`, caught instanceof TypeError, String(caught ?? "例外なし"));
}

const failure = {
  ok: false,
  message: "入力内容を確認してください",
  fields: { email: ["形式が正しくありません", "別の文言"] },
  debug: "db.internal:5432",
};
const payload = validationFailurePayload(failure);
must(
  "transport は userMessage と正規化した fields を分ける",
  payload.message === "validation failed" &&
    payload.userMessage === "入力内容を確認してください" &&
    payload.fields?.email === "形式が正しくありません",
  JSON.stringify(payload),
);
must(
  "failure の未定義 debug 情報を transport へコピーしない",
  !JSON.stringify(payload).includes("db.internal"),
  JSON.stringify(payload),
);

const response = validationFailureResponse(failure, {
  headers: {
    "access-control-allow-origin": "https://example.com",
    "content-type": "text/plain",
  },
});
const body = await response.json();
must("server adapter の既定は 422", response.status === 422, response.status);
must(
  "server adapter は JSON を名乗り、JSON以外の既存headerを保つ",
  response.headers.get("content-type") === "application/json; charset=utf-8" &&
    response.headers.get("access-control-allow-origin") === "https://example.com" &&
    body.fields.email === "形式が正しくありません",
  JSON.stringify(body),
);

let statusError;
try {
  validationFailureResponse({ ok: false, message: "失敗" }, { status: 200 });
} catch (error) {
  statusError = error;
}
must(
  "validation failure を 2xx にできない",
  statusError instanceof RangeError,
  String(statusError ?? "例外なし"),
);

fs.rmSync(out, { recursive: true, force: true });
const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`\n❌ ${checks.length} 件中 ${failed.length} 件が失敗しました`);
  for (const failure of failed) {
    console.error(`   ✗ ${failure.label}  ${failure.detail}`);
  }
  process.exit(1);
}
console.log(`\n✅ 判定 ${checks.length} 件すべて成功`);
