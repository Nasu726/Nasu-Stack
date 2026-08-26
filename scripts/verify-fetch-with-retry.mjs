import assert from "node:assert/strict";
import { fetchWithRetry } from "./fetch-with-retry.mjs";

let transientCalls = 0;
const recovered = await fetchWithRetry("https://fixture.invalid/transient", undefined, {
  baseDelayMs: 0,
  fetchImpl: async () => {
    transientCalls += 1;
    return new Response(transientCalls < 3 ? "temporary" : "ok", {
      status: transientCalls < 3 ? 503 : 200,
    });
  },
});
assert.equal(recovered.status, 200);
assert.equal(transientCalls, 3, "一時的な 503 は上限内で再試行する");

let missingCalls = 0;
const missing = await fetchWithRetry("https://fixture.invalid/missing", undefined, {
  baseDelayMs: 0,
  fetchImpl: async () => {
    missingCalls += 1;
    return new Response("missing", { status: 404 });
  },
});
assert.equal(missing.status, 404);
assert.equal(missingCalls, 1, "404 は配布漏れを隠さず即座に返す");

let persistentCalls = 0;
const persistent = await fetchWithRetry("https://fixture.invalid/persistent", undefined, {
  attempts: 3,
  baseDelayMs: 0,
  fetchImpl: async () => {
    persistentCalls += 1;
    return new Response("still unavailable", { status: 503 });
  },
});
assert.equal(persistent.status, 503);
assert.equal(persistentCalls, 3, "継続する 503 は上限で止まり、失敗 status を返す");

let networkCalls = 0;
await assert.rejects(
  fetchWithRetry("https://fixture.invalid/network", undefined, {
    attempts: 2,
    baseDelayMs: 0,
    fetchImpl: async () => {
      networkCalls += 1;
      throw new TypeError("fixture network error");
    },
  }),
  /fixture network error/,
);
assert.equal(networkCalls, 2, "network error も有限回で止まる");

console.log("✓ transient 503 は回復するまで有限回だけ再試行する");
console.log("✓ 404 は再試行せず、継続する 503 / network error は失敗のまま返す");
