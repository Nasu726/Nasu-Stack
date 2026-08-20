# v0.9f — v1.0 リリース前レビュー対応結果

対象: `Nasu-Stack_v1_pre_release_review.md` の BLOCKER-01〜10。

10 件を個別の応急処置にせず、Nasu Stack が引き受ける責任の層で直しました。
判断基準は [`boundaries.ja.md`](boundaries.ja.md)、実施前の分類と完了条件は
[`plan-v09f-review.md`](plan-v09f-review.md) にあります。

## 結果

| Blocker | 修正した契約 | 修正前の再現 | 回帰検査 |
|---|---|---|---|
| 01 色 | 4 theme × light/dark の semantic token が通常文字で 4.5:1 以上 | neutral / warm / vivid の 7 組が不足 | Chromium が描画した sRGB で 88 組を判定 |
| 02 DataTable | pointer shortcut と同じ row action を desktop / mobile の button から実行可能 | button が両表示に存在しない | Tab → Enter、checkbox の Space が行へ伝播しない |
| 03 pending add | remove 後は transport が abort を無視しても古い add を commit しない | 取消後に item が復活 | pending add の abort と stale 世代を実ブラウザで確認 |
| 04 JSON | 空の成功だけ `undefined`、本文ありは JSON media type + 正しい JSON のみ成功 | 200 HTML を成功扱い | 204 / 205 / 空本文 / malformed / non-JSON を判定 |
| 05 receiver | JSON の runtime shape と media type を副作用前に fail closed | null / array / 非文字列で例外または曖昧な応答 | 41 件で HTTP とメール送信 0 回を確認 |
| 06 AsyncSelect | controlled / uncontrolled、選択値の form 送信、native reset | 初期値・親変更・reset・query 送信で 9 件失敗 | 表示同期、custom form value、reset を実ブラウザで確認 |
| 07 ThemeSwitcher | native radio + fieldset / legend を土台にする | button の custom radio で矢印・wrap が動かない | checked、同一 group、左右矢印、wrap、実 theme 反映 |
| 08 useResource | 有限で構造的な query key を安定 serialize | `JSON.stringify` の衝突と暗黙変換 | key 順・型タグ・不正値・循環・sparse array の 13 件 |
| 09 callback / retry | async `onSuccess` を待ち、不正な retry policy は制御された失敗 | Promise、throw、NaN / Infinity / 負数が契約外へ漏れる | 状態 22 件と AsyncForm の完了順を実ブラウザで確認 |
| 10 Toast | action 付きは既定で永続、明示 `duration` は尊重 | 5 秒後に action が消える | 5.4 秒後の focus + Enter と明示 duration を確認 |

## 責任分界へ反映したこと

- 安全な既定値、明示的な境界、escape hatch、再利用できる primitive / contract を
  4 原則として公開文書の冒頭へ置いた
- 中断は stale UI を止める責任であり、サーバ側の副作用を巻き戻す保証ではない
- `jsonRequest` は transport を検査し、domain schema までは断定しない
- retry の可否は domain、冪等性・重複排除は server の責任
- ブラウザが意味と操作を持つ control は native を土台にし、既定 timer で操作を奪わない
- shadcn でコピー後に変更したソースは利用者のアプリの責任範囲になる

## 今回に混ぜなかったもの

レビューの POST-01〜07 と release engineering（version / tag / CHANGELOG /
release asset）は分離しました。rate limit・Turnstile・idempotency を受け口の見本へ
足すかは、`boundaries` の責任を広げる判断なので、今回の UI / contract 修正には
混ぜていません。

## 検証

- 各 Blocker は修正前に該当する検査が赤くなることを確認済み
- `pnpm verify`: **29 / 29**（全ブラウザ検査、日英 22ページ × 5幅を含む）
- `pnpm verify:create`: **106 / 106**（Astro / blog / Vite の npm install・
  型検査・build・実ブラウザ・本物の shadcn CLI を含む）
- PR CI・公開先検査: commit / push 後と main への merge 後に実施
