/**
 * 公開先の URL。**ここが唯一の定義です。**
 *
 * この文字列は、放っておくと 4 か所に散ります。
 *
 *   - `public/index.html` の案内
 *   - 生成物の `components.json`（利用者が部品を足すときに使う）
 *   - 生成物の README
 *   - リポジトリの README
 *
 * 散ると、**リポジトリ名を変えた日に静かに壊れます。** しかも壊れるのは
 * こちらの手元ではなく、利用者が `npx shadcn add` を打った瞬間です。
 * 気づけません。だから 1 か所にします。
 *
 * リポジトリの README だけは人が読む文章なので手書きですが、
 * 機械が出すものは全部ここから取ります。
 */

/** GitHub Pages の project site。リポジトリ名がパスに入ります。 */
export const PUBLIC_BASE = "https://nasu726.github.io/WebTemplate";

/** shadcn CLI の `registries` に書く形。`{name}` は CLI が置き換えます。 */
export const REGISTRY_URL = `${PUBLIC_BASE}/r/{name}.json`;

/** 入口の CLI。npm には publish しないので、tarball を直に指します。 */
export const TARBALL_URL = `${PUBLIC_BASE}/create-webtemplate.tgz`;
