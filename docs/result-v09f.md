# v0.9f の結果

**shadcn のディレクトリへ PR を出そうとして、出さなくてよいことが分かった版**です。
そして、外から来た人が読む面を英語にしました。

| | 前 | 後 |
|---|---|---|
| 部品の入れ方 | `registry add` してから `@nasu/…` | **`Nasu726/Nasu-Stack/…` だけ**（設定ゼロ） |
| 表に出る言語 | 日本語 | **英語**（日本語版は `.ja` と `?lang=ja`） |
| `pnpm verify` | 25 工程 | **27 工程** |

---

## 1. ディレクトリ掲載を調べたら、要らなかった

280 件の `directory.json` を実データで照合しました。

### 機械の検査は言語を見ていない

`apps/v4/scripts/validate-registries.mts` の中身です。

```ts
name: z.string().regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/),
homepage: z.string().url(),
url: z.string().refine((url) => url.includes("{name}")),
description: z.string(),   // 長さも言語も見ていない
logo: z.string(),           // SVG かどうかすら見ていない
```

**日本語でも機械は通ります。** ただし **280 件中、非ラテン文字を含む
description は 0 件**でした。落とされるとしたら人のレビューです。

### 用意していた entry には欠陥が 4 つあった

| | いま | 正 |
|---|---|---|
| 鍵の名前 | `registry` | **`url`** |
| name | `"nasu"` | **`"@nasu"`**（280/280 が `@` 始まり） |
| logo | **無し** | 必須。280/280 がインライン `<svg>` |
| homepage | github.com | **264/280 が url と同じホスト** |

`public/logo.svg` を作りました。344 字、単一行、外部参照なし。

### そもそも掲載が要らない

公式文書に書いてあり、実際に動きました。

```
npx shadcn add Nasu726/Nasu-Stack/utils
✔ Created 1 file: src/lib/utils.ts
```

ただし**依存のある部品は落ちていました。** `registryDependencies` が
`@nasu/…` だったためです。

### 直し方

**読まれるファイルが経路ごとに違います。**

| 経路 | 読まれるファイル |
|---|---|
| `owner/repo` 形式 | **commit されている `registry.json`**（`public/` は生成物） |
| `@nasu` 名前空間 | 公開先の `public/r/<name>.json` |

commit 側を `owner/repo` 形式にし、**公開用に書き出すときだけ `@nasu/` へ
戻します**（[`scripts/_deps.mjs`](../scripts/_deps.mjs) が唯一の定義）。
どちらの経路も取り寄せ先が 1 つに揃い、版がずれません。

**この形が片方に寄っても、今までの検査は全部緑のままでした。**
`@nasu` 経路しか見ていなかったからです。2 つ足しました。

---

## 2. 英語を表に出した

| 表（英語） | 退避（日本語） |
|---|---|
| `README.md` / `SECURITY.md` | `*.ja.md` |
| `docs/boundaries` / `overview` / `security` / `astro-and-react` | `*.ja.md` |
| `public/index.html` / `404.html` | — |
| カタログ（既定） | `?lang=ja` |
| デモサイト | 和文組版の記事 1 本 |

開発者向け（`development` / `handoff` / `plan-*` / `result-*`）は日本語のままです。

### 翻訳のずれを機械で見る

**同じことを 2 言語で書いた時点で、同じ値が 2 か所にあります。**
しかも**英語版が古くなる方向**にずれます（書いている人が日本語話者なので）。

意味は機械で見られないので、**打てば動くものだけ**比べます。

```
scripts/check-translations.mjs   ```bash の中身 / https:// の URL / 相互リンク
scripts/check-catalog-lang.mjs   訳し漏れ / 使われていない訳 / 訳に残った日本語
```

いきなり本物のずれを 3 件見つけました。`docs/security.ja.md` が
`create-nasu-stack-0.1.0.tgz` という**存在しない URL** を載せたままでした。

**そして検査自身が、最初コマンドを 1 つも見ていませんでした。**
文書は CRLF なので ` ```bash\n ` が 1 件も当たらず、URL だけ比べて緑でした。

### カタログは機械で包んだ

650 行を手で包むと必ず数十件取りこぼします。取りこぼしは
**英語で見たときだけ日本語が出る**形なので、日本語話者は気づけません。

TypeScript の parser で構文木を作り、**文字列と JSX のテキストだけ**
拾って位置を差し替えました（コメントは開発者向けなので日本語のまま）。
printer は使っていません。全行が差分になって読めなくなるためです。

`JsxText` の `getStart()` は前の空白を飛ばした位置を返すので、
そこへ `indexOf` を足すと二重にずれます。**閉じタグを食べて `</p>` が
`p>` になりました。** 型検査が全部挙げてくれました。

鍵は**日本語の原文そのもの**です。`catalog.hero.title` のような鍵を
発明すると、訳が無いときに画面へその鍵が出ます。原文を鍵にすれば
日本語がそのまま出るので、**壊れて見えません。**

---

## 3. 英語化が崩れを 8 件出した

**和文は全角なので上限に当たらず、訳すまで誰も気づけませんでした。**

```
欧文 77em(上限 40em) "Below is the real thing (s…"
欧文 77em(上限 40em) "This header is z-30 . When…"
欧文 66em(上限 40em) "Arrow keys move, Home / En…"
欧文 56em(上限 40em) "↑ Twelve of them, so it sc…"
欧文 48em(上限 40em) "From layout components and…"   ← 記事一覧の説明文 3 件
欧文 43em(上限 40em) "Sample only. Files go nowh…"
```

どれも器いっぱいに伸びる段落でした。prose 幅で止めています。

見えたのは、**端末幅の検査を両方の言語で回す**ようにしたからです。
操作の検査（選択子が日本語）は `?lang=ja` を開きます。

---

## 4. デモに日本語を 1 本残した理由

`prose.css` の行間 1.85 と幅 40em は**和文向け**に決めてあり、
`check-responsive` も 1 行の上限を和文 45em / 欧文 40em で切り替えます。
**デモから日本語が消えると、その経路を誰も見なくなります。**

言語切替は入れていません。Astro は静的なので `/ja/` の経路をもう 1 つ
生成することになり、sitemap・RSS・SEO の検査が全部 2 倍になります。
中身が架空の会社の見本である以上、その値段は見合いません。

---

## お願いすること

1. **`main` へマージ** → `verify-published` の「設定ゼロで入る」が緑になります
   （GitHub は既定ブランチを読むので、マージするまで赤いのが正しい状態です）
2. **実際に何人かに使ってもらう**
3. shadcn のディレクトリは**急がなくてよくなりました**。出すときの手順と
   entry の形は [`shadcn-directory.md`](shadcn-directory.md) に直してあります
