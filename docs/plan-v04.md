# v0.4 の計画 — 部品を 4 つ入れる

作る前に、**間違えそうな箇所**を先に洗い出します。
v0.3.5 では計画に書いた「未検証の懸念」から実際にバグが 2 つ出たので、
今回もそのつもりで書きます。

---

## 0. 何を作るか

| 部品 | 何を引き受けるか | 規模の見込み |
|---|---|---|
| `ConfirmDialog` | 「本当に削除しますか？」。いま `window.confirm` で代用している箇所を置換 | 小 |
| `DataTable` | 表。並べ替え・ページング・狭い画面での作り替え | 大 |
| `AsyncSelect` | 検索つきセレクト。入力のたびに取得し、前の要求を中断 | 大 |
| `FileDrop` | ドラッグ&ドロップ・進捗・失敗した分だけ再送 | 中 |

**作らないもの（理由つき）**

- **行の選択（DataTable）** — ページングと相互作用します。「ページをまたいで選択を保つか」
  を決めないと後で作り直しになるので、表本体が固まってから
- `OptimisticList` — 楽観更新は失敗時のロールバック設計が要り、単独で 1 版ぶん
- `Field` の拡張（select / checkbox / radio） — `AsyncSelect` の設計が固まってからの方が安い

---

## 1. ConfirmDialog

### 決めたこと

**native `<dialog>` を使います。** 自前実装だと必要になる次のものが、全部ブラウザ任せになります。

- フォーカスの閉じ込め（ダイアログの外に Tab で出られない）
- 背景の暗転（`::backdrop`）
- Esc で閉じる
- 他の要素より必ず手前に出る（top layer。`z-index` 戦争が起きない）

### API

```tsx
// 使う側
const confirm = useConfirm();
const ok = await confirm({
  title: "この記事を削除しますか？",
  description: "元に戻せません。",
  confirmLabel: "削除する",
  tone: "danger",
});
if (!ok) return;
```

`ActionProvider` に組み込むので、置いてあれば `ActionButton` の `confirm` も
自動でこちらを使います。

```tsx
<ActionButton action={api.remove} confirm="本当に削除しますか？">削除</ActionButton>
```

### 危ないところ

> **Provider が無いときに壊してはいけない。**
> `useConfirm` は Provider が無ければ例外を投げる設計にしがちですが、
> それをすると `ActionButton confirm` が Provider 無しで動かなくなります。
> **Provider が無ければ `window.confirm` に落ちる**ようにします。
> 「無くても動く。あると良くなる」は `ActionProvider` で決めた方針なので、ここも揃えます。

> **`::backdrop` はテーマ変数を継承しません。**
> `dialog::backdrop` は別の擬似要素ツリーなので、`var(--bg)` がそのまま効くか要確認。
> 効かなければ `html` 側に変数を出す必要があります。**実測して確かめます。**

---

## 2. DataTable

### 決めたこと

#### データの与え方は 2 通り

```tsx
// (A) 手元の配列。並べ替えもページングもメモリ上で行う
<DataTable rows={tasks} columns={columns} />

// (B) サーバー側で並べ替え・ページング
<DataTable
  loader={(q, ctx) => jsonRequest(`/api/tasks?page=${q.page}&sort=${q.sort}`, { ctx })}
  columns={columns}
/>
```

`loader` は `{ rows, total }` を返します。よく使う (A) を一番簡単にします。

#### 狭い画面では**表をやめてカードにする**

ここが一番の判断です。320px で 8 列の表は、横スクロールできても実用に耐えません。

```tsx
<DataTable columns={columns} rows={rows} mobile="cards" />  // 既定
```

- `mobile="cards"`（既定）— タブレット幅未満では 1 行 = 1 カードに組み替え、
  各セルに列名のラベルを付ける
- `mobile="scroll"` — 表のまま `Scrollable` に入れる

**列定義に `label` が必須になります。** カード表示で「この値が何なのか」を
示すのがラベルだけになるためです。

### 危ないところ

> **カード表示で列の意味が消える。**
> 表なら見出し行が意味を担いますが、カードにすると各セルが裸になります。
> `label` を必須にし、カードでは `label: value` の形で出します。

> **並べ替えのアクセシビリティ。**
> `<th>` に `aria-sort="ascending|descending|none"` を付け、
> 中身をボタンにしないとキーボードで並べ替えられません。よく忘れられる箇所です。

> **`Scrollable` の中で `<table>` が縮む。**
> v0.3 で入れた `.wt-gap > * { min-width: 0 }` が効くので、
> `min-width` を明示しないと表が潰れます。**実測で確かめます。**

---

## 3. AsyncSelect

### 決めたこと

`useResource` に検索語を依存キーとして渡します。**キーが変われば前の要求は自動で中断される**
ので、競合状態（古い応答が新しい応答を上書きする）は既にこの層で解けています。

```tsx
<AsyncSelect
  label="担当者"
  loader={(q, ctx) => jsonRequest<User[]>(`/api/users?q=${q}`, { ctx })}
  getKey={(u) => u.id}
  getLabel={(u) => u.name}
  onChange={(u) => setOwner(u)}
/>
```

入力ごとに投げないよう、既定 250ms の debounce を入れます。

