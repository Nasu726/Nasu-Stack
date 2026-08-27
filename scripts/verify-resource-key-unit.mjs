/**
 * useResource の query key 契約を、配る原本の serializer で確かめます。
 * JSON.stringify の衝突や render 中の例外は画面から原因を追えないため、
 * React を起動する前に値の境界を名指しします。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCheckHarness } from "./_check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".verify-resource-key");

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
      baseUrl: path.join(root, "registry", "nasu"),
      paths: { "@/*": ["./*"] },
      types: [],
      lib: ["es2022", "dom"],
      jsx: "react-jsx",
    },
    files: [
      path.join(root, "registry", "nasu", "lib", "action.ts"),
      path.join(root, "registry", "nasu", "hooks", "use-resource.ts"),
    ],
  }),
);
execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(out, "tsconfig.json")],
  { stdio: "inherit", cwd: root },
);

const hookPath = path.join(out, "hooks", "use-resource.js");
fs.writeFileSync(
  hookPath,
  fs
    .readFileSync(hookPath, "utf8")
    .replace(/from "@\/lib\/action"/g, 'from "../lib/action.js"'),
);
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}\n');

const resource = await import(pathToFileURL(hookPath).href);
const serialize = resource.serializeResourceKey;
const { must, report } = createCheckHarness();

must("stable query key serializer を公開している", typeof serialize === "function");

if (typeof serialize === "function") {
  const a = serialize(["users", { page: 2, filter: { active: true, role: "admin" } }]);
  const b = serialize(["users", { filter: { role: "admin", active: true }, page: 2 }]);
  must("object の key 順が違っても同じ query key", a === b, `${a} / ${b}`);

  const distinct = [
    serialize([null]),
    serialize(["null"]),
    serialize([0]),
    serialize([-0]),
    serialize([false]),
  ];
  must("型タグで null / string / number / -0 / boolean が衝突しない", new Set(distinct).size === distinct.length);
  must("同じ構造は参照が違っても同じ", serialize([[1, { a: "x" }]]) === serialize([[1, { a: "x" }]]));

  const invalid = [
    ["undefined", [undefined]],
    ["NaN", [Number.NaN]],
    ["Infinity", [Number.POSITIVE_INFINITY]],
    ["BigInt", [1n]],
    ["Date", [new Date(0)]],
    ["object 内の undefined", [{ a: undefined }]],
  ];
  for (const [label, key] of invalid) {
    let error;
    try {
      serialize(key);
    } catch (caught) {
      error = caught;
    }
    must(`${label} は明示的に拒否する`, error instanceof TypeError, String(error ?? "例外なし"));
  }

  const sparse = new Array(1);
  let sparseError;
  try {
    serialize([sparse]);
  } catch (caught) {
    sparseError = caught;
  }
  must(
    "sparse array を空配列と同一視せず明示的に拒否する",
    sparseError instanceof TypeError,
    String(sparseError ?? "例外なし"),
  );

  const cyclic = {};
  cyclic.self = cyclic;
  let cycleError;
  try {
    serialize([cyclic]);
  } catch (caught) {
    cycleError = caught;
  }
  must("循環参照は明示的に拒否する", cycleError instanceof TypeError, String(cycleError ?? "例外なし"));

  const shared = { id: 1 };
  let sharedError;
  try {
    serialize([shared, shared]);
  } catch (caught) {
    sharedError = caught;
  }
  must("循環していない共有参照は受け付ける", sharedError === undefined, String(sharedError ?? ""));
}

fs.rmSync(out, { recursive: true, force: true });
process.exit(report().ok ? 0 : 1);
