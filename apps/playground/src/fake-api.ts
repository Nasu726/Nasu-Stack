/**
 * デモ用の偽 API。
 * 実際の利用では、この関数群をそのまま自分の fetch / SDK 呼び出しに
 * 差し替えるだけでコンポーネント側は一切変更不要です。
 */
import { ActionError } from "@/lib/action";
import type { FormValues } from "@/components/ui/async-form";

export interface Task {
  id: number;
  title: string;
  owner: string;
  done: boolean;
}

const TASKS: Task[] = [
  { id: 1, title: "ヒーローセクションの文言を確定する", owner: "me", done: true },
  { id: 2, title: "問い合わせフォームを API に接続", owner: "me", done: false },
  { id: 3, title: "OGP 画像の生成を自動化", owner: "collaborator", done: false },
  { id: 4, title: "Lighthouse のスコアを 95 以上にする", owner: "me", done: false },
];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** 必ず成功する保存。 */
export async function save(_: void, ctx: { signal: AbortSignal }) {
  await wait(900, ctx.signal);
  return { ok: true };
}

/** 必ず失敗する処理。エラー表示の確認用。 */
export async function alwaysFail(_: void, ctx: { signal: AbortSignal }) {
  await wait(700, ctx.signal);
  throw new ActionError("upstream 503", {
    displayMessage: "サーバーが混み合っています。少し待って再実行してください。",
    code: 503,
  });
}

/** 2 回失敗してから成功する処理。自動リトライの確認用。 */
let flakyCount = 0;
export async function flaky(_: void, ctx: { signal: AbortSignal }) {
  await wait(500, ctx.signal);
  flakyCount++;
  if (flakyCount % 3 !== 0) {
    throw new Error("一時的な通信エラー");
  }
  return { ok: true };
}

/** 時間のかかる処理。中断の確認用。 */
export async function slow(_: void, ctx: { signal: AbortSignal }) {
  await wait(6000, ctx.signal);
  return { ok: true };
}

/** タスク一覧の取得。 */
export async function listTasks(_: void, ctx: { signal: AbortSignal }) {
  await wait(1100, ctx.signal);
  return TASKS;
}

/** 空の一覧。空状態の確認用。 */
export async function listEmpty(_: void, ctx: { signal: AbortSignal }) {
  await wait(700, ctx.signal);
  return [] as Task[];
}

/** 取得に失敗する一覧。エラー＋再試行の確認用。 */
export async function listBroken(
  _: void,
  ctx: { signal: AbortSignal },
): Promise<Task[]> {
  await wait(700, ctx.signal);
  throw new ActionError("network", {
    displayMessage: "一覧の取得に失敗しました",
  });
}

/** サインアップ。バリデーションエラーをフィールド単位で返します。 */
export async function signup(
  values: FormValues,
  ctx: { signal: AbortSignal },
) {
  await wait(900, ctx.signal);

  const fields: Record<string, string> = {};
  const email = String(values.email ?? "");
  const password = String(values.password ?? "");
  const name = String(values.name ?? "");

  if (!name.trim()) fields.name = "お名前を入力してください";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fields.email = "メールアドレスの形式が正しくありません";
  if (password.length < 8)
    fields.password = "パスワードは 8 文字以上にしてください";
  if (email.endsWith("@example.com"))
    fields.email = "このドメインは登録できません";

  if (Object.keys(fields).length > 0) {
    throw new ActionError("validation failed", {
      displayMessage: "入力内容を確認してください",
      fields,
    });
  }

  return { id: 42, email };
}
