import { setTimeout as sleep } from "node:timers/promises";

/**
 * 公開ホストや経路の一時障害として再試行してよい HTTP status です。
 *
 * 404 などは配布漏れの可能性が高いため含めません。呼び出し側が期待する
 * status を判定し、恒常的な失敗は今までどおり検査を落とします。
 */
export const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * 読み取り専用の公開物検査で使う、上限付き fetch retry です。
 *
 * Response は最終 attempt のものをそのまま返します。したがって transient
 * status が続いても成功扱いにはならず、呼び出し側の `response.ok` 判定が
 * 必ず失敗を記録できます。
 */
export async function fetchWithRetry(
  input,
  init,
  {
    attempts = 3,
    baseDelayMs = 250,
    fetchImpl = globalThis.fetch,
    onRetry = () => {},
  } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError("attempts は 1 以上の整数で指定してください");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new TypeError("baseDelayMs は 0 以上の有限値で指定してください");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl は関数で指定してください");
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(input, init);
      const transient = TRANSIENT_HTTP_STATUSES.has(response.status);
      if (!transient || attempt === attempts) return response;

      // 次の attempt で接続を使い回せるよう、読まない body を明示的に閉じます。
      await response.body?.cancel().catch(() => {});
      onRetry({ attempt, nextAttempt: attempt + 1, status: response.status });
    } catch (error) {
      if (attempt === attempts) throw error;
      onRetry({ attempt, nextAttempt: attempt + 1, error });
    }

    // 250ms, 750ms。外部障害を長時間待ち続けない有限の backoff です。
    await sleep(baseDelayMs * 3 ** (attempt - 1));
  }

  throw new Error("到達不能な fetch retry 状態です");
}
