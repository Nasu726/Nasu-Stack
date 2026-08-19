/**
 * カタログの言語。**英語を既定にしています。**
 *
 * ----------------------------------------------------------------
 * なぜ日本語を「鍵」にするのか
 * ----------------------------------------------------------------
 * `t("余白は迷わせない")` のように、**日本語の原文そのものを鍵**にします。
 * `catalog.hero.title` のような鍵を発明すると、
 *
 *   - 鍵を考える手間が、書くたびに乗る
 *   - 訳を書き忘れたとき、画面に `catalog.hero.title` と出る
 *
 * 原文を鍵にすれば、**訳が無いときは日本語がそのまま出ます。**
 * 読めない人がいるのは同じですが、**壊れて見えることはありません。**
 *
 * ----------------------------------------------------------------
 * なぜ React の状態を使わないのか
 * ----------------------------------------------------------------
 * カタログは静的に配るページで、言語は `?lang=` で決まります。
 * 状態・context・provider を足すと、**全部の部品がそれを知る必要**が出ます。
 * 読み込み時に 1 度決めて、切り替えはただのリンク（再読込）にすれば、
 * 覚えることが増えません。
 */

const params =
  typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);

export type Lang = "en" | "ja";

/** いまの言語。**?lang=ja だけが日本語**で、それ以外は英語です。 */
export const LANG: Lang = params.get("lang") === "ja" ? "ja" : "en";

/**
 * 日本語の原文 → 英語。
 *
 * **ここに無いものは日本語のまま出ます。** 訳し漏れは
 * `scripts/check-catalog-lang.mjs` が数えて印字します。
 */
import { EN } from "./lang.en";

/** 訳す。原文が鍵です。 */
export function t(ja: string): string {
  if (LANG === "ja") return ja;
  return EN[ja] ?? ja;
}

/**
 * いまの URL の `lang` だけ差し替えたもの。
 * **他の値（`tab` や `embed`）は残します。** 切り替えで見ている画面が
 * 変わってしまうと、比べられません。
 */
export function langHref(to: Lang): string {
  const next = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (to === "en") next.delete("lang");
  else next.set("lang", to);
  const q = next.toString();
  return q ? `?${q}` : "./";
}
