# v2.0.1 — tag前の境界修正結果

## 結論

remoteの`v2.0.1` tag / GitHub Releaseを公開する前に見つかったため、版を飛ばさず
未公開の`2.0.1` release candidateへ取り込んだ。新しいprimitiveや公開exportは増減せず、
下位hook・上位component・transport・form controlの既存契約を一致させた。

## 修正した境界

- `pendingDuringGuard`を`AsyncForm` / `ActionButton`から`useAction`へforwardした
- FormData foldingをnull-prototype objectへ変更し、prototype名、同名の空値、
  unchecked checkboxを利用者の文字列値と衝突せず扱うようにした
- HTTP errorの`fields`をplain object / non-empty stringとしてtransport境界で正規化し、
  対応controlが無いfield名だけでも一般errorが消えないようにした
- validation payloadへ`VALIDATION` codeを付け、field errorもHTTP statusにかかわらず
  automatic retryの対象外にした
- form fieldのdisabled / event / ARIAを利用者propsと内部mechanicsでcomposeした
- `FieldArray.defaultItems`をmount時だけ読むuncontrolled契約へ実装を揃えた
- SearchListの`aria-controls`、RadioGroupのrequired semantics、`createSubmit`の
  serialization error分類を修正した
- release workflowをmain ancestryと同じSHAのPages成功runでgateした

## 回帰検査

追加したunit / browser probeは、次を直接観測する。

- `AsyncForm` / `ActionButton`のoption forwarding
- `__proto__` / `constructor`、repeated empty、旧sentinel文字列、unchecked checkbox
- 不正なresponse field shape、存在しないfield名、HTTP 400 validationの非retry
- 利用者propsを渡した後もpending disabled・error clear・ARIAが残ること
- late `defaultItems`、常在するSearchList result target、native radio required
- BigIntを含むtransform結果が`SERIALIZATION`となりnetwork requestを出さないこと
- tag SHAのmain ancestryと同一SHAのPages successをrelease前に要求すること

## 実測

- `pnpm verify`: 35 / 35
- `pnpm verify:create`: 113 / 113
- public registry contract: 51 item / 53 file / 251 export
- translation parity: 16組
- responsive: catalog / demo 29ページ × 5画面幅
- release asset 3経路: 271,977 bytes / SHA-256
  `5367e8ea68e8316b0c4d688a1434ec92bd420226b93623e54058950ba22be2b4`
- 不一致tag `v2.0.2`: exit 1

`verify:create`ではAstro最小構成・ブログ構成・Vite構成を生成し、実際のnpm install、
本物のshadcn CLI、型検査、build、配信、browser検査まで通した。

## 意図的に分けたもの

previous Stable tagとの`.d.ts` surface / semantic token比較は必要だが、互換判定規則と
baseline取得方法を決める作業である。今回の明白なbug fixへ、未確定のmajor互換判定を
混ぜず、別計画で扱う。
