/**
 * verifier共通の判定集計。
 *
 * scenario側は「何を判定するか」だけを持ち、判定数・失敗詳細・終了コードの
 * 組み立てはここへ寄せます。同じmust()が複製されると、失敗詳細を足したscriptと
 * 足していないscriptが生まれ、green / redの意味が検査ごとに変わるためです。
 */
export function createCheckHarness({ write = (line) => console.log(line) } = {}) {
  const checks = [];

  function must(label, ok, detail = "") {
    const result = {
      label: String(label),
      ok: !!ok,
      detail: String(detail),
    };
    checks.push(result);
    write(
      `  ${result.ok ? "✓" : "✗"} ${result.label}${result.detail ? `  (${result.detail})` : ""}`,
    );
    return result.ok;
  }

  function mustEq(label, actual, expected) {
    const ok = Object.is(actual, expected) || String(actual) === String(expected);
    checks.push({
      label: String(label),
      ok,
      detail: `${actual} / 期待 ${expected}`,
    });
    write(`  ${ok ? "✓" : "✗"} ${label}  (${actual}${ok ? "" : ` ← 期待 ${expected}`})`);
    return ok;
  }

  function report({ pageErrors } = {}) {
    const failed = checks.filter((check) => !check.ok);
    write("");
    write(
      failed.length === 0
        ? `✅ 判定 ${checks.length} 件すべて成功`
        : `❌ 判定 ${checks.length} 件中 ${failed.length} 件が失敗`,
    );
    for (const failure of failed) {
      write(`   ✗ ${failure.label}  ${failure.detail}`);
    }

    const errors = Array.isArray(pageErrors) ? pageErrors : null;
    if (errors) {
      write(
        errors.length === 0
          ? "✅ pageerror 0 件"
          : `❌ pageerror ${errors.length} 件:\n${errors.join("\n")}`,
      );
    }

    return {
      ok: failed.length === 0 && (!errors || errors.length === 0),
      checkCount: checks.length,
      failedCount: failed.length,
      pageErrorCount: errors?.length ?? 0,
    };
  }

  function exit({ code, pageErrors } = {}) {
    const result = report({ pageErrors });
    process.exit(code ?? (result.ok ? 0 : 1));
  }

  return { checks, must, mustEq, report, exit };
}

export const log = (...args) => console.log("·", ...args);
