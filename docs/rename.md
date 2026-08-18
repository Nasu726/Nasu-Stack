# 改名: WebTemplate → Nasu Stack

v0.9e で改名しました。

| | |
|---|---|
| 表示名 | **Nasu Stack** |
| リポジトリ | `Nasu726/Nasu-Stack` |
| 公開先 | `https://nasu726.github.io/Nasu-Stack/` |
| 入口の CLI | `create-nasu-stack` |

## なぜ

`WebTemplate` は一般名詞すぎました。

- Web 業界を牛耳る巨大プロジェクトのように誤解されうる
- 将来、本当に大きなプロジェクトがその名前を使いたくなったとき塞いでしまう
- **個人のプロジェクトだと分かりにくい**

`Stack` にしたのは、この先バックエンドまで広げるためです。
**名前が実態より広いのではなく、実態が名前に追いつく順番**にしています。

## なぜ Beta を名乗る前だったか

**GitHub のリポジトリ名を変えると、Pages の URL は転送されません。**
リポジトリの URL は転送されますが、`nasu726.github.io/WebTemplate/` は
404 になります（[GitHub のドキュメント](https://docs.github.com/en/enterprise-cloud@latest/repositories/creating-and-managing-repositories/renaming-a-repository)）。

レジストリの住所は、生成したプロジェクトの `components.json` に焼き込まれます。
**利用者が増えるほど改名の代償が上がる**ので、名乗る前が最後の機会でした。

旧 URL を生かす方法はありません（レジストリは JSON なので meta refresh が効きません）。

## 何を変えたか

**① 唯一の定義（ここだけで URL が全部連動します）**

| 場所 | |
|---|---|
| `scripts/_site.mjs` | `PUBLIC_BASE` と `TARBALL_URL` |

**② ファイル名・ディレクトリ名**

| 前 | 後 |
|---|---|
| `packages/create-webtemplate/` | `packages/create-nasu-stack/` |
| `create-webtemplate.tgz` (+`.sha256`) | `create-nasu-stack.tgz` |
| `.vscode/webtemplate.code-snippets` | `.vscode/nasu-stack.code-snippets` |

**③ 生成物に焼き込まれる識別子**

| 場所 | 後 |
|---|---|
| `theme-provider.tsx` | `"nasu-stack.theme"` |
| `lib/action.ts` | `Symbol("nasu-stack.aborted")` |
| `apps/site/src/site.config.ts` | `"nasu-stack.site.theme"` |
| 生成物の `package.json` の印 | `nasuStack: { shadcn }` |

**④ 文書** — 56 ファイル

## 変えていないもの

| | なぜ |
|---|---|
| `@nasu` の名前空間 | **既に個人の名前。** 改名の目的に合っています |
| `registry/nasu/` | 上と同じ |
| `wt-` / `--wt-`（40 以上のクラス名・変数名） | プロジェクト名を名乗っていないので誤解を生みません。変えると配布物の全部品と CSS、検査のセレクタに及びます |
| `docs/plan-*.md` / `result-*.md` / `review-*.md` / `ROADMAP.md` | **当時の記録**です。当時の名前のままが正しい |

## npm の名前について

`create-nasu-stack` も `nasu-stack` も、**npm では空いています**（実際に確かめました）。
publish はしませんが、**空いているということは第三者が取れる**ということです。

`npx create-nasu-stack` と打つと他人のコードが動きます。
`scripts/check-forbidden.mjs` が、その文字列がコードに紛れ込んでいないか毎回見ています。
