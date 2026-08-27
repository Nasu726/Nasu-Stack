# v2.0 Stable 後 — 全体リファクタリング実施結果

[`plan-refactor-v2.md`](plan-refactor-v2.md)の各Waveについて、実装・intentional break・
検査・PR・main公開状態の直接証拠だけを記録する。

## 基準線

- base: `250088dbc748f39dfd5a49222a7f444cb5a83b5f`
- `pnpm verify`: 33 / 33
- `pnpm verify:create`: 112 / 112
- registry: 51 item / 53 installed file
- state browser: 98 / 98、pageerror 0
- responsive: 日英29 page × 5幅

## 実装台帳

| Wave | 状態 | PR | 証拠 |
|---|---|---|---|
| 0: plan / check harness | local完了 | — | verify 34/34 / verify-create 112/112 / intentional failure exit 1 |
| 1: catalog / state demo | 未着手 | — | — |
| 2: create CLI modules | 未着手 | — | — |
| 3: verifier scenarios | 未着手 | — | — |
| 4: build / fixture helpers | 未着手 | — | — |
| 5: public registry audit | 未着手 | — | — |
| 6: completion audit | 未着手 | — | — |

## Wave 0 — plan / check harness

### 実施

- 33,458行を棚卸しし、行数と責任数を分けた計画を`plan-refactor-v2.md`へ記録
- 11本以上に複製されていたchecks配列、`must()`、`mustEq()`、失敗一覧、pageerror集計を
  `scripts/_check.mjs`へ集約
- browser harnessも同じ集計器を使うが、browser lifecycleとpageerror収集は`_browser.mjs`に維持
- `verify-check-harness.mjs`を追加し、集計数、失敗詳細、pageerror、子processのexitを自己検査
- 各scenarioの判定内容・順序・件数は変更せず、診断形式とexit ownershipだけを共通化

### intentional break

別processで必ずfalseになる判定を実行し、exit code 1を確認した。成功だけの別processは
exit code 0になる。同じprocess内でも4判定中2失敗・pageerror 1件を正しく分けて集計した。

### local検証

- check harness self-test: 8/8
- action unit: 27/27
- SEO / feed unit: 36/36
- validation unit: 17/17
- resource key unit: 13/13
- receiver unit: 41/41
- create light: 79/79
- `pnpm verify` / `pnpm verify:create`を同じWindows checkoutで同時実行
- `pnpm verify`: 34/34、state browser 98/98、pageerror 0、日英29 page × 5幅
- `pnpm verify:create`: 112/112、Astro / blog / Viteのnpm install、audit、real shadcn、
  typecheck、build、browser、responsiveが成功
