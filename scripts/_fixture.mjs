/**
 * 「まっさらな利用者のプロジェクト」の作り方。**ここが唯一の定義です。**
 *
 * 2 つの検査が同じものを必要とします。
 *
 *   verify-install.mjs       … CLI と同じ依存解決を再現する（オフラインで回る）
 *   verify-install-real.mjs  … 本物の shadcn CLI を通す（ネットワークが要る）
 *
 * **書き写すと必ずずれます。** 片方の tsconfig だけ直して、もう片方が
 * 古い設定のまま通り続ける——それでは「利用者のところで通る」の
 * 確からしさが下がります。
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 利用者側の `components.json` が生成する、標準的な alias に合わせた tsconfig。
 * `@/*` → `./src/*` です。
 *
 * **`baseUrl` は書きません。** TypeScript 7.0 で機能しなくなる予定で、
 * 5.x でも警告が出ます。`paths` の値を `./` で始めれば tsconfig の場所からの
 * 相対として解決されるので、`baseUrl` は要りません。
 */
export const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src/**/*.ts", "src/**/*.tsx"],
};

/**
 * shadcn CLI が読む `components.json`。
 *
 * `registries` は **`@nasu/action` のような名前空間を解決するために必須**です。
 * 無いと `Unknown registry "@nasu"` で止まります（v0.9a で実測）。
 * URL の `{name}` を CLI が項目名に置き換えます。
 *
 * **`registryUrl` を省くと `registries` を書きません。** 利用者に案内して
 * いるのは `shadcn registry add` で足す手順なので、本物の CLI を通す検査は
 * その一手ごと動かします（`verify-install-real.mjs`）。
 */
export function componentsJson(registryUrl) {
  return {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: true,
    ...(registryUrl ? { registries: { "@nasu": registryUrl } } : {}),
    tailwind: {
      config: "",
      css: "src/styles/tokens.css",
      baseColor: "neutral",
      cssVariables: true,
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    iconLibrary: "lucide",
  };
}

const write = (p, obj) =>
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");

/**
 * 空のプロジェクトを 1 つ作ります。
 *
 *   makeFixture(dir)                      … tsconfig だけ
 *   makeFixture(dir, { project: true })   … + package.json / components.json
 *                                           （`registries` は無し）
 *   makeFixture(dir, { registryUrl })     … + `registries` も書き込む
 */
export function makeFixture(dir, { registryUrl, project = !!registryUrl } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  write(path.join(dir, "tsconfig.json"), tsconfig);
  if (project) {
    write(path.join(dir, "package.json"), {
      name: "fixture",
      private: true,
      type: "module",
    });
    write(path.join(dir, "components.json"), componentsJson(registryUrl));
  }
  return dir;
}
