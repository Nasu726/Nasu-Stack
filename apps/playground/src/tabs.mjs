/**
 * カタログのタブ一覧。**ここが唯一の情報源です。**
 *
 * 以前はタブ名が App.tsx・scripts/_browser.mjs・scripts/verify.mjs の
 * 3 か所にありました。タブを足したときにどれかを忘れると、
 * **その画面だけ検査から漏れて、しかも何も言われません。**
 * 実際 v0.4 と v0.5 の部品は、既定タブしか見ていなかったせいで
 * 320px で一度も検査されていませんでした。
 *
 * `.mjs` にしてあるのは、ブラウザ側（App.tsx）と
 * Node 側（検査スクリプト）の両方から読めるようにするためです。
 *
 * ここに足しただけで `App.tsx` の `PANELS` に中身を書かないと、
 * その章は「まだ準備中です」と表示され、**理由はコンソールに出ます**
 * （画面には出しません。見に来た人にこちらのファイル名は手がかりに
 * ならないためです）。
 */

/** @type {{ key: string, label: string }[]} */
export const TABS = [
  { key: "layout", label: "レイアウト" },
  { key: "responsive", label: "端末幅" },
  { key: "parts", label: "部品" },
  { key: "forms", label: "入力/選択" },
  { key: "state", label: "状態" },
  { key: "nav", label: "ナビ/開閉" },
  { key: "text", label: "本文/画像" },
];

export const TAB_KEYS = TABS.map((t) => t.key);

export const DEFAULT_TAB = TABS[0].key;

/** URL の ?tab= を、存在するタブに丸めます。 */
export function normalizeTab(value) {
  return TAB_KEYS.includes(value) ? value : DEFAULT_TAB;
}
