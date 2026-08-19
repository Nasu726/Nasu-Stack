/**
 * `registryDependencies` の書き方。**ここが唯一の定義です。**
 *
 * ----------------------------------------------------------------
 * なぜ 2 つの形が要るのか
 * ----------------------------------------------------------------
 * 利用者が部品を入れる経路は 2 つあります。**読まれるファイルが違います。**
 *
 *   npx shadcn add Nasu726/Nasu-Stack/action-button
 *     → GitHub が **commit されている `registry.json`** を読みます
 *       （`public/` は生成物なので commit していません）
 *
 *   npx shadcn registry add "@nasu=…" && npx shadcn add @nasu/action-button
 *     → 公開先の **`public/r/<name>.json`** を読みます
 *
 * 依存の書き方が片方に合っていないと、**そちらの経路だけが黙って壊れます。**
 * 実際、`@nasu/…` と書いていたので `owner/repo` 形式は依存の解決で落ちていました
 * （`Unknown registry "@nasu"`。v0.9f で実測）。
 *
 * だから **commit する側は `owner/repo` 形式**にして、
 * 公開用に書き出すときだけ `@nasu/` へ直します。
 *
 * こうすると、どちらの経路も**取り寄せ先が 1 つに揃います**。
 * 混ぜると、部品は公開先から・依存は GitHub の既定ブランチから来て、
 * 版がずれます。
 */

/** GitHub 上の場所。`owner/repo` 形式の頭に付きます。 */
export const REPO = "Nasu726/Nasu-Stack";

/** shadcn の名前空間。`components.json` の `registries` に書く名前です。 */
export const NAMESPACE = "@nasu";

/**
 * 依存 1 件から、こちらの部品名を取り出します。よそのレジストリなら `null`。
 * **両方の形を受けます。** 書き換えの途中で片方だけ直っていても気づけるように。
 */
export function localDep(dep) {
  for (const prefix of [`${REPO}/`, `${NAMESPACE}/`]) {
    if (dep.startsWith(prefix)) return dep.slice(prefix.length);
  }
  return null;
}

/** 公開用（`@nasu/…`）の形へ。よそのレジストリはそのまま通します。 */
export function toNamespace(dep) {
  const name = localDep(dep);
  return name ? `${NAMESPACE}/${name}` : dep;
}

/** commit 用（`owner/repo/…`）の形へ。 */
export function toRepo(dep) {
  const name = localDep(dep);
  return name ? `${REPO}/${name}` : dep;
}
