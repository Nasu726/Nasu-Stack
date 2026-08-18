/**
 * エディタの補完（スニペット）を、配っている部品から作ります。
 *
 * 生成物の `.vscode/webtemplate.code-snippets` に入ります。
 * VS Code はこのファイルを自動で読むので、利用者の設定は要りません。
 *
 * ----------------------------------------------------------------
 * なぜ手で書かないのか
 * ----------------------------------------------------------------
 * 部品は 39 個あり、props は増えたり名前が変わったりします。
 * **手で書いた補完は、必ず実装より古くなります。** しかも
 * 「補完に出たのに動かない」は、初心者にはいちばん切り分けにくい形です。
 *
 * だから原本（`registry/nasu` の型）から作ります。
 *
 * ----------------------------------------------------------------
 * ここができないこと（先に書いておきます）
 * ----------------------------------------------------------------
 * **TypeScript を本当に解析してはいません。** `export interface XxxProps`
 * の中身を、括弧の深さ 1 の行だけ読んでいます。つまり:
 *
 *   - `extends` の先は見ません。**継承した必須の props は出ません**
 *     （`PageBlockProps extends ContentBlockProps` など）
 *   - 型は文字列として扱います。`"a" | "b"` の候補は出しません
 *   - 条件型やジェネリクスの解決はしません
 *
 * 出すのは「タグの形と、必須の props」までです。
 * それ以上が要るようになったら、TypeScript の API を使ってください。
 * **できないことをできるつもりで書くほうが害が大きい**ので、
 * ここでは範囲を狭く切っています。
 *
 * ----------------------------------------------------------------
 * 属性の位置にコメントを書きません
 * ----------------------------------------------------------------
 * 任意の props を JSX のコメントで並べる案もありましたが、**JSX は属性の位置に
 * コメントを置けません**（`ts(1005)` になります。v0.9c で実際に踏みました）。
 * 任意の props は `description` に並べ、本体には必須のものだけ入れます。
 */
import fs from "node:fs";
import path from "node:path";

/** `ActionButton` → `wt-action-button` */
function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * `export interface XxxProps ... { … }` を 1 つ読みます。
 * 括弧の深さで終わりを決めるので、中に `{}` があっても切れません。
 */
function readInterfaces(src) {
  const out = [];
  const re = /export\s+interface\s+([A-Za-z0-9_]+)Props\b/g;
  for (const m of src.matchAll(re)) {
    const open = src.indexOf("{", m.index);
    if (open < 0) continue;
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    out.push({ name: m[1], body: src.slice(open + 1, i) });
  }
  return out;
}

/** 深さ 1 の `name?: Type;` だけを拾います。 */
function readProps(body) {
  const props = [];
  let depth = 0;
  let buf = "";
  // ドキュメントコメントと行コメントは先に落とします
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /* **山括弧は数えません。** `(open: boolean) => void` の `>` を閉じ括弧として
     数えると深さが負になり、**その行から後ろの props が全部消えます**
     （Dialog の onOpenChange 以降が丸ごと落ちていました）。
     ジェネリクスの中に `;` は出てこないので、数えなくても困りません。 */
  for (const ch of clean) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === ";" && depth === 0) {
      const m = buf.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*([\s\S]+)$/);
      if (m) props.push({ name: m[1], optional: !!m[2], type: m[3].trim() });
      buf = "";
    } else {
      buf += ch;
    }
  }
  return props;
}

/** 型から、埋める値の形を決めます。**候補までは出しません。** */
function placeholder(prop, index) {
  const t = prop.type;
  /* 真偽値でも値を書かせます。属性名だけ置くと**常に true** になるので、
     `open` のような必須の props では意味が変わってしまいます。 */
  if (/^string$/.test(t)) {
    return { attr: `${prop.name}="\${${index}:${prop.name}}"`, tab: true };
  }
  // 候補がそのまま書ける形（"a" | "b"）だけは選べるようにします
  const literals = [...t.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (literals.length > 1 && !/[<>({]/.test(t)) {
    return {
      attr: `${prop.name}="\${${index}|${literals.join(",")}|}"`,
      tab: true,
    };
  }
  return { attr: `${prop.name}={\${${index}:${prop.name}}}`, tab: true };
}

/**
 * @param {{name: string, files: {path: string, target: string}[]}[]} items
 *   生成物に入る registry のアイテム
 * @param {string} root リポジトリのルート
 */
export function buildSnippets(items, root) {
  const snippets = {};
  for (const item of items) {
    for (const file of item.files ?? []) {
      if (!file.target.startsWith("components/ui/")) continue;
      if (!file.target.endsWith(".tsx")) continue;
      const src = fs.readFileSync(path.join(root, file.path), "utf8");
      const importPath = `@/${file.target.replace(/\.tsx$/, "")}`;

      for (const iface of readInterfaces(src)) {
        const comp = iface.name;
        /* 型があっても**部品が無い**ことがあります（内部用の型など）。
           補完に出して「そんな部品はありません」になるのが最悪なので、
           export されている実体があるものだけ出します。 */
        const DECL = [
          "export function ",
          "export const ",
          "export default function ",
        ];
        const exported = DECL.some((d) => {
          /* **最初の 1 件だけ見てはいけません。** `export function Columns` が
             先にあると、`Column` を探したときにそちらが当たって
             「Column は無い」と判定します（実際そうなりました）。 */
          for (let at = src.indexOf(d + comp); at >= 0; at = src.indexOf(d + comp, at + 1)) {
          /* 名前の続きで別の部品を拾わないよう、直後の 1 文字を見ます
             （AsyncSelect と AsyncSelectItem など）。
             正規表現にしないのは、短縮記法をテンプレートリテラルに
             書くと黙って別物になるからです（v0.9c で踏みました）。 */
            const after = src[at + d.length + comp.length];
            if (["(", " ", "<", ":", "="].includes(after)) return true;
          }
          return false;
        });
        if (!exported) continue;

        const props = readProps(iface.body);
        const required = props.filter((p) => !p.optional && p.name !== "children");
        const optional = props.filter((p) => p.optional && p.name !== "children");
        const hasChildren = props.some((p) => p.name === "children");

        let i = 1;
        const attrs = required.map((p) => placeholder(p, i++).attr);
        const open = attrs.length
          ? `<${comp}\n  ${attrs.join("\n  ")}\n>`
          : `<${comp}>`;
        const body = hasChildren
          ? [
              attrs.length ? open : `<${comp}>`,
              `  \${${i}:中身}`,
              `</${comp}>`,
            ]
          : [
              attrs.length
                ? `<${comp}\n  ${attrs.join("\n  ")}\n/>`
                : `<${comp} />`,
            ];

        snippets[comp] = {
          // .astro でも .tsx でも同じものを出します
          scope: "typescriptreact,javascriptreact,astro",
          prefix: `wt-${kebab(comp)}`,
          body,
          description: [
            `import { ${comp} } from "${importPath}";`,
            optional.length
              ? `任意: ${optional.map((p) => p.name).join(" ")}`
              : "任意の props はありません",
          ].join("\n"),
        };
      }
    }
  }
  return snippets;
}

/** 生成物へ書き出します。 */
export function writeSnippets(items, root, dest) {
  const snippets = buildSnippets(items, root);
  const dir = path.join(dest, ".vscode");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "webtemplate.code-snippets"),
    JSON.stringify(snippets, null, 2) + "\n",
    "utf8",
  );
  return Object.keys(snippets).length;
}
