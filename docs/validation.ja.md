# Validation 結果契約

[English](validation.md)

Nasu Stack は schema library を選んだり内製したりしません。validator と
`AsyncForm`、HTTP response をつなぐ小さい結果の形だけを揃えます。何を正しい入力と
するかは、引き続きアプリの責任です。

## API を選ぶ前に、置く層を選ぶ

| 必要なこと | 置く場所 |
|---|---|
| 入力不足をその場で伝える | browser validator / native field 属性 |
| 送信値を parse・trim・coerce する | 変換済み `data` を返す `Validator` |
| 信頼できない入力を受理するか決める | server-side validator。必ず server で実行 |
| 権限・一意性・在庫・transaction を確かめる | server application / database |
| domain schema を記述する | Zod・Valibot 等、アプリが選ぶ schema library |

browser validation は feedback です。呼び出す側は迂回でき、JavaScript を変えたり
HTTP request を直接送ったりできます。1つの validator を client / server で共有すれば
重複は減らせますが、client が正規の判定場所になるわけではありません。

## 契約

```ts
type ValidationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      fields?: Record<string, string | readonly string[]>;
      message?: string;
    };

type Validator<T, Input = unknown> = (
  input: Input,
) => ValidationResult<T> | Promise<ValidationResult<T>>;
```

- `data` は parse・変換後に action へ渡す値です。
- field の key は control の `name` と一致させます。`members.0.email` のような
  nested name も書き換えません。
- `message` は field に属さない、利用者へ表示してよい文言です。
- 1 field に複数文言があれば、UI adapter は先頭の空でない1件を表示します。
  後続規則まで一度に並べるより、次に直す1件を示す方が行動しやすいためです。
- failure には1件以上の有効な field 文言か form message が必要です。
  `runValidation` は public contract を実行時にも検査し、JavaScript や adapter が
  壊れた結果を返したら fail closed にします。

## `AsyncForm` で使う

```tsx
import { AsyncForm, Field, type FormValues } from "@/components/ui/async-form";
import type { Validator } from "@/lib/validation";

interface Profile {
  email: string;
  age: number;
}

const validateProfile: Validator<Profile, FormValues> = (values) => {
  const email = String(values.email ?? "").trim().toLowerCase();
  const age = Number(values.age);
  const fields: Record<string, string[]> = {};

  if (!email.includes("@")) fields.email = ["メールアドレスを確認してください"];
  if (!Number.isInteger(age) || age < 18) fields.age = ["18歳以上を入力してください"];

  return Object.keys(fields).length
    ? { ok: false, message: "入力内容を確認してください", fields }
    : { ok: true, data: { email, age } };
};

<AsyncForm
  validate={validateProfile}
  action={(profile) => api.saveProfile(profile)}
>
  <Field name="email" label="メールアドレス" />
  <Field name="age" label="年齢" type="number" />
</AsyncForm>;
```

validation failure なら action は呼びません。`AsyncForm` は既存の field context から
error を表示し、DOM順で最初の invalid control へfocusを移します。そのcontrolには
`aria-invalid` が付き、`aria-describedby` からerrorを辿れます。fields があるときは、
同じform messageを別のerror blockとして重ねません。既知のvalidation failure
（`VALIDATION`またはHTTP 422）は、共有のaction既定でretryが有効でもterminalです。
入力を直さず繰り返しても、待ち時間が増えるだけだからです。
actionには変換済みdataを渡します。lifecycle callbackの第2引数は元の`FormValues`を
保つため、error handlerは送信されたcontrolを確認できます。

`FormValues`はbrowserから来る同名fieldのrawな形を保ちます。`CheckboxGroup`は
0件なら`""`、1件なら`string`、2件以上なら`string[]`です。validator内でこの
`"" | string | string[]`境界をdomain上の配列へ正規化してください。

form messageを抑止するのは、返されたfield名のすべてが、errorを表示できるfield
componentとして登録されている場合だけです。既知fieldとserver専用・誤記fieldが
混ざる場合、既知errorはcontrolの隣へ出し、残りの失敗が消えないようform messageも
残します。`FieldArray`はroot name自身を表示先として登録します。

後からserverが返したerrorも同じfield表示へ戻ります。新しいsubmitを始めると前のclient
結果を置き換えるので、client / serverのerrorが2つの正解として積み上がりません。

## 正規の判定は server でも実行する

秘密や server-only dependency を含まない validator なら、同じものを両方の境界で
使えます。それでも server は独立して必ず呼びます。

```ts
import {
  runValidation,
  validationFailureResponse,
} from "@/lib/validation";
import { validateProfile } from "./validate-profile";

export async function handle(request: Request): Promise<Response> {
  const result = await runValidation(validateProfile, await request.json());
  if (!result.ok) {
    return validationFailureResponse(result); // 既定は 422 JSON
  }

  // 認証・認可・一意性・書き込みは server の仕事です。
  const saved = await saveAuthorizedProfile(result.data);
  return Response.json({ ok: true, id: saved.id });
}
```

`validationFailureResponse` は backend framework ではなく、Web-standard `Response`
adapter です。`jsonRequest`・`createSubmit`・`AsyncForm` が既に理解するpayloadを返します。
内部用 `message` と、明示的に利用者へ出す `userMessage` を分け、渡したheadersを保ち、
既定を422とし、failureを2xxにする指定は拒否します。payloadには機械判定用の
`VALIDATION` codeも入るため、別の4xxを選んでも、入力修正が必要なfailureを`useAction`が
自動retryしません。正規化済みfield errorも同じ理由でterminalです。

## schema library の adapter 例

adapter は、アプリ内のschemaの隣に置きます。

```ts
import { z } from "zod";
import type { Validator } from "@/lib/validation";

const schema = z.object({ email: z.string().email(), age: z.coerce.number().int().min(18) });
type Profile = z.infer<typeof schema>;

export const validateProfile: Validator<Profile> = (input) => {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const name = issue.path.join(".");
    if (name) (fields[name] ??= []).push(issue.message);
  }
  return { ok: false, message: "入力内容を確認してください", fields };
};
```

Nasu Stack が引き受けるのは配線と、配るfield内部のaccessibilityです。schema・翻訳・
認証・CSRF対策・rate limit・database constraint・response schemaは引き受けません。
