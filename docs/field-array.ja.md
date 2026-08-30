# FieldArray

[English](field-array.md)

`FieldArray` は、繰り返し入力について browser 側で毎回必要になる仕組みを
引き受けます。対象は stable な UI key、index 付き name、min/max の button、
追加・削除後の focus です。その配列が product にとって正しいかは決めません。

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/field-array
```

## まず component を使う

```tsx
import { AsyncForm, Field } from "@/components/ui/async-form";
import { FieldArray } from "@/components/ui/field-array";

type MemberDraft = { email: string };

<AsyncForm validate={validateMembers} action={saveMembers}>
  <FieldArray<MemberDraft>
    name="members"
    label="メンバー"
    hint="1〜5 人を追加できます。"
    min={1}
    max={5}
    defaultItems={[{ email: "" }]}
    createItem={() => ({ email: "" })}
    addLabel="メンバーを追加"
    removeLabel={({ index }) => `メンバー ${index + 1} を削除`}
    emptyMessage="メンバーはまだいません。"
  >
    {({ name, index, defaultValue }) => (
      <Field
        name={`${name}.email`}
        label={`メンバー ${index + 1} のメール`}
        type="email"
        defaultValue={defaultValue.email}
      />
    )}
  </FieldArray>
</AsyncForm>;
```

render prop の各 item には 4 つの値があります。

| 値 | 意味 |
|---|---|
| `key` | 他の行を消しても変わらない、UI 内だけの識別 |
| `index` | 現在位置。削除後は隙間を詰める |
| `name` | `members.0` のような現在の根 |
| `defaultValue` | その行の uncontrolled control を初期化する値 |

`item.key` は UI の識別にだけ使います。database ID ではなく、送信されず、page の
reload を越えて安定するものでもありません。server が本物の ID を必要とするなら、
hidden control など別の field に入れます。

`defaultItems` は意図的に uncontrolled です。`AsyncForm` が成功後に行うものを含む
native form reset では、この行へ戻ります。後から prop を変えることを data 同期の
仕組みにはせず、後から来た値をstateへcopyしたり`max`に対して再検査したりもしません。
初期値はmount時に検査します。dynamicな`min`はreset後を含め、不足行を補います。

## nested validation path

browser は `members.0.email` のような平らな `FormData` name を送ります。validator が
それを配列へ変換し、field error には同じ path を返します。

```ts
const validateMembers: Validator<{ members: MemberDraft[] }, FormValues> =
  (values) => {
    const email = String(values["members.0.email"] ?? "").trim();
    if (!email.includes("@")) {
      return {
        ok: false,
        fields: { "members.0.email": "メールアドレスを入力してください" },
      };
    }
    return { ok: true, data: { members: [{ email }] } };
  };
```

`AsyncForm` は、その正確な path を子の `Field`、ARIA description、最初の error への
focus に接続します。行を追加・削除すると、古い index は同じ control を指さなくなる
ため、`members.*` 以下の error を消します。次の submit で正しい path を計算し直します。

これはあくまで browser feedback です。server は配列を独立して組み立て、検査します。
`min`、`max`、email 形式、一意性、認可、database constraint は browser の security
boundary ではありません。

## focus と accessible name

- 追加後は、新しい行で最初の有効な hidden ではない control へ focus する
- 削除後は、次の行、前の行、追加 button の順で focus する
- `max` では追加を、`min` ではすべての削除を disabled にする
- `label` は collection の native `legend` になる
- 繰り返す control の label と `removeLabel` には、何行目かを含める
- polite status で追加・削除 label を伝え、主な現在地は focus で伝える

`min={0}` で 0 行になったときは `emptyMessage` を表示します。飾りの空箱ではなく、
利用者が次に何をできるか分かる案内を渡してください。

## 契約を捨てずに 1 段下へ降りる

reorder は意図的に含めません。drag and drop には別の keyboard 操作、announcement、
collision の契約が必要です。ここへ入れると小さな form primitive ではなく sortable
list system になります。

組み込みの行と button が合わない場合は、自分で配列 state を持ち、export される helper
だけを使えます。

```tsx
import { fieldArrayItemName } from "@/components/ui/field-array";

rows.map((row, index) => (
  <Field
    key={row.id}
    name={`${fieldArrayItemName("members", index)}.email`}
    label={`メンバー ${index + 1} のメール`}
  />
));
```

この層では stable key、add/remove/reorder、focus、reset は app が所有します。
validation result contract と `AsyncForm` の field error 配線はそのまま使えます。
