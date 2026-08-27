import fs from "node:fs";

/**
 * Windows が特別扱いする名前。**拡張子を付けても同じです**
 * （`con.txt` も作れません）。ここを通すと、生成そのものは通るのに
 * **フォルダが作れない**という分かりにくい失敗になります。
 */
const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/**
 * package.jsonの`name`として使えるかを検証します。
 * **生成してからnpmに怒られるより、ここで止めたほうが親切です。**
 */
export function validateName(name, lang = "en") {
  if (lang === "ja") {
    if (!name || !name.trim()) return "プロジェクト名を入れてください";
    if (name !== name.trim()) return "前後の空白は使えません";
    if (/[A-Z]/.test(name)) return "大文字は使えません（小文字にしてください）";
    if (/\s/.test(name)) return "空白は使えません（- でつないでください）";
    if (name.startsWith(".") || name.startsWith("_")) {
      return ". や _ で始まる名前は使えません";
    }
    if (/[~'!()*/\\]/.test(name)) return "記号 ~ ' ! ( ) * / \\ は使えません";
    if (/[<>:\"|?]/.test(name)) return '記号 < > : \" | ? は使えません（Windows）';
    if (/[\u0000-\u001f]/.test(name)) return "制御文字は使えません";
    if (WINDOWS_RESERVED.has(name.split(".")[0].toLowerCase())) {
      return `${name} は Windows が特別扱いする名前です（フォルダを作れません）`;
    }
    if (name.endsWith(".") || name.endsWith(" ")) {
      return ". や空白で終わる名前は使えません（Windows）";
    }
    if (name.length > 214) return "名前が長すぎます";
    return null;
  }
  if (!name || !name.trim()) return "Enter a project name";
  if (name !== name.trim()) return "A project name cannot start or end with whitespace";
  if (/[A-Z]/.test(name)) return "Use lowercase letters in the project name";
  if (/\s/.test(name)) return "Use hyphens instead of spaces in the project name";
  if (name.startsWith(".") || name.startsWith("_")) {
    return "A project name cannot start with . or _";
  }
  if (/[~'!()*/\\]/.test(name)) return "A project name cannot contain ~ ' ! ( ) * / \\";
  if (/[<>:\"|?]/.test(name)) return 'A project name cannot contain < > : \" | ? on Windows';
  // 制御文字。貼り付けで紛れ込むことがあります
  if (/[\u0000-\u001f]/.test(name)) return "A project name cannot contain control characters";
  if (WINDOWS_RESERVED.has(name.split(".")[0].toLowerCase())) {
    return `${name} is reserved by Windows and cannot be used as a folder name`;
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    return "A project name cannot end with . or whitespace on Windows";
  }
  if (name.length > 214) return "The project name is too long";
  return null;
}

/**
 * 生成先が使えるか調べます。
 *
 * **既存のディレクトリを上書きしてはいけません。** create 系の道具で
 * 一番やってはいけない事故です。空なら使います。
 */
export function checkTarget(dir, lang = "en") {
  if (!fs.existsSync(dir)) return null;
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    return lang === "ja" ? `${dir} は既にファイルとして存在します` : `${dir} already exists as a file`;
  }
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return null;
  if (lang === "ja") {
    return `${dir} は空ではありません（${entries.length} 件）。別の名前にするか、中身を移してください`;
  }
  return `${dir} is not empty (${entries.length} items). Choose another name or move its contents`;
}