### 危ないところ

> **ドロップダウンの位置。ここが一番壊れやすい。**
> 画面下部の入力欄で開くと、候補が画面外に出ます。
>
> - 案 A: `@floating-ui/react-dom` を入れる（正確。依存が 1 つ増える）
> - 案 B: 開いた瞬間に空きを測って上下を決める（依存ゼロ。約 20 行）
>
> **案 B にします。** 依存を増やさない方針を優先し、
> 代わりに**320px で画面最下部に置いた状態を実測**して確かめます。
> 足りなければ案 A に差し替えられるよう、位置決めは 1 関数に閉じ込めます。

> **キーボード操作を省くと使えない部品になる。**
> WAI-ARIA の combobox パターンに従います。
> `role="combobox"` / `aria-expanded` / `aria-controls` / `aria-activedescendant`、
> 候補側は `role="listbox"` / `role="option"` / `aria-selected`。
> ↑↓ で移動、Enter で決定、Esc で閉じる、Home/End で端へ。
> **`aria-activedescendant` を使うので、フォーカスは入力欄から動かしません**
> （動かすと入力できなくなります）。

> **iOS の自動拡大。**
> 入力欄なので 16px 以上が必須です。`Field` で踏んだのと同じ罠。

---

## 4. FileDrop

### 決めたこと（ここが今回いちばん重要）

**`fetch` ではアップロード進捗が取れません。** 2026 年時点でもそうです。
Fetch のストリームで測れるのは「ブラウザが自分のストリームからデータを引き取った時点」で、
実際に送信された時点ではありません。バッファリングの影響を受けるため、進捗の指標になりません。
（`fetch` に進捗イベントを足す提案は進行中ですが、まだ使えません。）

**したがって XMLHttpRequest を使います。** ただし利用者に XHR を書かせません。

```tsx
<FileDrop
  action={(file, ctx) => uploadWithProgress("/api/upload", file, ctx)}
  accept="image/*"
  maxSize={5 * 1024 * 1024}
/>
```

`uploadWithProgress` がヘルパとして XHR を隠します。
自前の処理を書きたい人は、`ctx.onProgress(0..1)` を呼ぶだけで進捗バーが動きます。

### 契約をどう拡張するか

中核の `Action` は**触りません**。FileDrop だけが少し広い文脈を渡します。

```ts
type UploadContext = ActionContext & { onProgress: (ratio: number) => void };
type UploadAction = (file: File, ctx: UploadContext) => Promise<unknown>;
```

`ActionContext`（＝ `signal` だけ）はそのままなので、既存の部品に影響しません。

### 危ないところ

> **XHR が `ctx.signal` で中断できるか。**
> `signal.addEventListener("abort", () => xhr.abort())` が要ります。
> 忘れると、画面を離れてもアップロードが続きます。**実測します。**

> **1 ファイルずつか、まとめてか。**
> **1 ファイルずつ**にします。まとめて送ると、1 つ失敗しただけで全部やり直しになります。
> 個別に状態を持てば「失敗した分だけ再送」が自然に書けます。

> **キーボードで使えなくなりがち。**
> ドラッグ&ドロップだけにすると、キーボードのみの人が使えません。
> 本物の `<input type="file">` を必ず置き、見た目だけ差し替えます。

---

## 5. 全部に共通してやること

作った後、**必ず次を通してから完了とします。**

```bash
pnpm verify   # 型検査・ビルド・配布物・実ブラウザ検証（10 項目）
pnpm check    # 端末幅の崩れ（320 / 375 / 414 / 768 / 1024）
```

新しい部品は対話するものばかりなので、`pnpm check` の
**タップ領域 24px 以上**と**入力欄 16px 以上**に自動で引っかかります。
そこが安全網になります。

加えて、カタログに「部品」タブを足して全状態を手で触れるようにします。

---

## 6. 実測で確かめる項目（先に列挙しておく）

計画に書いておかないと見逃すので、先に書きます。

| # | 確かめること | 落ちたらどうするか |
|---|---|---|
| 1 | `dialog::backdrop` にテーマ変数が効くか | `html` 側へ変数を出す |
| 2 | Provider 無しで `ActionButton confirm` が動くか | `window.confirm` へ落とす |
| 3 | `Scrollable` の中で `<table>` が潰れないか | `min-width` を明示 |
| 4 | 320px 最下部で `AsyncSelect` の候補が画面内に収まるか | 上下反転、駄目なら floating-ui |
| 5 | `AsyncSelect` を ↑↓ Enter Esc だけで操作できるか | APG パターンを見直す |
| 6 | XHR が `ctx.signal` で止まるか | abort の配線を直す |
| 7 | アップロード失敗後、その 1 件だけ再送できるか | 状態を per-file に分ける |
| 8 | 新部品が `pnpm check` を全幅で通るか | 直す |
| 9 | 表のカード表示で列名が読めるか | `label` 必須にする |
| 10 | debounce 中に文字を消したとき、古い候補が残らないか | 依存キーの持ち方を直す |

---

## 出典

- [Fetch streams are great, but not for measuring upload/download progress — Jake Archibald](https://jakearchibald.com/2025/fetch-streams-not-for-progress/)
- [Streaming requests with the fetch API — Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests)
