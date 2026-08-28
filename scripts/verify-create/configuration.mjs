import fs from "node:fs";
import path from "node:path";

export async function verifyConfiguration({ root, work, CASES, must }) {
  /* ===== 7. paths が registry の target と一致するか =============== */
  {
    const ts = JSON.parse(
      fs.readFileSync(path.join(work, "my-app", "tsconfig.json"), "utf8"),
    );
    const paths = ts.compilerOptions?.paths?.["@/*"];
    must(
      "7. tsconfig の paths が src/* を指す",
      Array.isArray(paths) && paths[0] === "./src/*",
      JSON.stringify(paths),
    );
    /* `baseUrl` は TypeScript 7.0 で機能しなくなり、5.x でも警告が出ます。
       **生成物を開いた瞬間にエディタが警告を出す**のは、初めての人には
       「壊れている」と映ります。`paths` を `./` で始めれば要りません。 */
    must(
      "   tsconfig に baseUrl が無い（TS 7.0 で廃止）",
      ts.compilerOptions?.baseUrl === undefined,
      ts.compilerOptions?.baseUrl ?? "",
    );
    // registry.json の target は "components/ui/x.tsx" 形式。
    // これを src/ の下に置くので、@/* → src/* で辻褄が合います。
    const registry = JSON.parse(fs.readFileSync(path.join(root, "registry.json"), "utf8"));
    const bad = registry.items
      .flatMap((i) => i.files ?? [])
      .filter((f) => f.target?.startsWith("/") || f.target?.startsWith("src/"));
    must("   registry の target が相対のまま", bad.length === 0, bad.map((b) => b.target).join(", "));
  }

  /* ===== 7.5. 生成物で「部品を足す」が本当にできるか ================ */
  /**
   * README は「部品が足りなくなったら足す」と書いています。
   * **v0.9a まで、その手段が入っていませんでした。**
   *
   * `components.json` が無いと shadcn CLI は対話で聞いてきて止まり、
   * 作らせても `registries` が無いので `Unknown registry "@nasu"` になります。
   * 案内どおりに進んだ人が 2 回続けて詰まる状態でした。
   *
   * **部品側の検査は全部緑でした。** 生成物を実際に触るまで気づけません。
   * だからここで機械に見せます。
   */
  for (const { name, kind } of CASES) {
    const p = path.join(work, name, "components.json");
    if (!fs.existsSync(p)) {
      must(`7.5 ${kind}: components.json がある`, false, "ファイルが無い");
      continue;
    }
    const cj = JSON.parse(fs.readFileSync(p, "utf8"));
    must(`7.5 ${kind}: components.json がある`, true);
    must(
      `    ${kind}: @nasu の registries が宣言されている`,
      typeof cj.registries?.["@nasu"] === "string" &&
        cj.registries["@nasu"].includes("{name}"),
      cj.registries?.["@nasu"] ?? "(無し)",
    );
    // alias が tsconfig と食い違うと、入った直後にビルドが落ちます。
    const ts = JSON.parse(fs.readFileSync(path.join(work, name, "tsconfig.json"), "utf8"));
    const aliasOk = ts.compilerOptions?.paths?.["@/*"]?.[0] === "./src/*" &&
      cj.aliases?.ui === "@/components/ui";
    must(`    ${kind}: alias が tsconfig と揃っている`, aliasOk, cj.aliases?.ui ?? "");
  }

  /* ===== 7.46. lockfile が git に入る形になっているか =============== */
  /**
   * 生成物に lockfile は同梱していません（受け取った時点で既に古いため）。
   * 代わりに、**利用者の `npm install` が作ったものが commit できる**必要があります。
   * `.gitignore` が弾いていると、`npm install` の日によって中身が変わる
   * プロジェクトが出来上がります。
   */
  for (const { name, kind } of CASES) {
    const gi = fs.readFileSync(path.join(work, name, ".gitignore"), "utf8");
    const blocks = gi
      .split(String.fromCharCode(10))
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .filter((l) => /lock/i.test(l));
    must(
      `7.46 ${kind}: lockfile を .gitignore が弾いていない`,
      blocks.length === 0,
      blocks.join(" "),
    );
    const md = fs.readFileSync(path.join(work, name, "HowToUse.md"), "utf8");
    must(
      `     ${kind}: lockfile を commit するよう案内している`,
      md.includes("package-lock.json") && md.includes("commit"),
    );
  }

  /* ===== 7.55. エディタの補完が、実在する部品だけを出しているか ==== */
  /**
   * 補完は `registry.json` と各部品の型から生成しています（build-snippets.mjs）。
   *
   * **いちばん悪いのは「補完に出たのに部品が無い」です。** 選んで書いた側は
   * 自分が間違えたと思うので、原因に辿り着けません。だから
   * **補完に出る名前が、同梱のファイルで本当に export されているか**を見ます。
   */
  for (const { name, kind } of CASES) {
    const p = path.join(work, name, ".vscode", "nasu-stack.code-snippets");
    if (!fs.existsSync(p)) {
      must(`7.55 ${kind}: エディタの補完が入っている`, false, "ファイルが無い");
      continue;
    }
    const snips = JSON.parse(fs.readFileSync(p, "utf8"));
    const keys = Object.keys(snips);
    must(`7.55 ${kind}: エディタの補完が入っている`, keys.length > 10, `${keys.length} 個`);

    // 接頭辞が揃っていないと、補完の一覧で見分けが付きません
    const badPrefix = keys.filter((k) => !String(snips[k].prefix ?? "").startsWith("wt-"));
    must(
      `     ${kind}: 接頭辞が wt- で揃っている`,
      badPrefix.length === 0,
      badPrefix.join(", "),
    );

    /* 補完が指す部品が、本当に同梱されているか。
       import 文は description の 1 行目に入れてあります。 */
    const missing = [];
    for (const k of keys) {
      const line = String(snips[k].description ?? "").split(String.fromCharCode(10))[0];
      const MARK = ' from "@/';
      const at = line.indexOf(MARK);
      const m = at < 0 ? null : line.slice(at + MARK.length, line.lastIndexOf('"'));
      if (!m) {
        missing.push(`${k}(import が読めない)`);
        continue;
      }
      const file = path.join(work, name, "src", `${m}.tsx`);
      if (!fs.existsSync(file)) {
        missing.push(`${k}(${m} が無い)`);
        continue;
      }
      const src = fs.readFileSync(file, "utf8");
      const declared = ["export function ", "export const ", "export default function "]
        .some((d) => {
          for (let at = src.indexOf(d + k); at >= 0; at = src.indexOf(d + k, at + 1)) {
            const after = src[at + d.length + k.length];
            if (["(", " ", "<", ":", "="].includes(after)) return true;
          }
          return false;
        });
      if (!declared) missing.push(`${k}(export されていない)`);
    }
    must(
      `     ${kind}: 補完の部品がすべて実在する`,
      missing.length === 0,
      missing.slice(0, 5).join(", "),
    );
  }


}
