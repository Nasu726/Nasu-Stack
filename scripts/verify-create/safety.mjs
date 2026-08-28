import fs from "node:fs";
import path from "node:path";

export async function verifySafety({ work, CLI, create, must }) {
  /* ===== 4〜5. 上書き事故の防止 =================================== */
  {
    // 既存の空でないディレクトリには生成しない。
    // create 系の道具で一番やってはいけない事故です。
    const r = create("my-site", ["--template", "astro"]);
    must("4. 空でないディレクトリには生成しない", !r.ok, `終了コード ${r.status}`);
    must(
      "   もとのファイルが残っている",
      fs.existsSync(path.join(work, "my-site", "package.json")),
    );

    fs.mkdirSync(path.join(work, "empty-dir"));
    const r2 = create("empty-dir", ["--template", "astro"]);
    must("5. 空のディレクトリになら生成できる", r2.ok);
  }

  /* ===== 6. 名前の検証 ============================================ */
  {
    const { validateName } = await import(
      new URL(`file://${CLI}`).href
    );
    /* **通ってしまうと、あとで分かりにくい形で失敗するもの**を並べます。
       とくに Windows の予約語は厄介で、生成そのものは走るのに
       フォルダが作れず、理由の出ないまま途中で止まります。 */
    const cases = [
      ["My-Site", "大文字"],
      ["my site", "空白"],
      [".hidden", "先頭のドット"],
      ["", "空"],
      ["a/b", "スラッシュ"],
      ["con", "Windows の予約語"],
      ["nul", "Windows の予約語"],
      ["com1", "Windows の予約語"],
      ["aux.txt", "予約語 + 拡張子（これも作れません）"],
      ["a<b", "Windows で使えない記号"],
      ["my-site.", "ドットで終わる（Windows）"],
    ];
    for (const [name, why] of cases) {
      must(`6. 不正な名前を弾く（${why}）`, validateName(name) !== null, validateName(name) ?? "通ってしまった");
    }
    must("   まともな名前は通る", validateName("my-site-2") === null);
  }


}
