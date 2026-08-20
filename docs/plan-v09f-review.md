# v0.9f — v1.0 リリース前レビュー対応計画

対象レビュー: `Nasu-Stack_v1_pre_release_review.md`（2026-08-19）

レビューは `main d1721ae` と当時の PR #10 を基準にしています。現在の
`main acc7828` へ照合したところ、BLOCKER-01〜10 はどれも英語対応とは
重複せず、現行コードで再現できる未対応項目でした。

この版では **Public Beta から v1.0 RC へ進むための境界バグ**を直します。
見た目の追加ではなく、「初心者が典型的な失敗をしても、成功したふり・
消したものの復活・操作不能にならないこと」が完了条件です。

## 判断基準 — 誰の判断を引き受けるか

Nasu Stack は「選択肢を減らす道具」ではなく、**Web開発で繰り返す判断を、
安全な既定値・制約・primitive / contract へ変換する道具**と定義します。

新しい既定動作を足す前に、毎回この順で判断します。

1. 何を知らないと、利用者はどこで困るか
2. Nasu Stack が肩代わりできる機械的な判断か
3. 肩代わりすると、事実と違う成功・安全の断定をしないか
4. domain / server / infrastructure にしか決められない部分はどこか
5. 経験者が下の層へ降りる escape hatch が残っているか

責任は次のように分けます。

| Nasu Stack が引き受ける | 利用者 / domain が決める | server / infrastructure が保証する |
|---|---|---|
| UI state、二重実行防止、stale な結果を画面へ commit しないこと | 操作の意味、行 action の文言、選択値の serialize 方法 | 認証・認可・domain validation |
| public API の型と runtime の契約、予期しない応答を成功にしないこと | retry してよい idempotent operation か | status / Content-Type / response schema |
| keyboard / screen reader / contrast / time limit の安全な既定 | 既定を上書きする明示指定 | rate limit、CSRF、bot 対策、upload の実体検証 |
| abort を伝え、取消後の古い応答を無視すること | server で既に確定した処理をどう取り消すか | transaction / idempotency / cancellation の実処理 |

このため、pending add の取消は**画面への復活を防ぎ abort を伝えるところまで**を
引き受けます。サーバーで create が確定済みなら、それを巻き戻したとは断定しません。
`jsonRequest` は JSON という通信契約を検査しますが、返った JSON の domain schema
までは保証しません。Cloudflare receiver は安全機能そのものではなく、境界を実装した
見本であり、認証・rate limit・bot 対策を引き受けません。

`docs/boundaries.md` / `.ja.md` は免責事項ではなく公開設計文書として更新し、
「こちら・利用者・server / infrastructure」の責任と escape hatch を明示します。

---

## 進め方

各項目を必ず次の順で進めます。

1. 現在の壊れ方を再現する検査を足す
2. 修正前の実装で、その検査だけが赤くなることを確認する
3. 実装を直して緑へ戻す
4. 関連する既存検査を通す
5. ひとまとまりごとに `pnpm verify` を通してから次へ進む

単体検査へ実装を写しません。配る原本を import するか、実ブラウザで配る
画面そのものを操作します。

---

## Wave 1 — 状態と通信の境界

### 1. pending add の取消（BLOCKER-03）

- add operation ごとに中断と cancelled/stale 判定を持つ
- remove された pending add は、通信が成功しても base へ commit しない
- transport が AbortSignal を無視する場合も復活させない
- 利用者が取り消した操作を error 通知にしない

### 2. JSON 応答を fail closed にする（BLOCKER-04）

- 204 / 205 / 空の 2xx は `undefined` で成功
- JSON media type + 正しい JSON だけを値として成功
- non-empty non-JSON と malformed JSON は `BAD_RESPONSE`
- text endpoint は `jsonRequest` の責務に混ぜない

### 3. Cloudflare receiver の runtime validation（BLOCKER-05）

- `JSON.parse()` の結果を `unknown` として narrow する
- null / array / 非文字列 field は 400、通常の入力エラーは 422
- `application/json` と `application/*+json` だけを受ける
- 拒否した入力でメール送信が 0 回、uncaught exception が 0 件

### 4. async callback / retry policy（BLOCKER-09）

- `AsyncForm.onSuccess` の Promise を `useAction` まで返す
- `retryDelay` の throw を通常の `ActionError` 契約へ流す
- NaN / Infinity / 負数を待機時間として使わない
- callback の失敗で action 本体を再実行しない

---

## Wave 2 — v1.0 で固定する公開 API

### 5. AsyncSelect（BLOCKER-06）

- controlled / uncontrolled を明確に分ける
- 初期 value、親からの変更、null を表示へ同期する
- query input へ `name` を付けず、選択値用 hidden input を使う
- 既定の form value は `String(getKey(item))`、必要なら `getFormValue` で上書き
- native form reset と AsyncForm 成功後の表示を一致させる

### 6. useResource key（BLOCKER-08）

- 「useEffect と同じ」という説明をやめ、構造比較する query key と定義する
- JSON 互換の有限値だけを型と runtime の両方で受ける
- object key order を正規化し、型タグを含む安定 serializer を使う
- undefined / NaN / Infinity / BigInt / cyclic は明確に拒否する

### 7. DataTable row action（BLOCKER-02）

- pointer shortcut と同じ処理へ到達する明示的な button を desktop/mobile に置く
- checkbox や行内 control の操作を row action へ伝播させない
- keyboard-only で Tab → Enter が使えることを実ブラウザで検査する
- v1.0 の public API として action label の渡し方を明示する

---

## Wave 3 — アクセシビリティの既定値

### 8. semantic color contrast（BLOCKER-01）

- theme 4種 × light/dark の semantic foreground/background を実ブラウザで測る
- computed color を sRGB にして、通常文字 `>= 4.5:1` を丸めず判定する
- token を文字色として card/bg 上で使う実例も測る
- 個別部品ではなく token の値を直す

### 9. ThemeSwitcher（BLOCKER-07）

- custom `role=radio` を native radio + fieldset/legend へ置き換える
- group 内の Tab stop、矢印移動、wrap、checked と実テーマの一致を測る

### 10. action 付き Toast（BLOCKER-10）

- duration 未指定の action 付き toast は自動で消さない
- duration を明示した場合の利用者指定は尊重する
- keyboard focus と時間経過後の action 実行を実ブラウザで検査する

---

## 今回から分離するもの

レビューの POST-01〜07 は、BLOCKER-01〜10 の完了後に別タスクとして再判定します。
特に rate limit / Turnstile / idempotency は、現行文書が「引き受けない」と
明示しているため、この版で受け口の責務を勝手に広げません。

v1.0 tag、version、CHANGELOG、固定 tarball、release asset は修正ブランチとは
別の release engineering gate です。RC のコードが固まってから扱います。

---

## 完了条件

- BLOCKER-01〜10 の回帰検査があり、修正前なら赤になることを確認済み
- `pnpm verify`
- `pnpm verify:create`
- PR head の `verify` / `verify-create`
- main merge後の Pages deploy
- 公開先に対する `verify-published`

公開後でなければ測れない最後の2項目は、PR中に成功したふりをせず、
マージ後の作業として明記します。
