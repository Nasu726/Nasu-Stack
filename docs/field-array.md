# FieldArray

[日本語](field-array.ja.md)

`FieldArray` takes responsibility for the browser mechanics of repeated form
controls: stable UI keys, indexed names, min/max buttons, and focus after an add
or removal. It does not decide whether the array is valid for your product.

```bash
npx shadcn@4.17.0 add Nasu726/Nasu-Stack/field-array
```

## Start with the component

```tsx
import { AsyncForm, Field } from "@/components/ui/async-form";
import { FieldArray } from "@/components/ui/field-array";

type MemberDraft = { email: string };

<AsyncForm validate={validateMembers} action={saveMembers}>
  <FieldArray<MemberDraft>
    name="members"
    label="Members"
    hint="Add one to five people."
    min={1}
    max={5}
    defaultItems={[{ email: "" }]}
    createItem={() => ({ email: "" })}
    addLabel="Add member"
    removeLabel={({ index }) => `Remove member ${index + 1}`}
    emptyMessage="No members yet."
  >
    {({ name, index, defaultValue }) => (
      <Field
        name={`${name}.email`}
        label={`Member ${index + 1} email`}
        type="email"
        defaultValue={defaultValue.email}
      />
    )}
  </FieldArray>
</AsyncForm>;
```

Each render-prop item has four values:

| Value | Meaning |
|---|---|
| `key` | UI-only identity that remains stable when another row is removed |
| `index` | Current position; it is compacted after a removal |
| `name` | Current root such as `members.0` |
| `defaultValue` | The value used to initialize uncontrolled controls in that row |

Use `item.key` only as UI identity. It is not a database ID, is not submitted,
and is not stable across a page reload. Put your real ID in a hidden control or
another field when the server needs one.

`defaultItems` is intentionally uncontrolled. A native form reset, including
the reset performed by `AsyncForm` after success, restores those rows. Changing
the prop later is not a data synchronization mechanism; later values are not
copied into state or revalidated against `max`. The initial value is checked at
mount. Dynamic `min` still fills missing rows, including after a reset.

## Nested validation paths

The browser sends flat `FormData` names such as `members.0.email`. Your validator
decides how to turn those values into an array and returns the same path for a
field error:

```ts
const validateMembers: Validator<{ members: MemberDraft[] }, FormValues> =
  (values) => {
    const email = String(values["members.0.email"] ?? "").trim();
    if (!email.includes("@")) {
      return {
        ok: false,
        fields: { "members.0.email": "Enter an email address" },
      };
    }
    return { ok: true, data: { members: [{ email }] } };
  };
```

`AsyncForm` connects that exact path to the child `Field`, its ARIA description,
and first-error focus. Adding or removing a row clears errors below `members.*`
because their old indexes no longer identify the same controls. The next submit
calculates authoritative paths again.

This is still browser feedback. The server must rebuild and validate the array
independently; `min`, `max`, email format, uniqueness, authorization, and database
constraints are not security boundaries in the browser.

## Focus and accessible names

- Add focuses the first enabled, non-hidden control in the new row.
- Remove focuses the next row, then the previous row, then the Add button.
- Add is disabled at `max`; all Remove buttons are disabled at `min`.
- `label` becomes the collection's native `legend`.
- Give repeated controls indexed labels, and make `removeLabel` identify the row.
- A polite status reports the add/remove label; focus provides the primary context.

`emptyMessage` is shown when `min={0}` and no rows remain. Supply real guidance,
not an empty decorative box.

## Step down without replacing the contract

Reordering is deliberately absent. Drag-and-drop requires a separate keyboard,
announcement, and collision contract; adding it here would turn a small form
primitive into a sortable-list system.

When the built-in row and buttons are not the right shape, keep your own array
state and use the exported helper:

```tsx
import { fieldArrayItemName } from "@/components/ui/field-array";

rows.map((row, index) => (
  <Field
    key={row.id}
    name={`${fieldArrayItemName("members", index)}.email`}
    label={`Member ${index + 1} email`}
  />
));
```

At that level your app owns stable keys, add/remove/reorder, focus, and reset.
The validation result contract and `AsyncForm` field-error wiring remain usable.
