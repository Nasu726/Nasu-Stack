/** tag内容と、mainで公開smokeしたcommitがずれないrelease policyを固定します。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCheckHarness } from "./_check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "release.yml"),
  "utf8",
);
const { must, report } = createCheckHarness();

const ancestry = workflow.indexOf('git merge-base --is-ancestor "${GITHUB_SHA}" origin/main');
const pages = workflow.indexOf('--workflow pages.yml --branch main --commit "${GITHUB_SHA}" --status success');
const asset = workflow.indexOf('pnpm release:build "${GITHUB_REF_NAME}"');
const publish = workflow.indexOf('gh release create "${GITHUB_REF_NAME}" release/*');

must(
  "release jobはActionsの成功runを読む最小権限を持つ",
  /permissions:\s*[\s\S]*?actions:\s*read[\s\S]*?contents:\s*write/.test(workflow),
);
must(
  "tag SHAがorigin/mainの祖先でなければreleaseしない",
  ancestry >= 0,
);
must(
  "同じSHA・main branch・pages workflowのsuccessを要求する",
  pages >= 0,
);
must(
  "ancestryとPages smokeをasset build/publishより前に確認する",
  ancestry < asset && pages < asset && asset < publish,
  JSON.stringify({ ancestry, pages, asset, publish }),
);

process.exit(report().ok ? 0 : 1);
