# Validation result contract

[日本語](validation.ja.md)

Nasu Stack does not choose or implement a schema library. It standardizes the
small result shape that connects a validator to `AsyncForm` and to an HTTP
response. Your application still owns every validation rule.

## Choose the layer before choosing the API

| Need | Put it here |
|---|---|
| Tell someone immediately that a field is incomplete | Browser validator / native field attributes |
| Parse, trim, or coerce submitted values | A `Validator` returning transformed `data` |
| Decide whether untrusted input is accepted | Server-side validator, always run on the server |
| Check permissions, uniqueness, inventory, or a transaction | Server application / database |
| Describe a domain schema | Zod, Valibot, or another application-owned schema library |

Browser validation is feedback. A caller can skip it, alter JavaScript, or send
an HTTP request directly. Sharing one validator between client and server can
remove duplication, but it never makes the client authoritative.

## The contract

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

- `data` is the parsed or transformed value passed to the action.
- A field key must match the control's `name`. Nested names such as
  `members.0.email` remain unchanged.
- `message` is a form-level, user-facing message.
- If a field has several messages, the UI adapter shows the first non-empty
  one. Showing every downstream rule at once is usually harder to act on.
- A failure must contain at least one usable field message or a form message.
  `runValidation` checks the public contract at runtime and fails closed when a
  JavaScript or adapter implementation returns a malformed result.

## Use it with `AsyncForm`

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

  if (!email.includes("@")) fields.email = ["Enter a valid email address"];
  if (!Number.isInteger(age) || age < 18) fields.age = ["Enter an age of 18 or over"];

  return Object.keys(fields).length
    ? { ok: false, message: "Check the entered values", fields }
    : { ok: true, data: { email, age } };
};

<AsyncForm
  validate={validateProfile}
  action={(profile) => api.saveProfile(profile)}
>
  <Field name="email" label="Email" />
  <Field name="age" label="Age" type="number" />
</AsyncForm>;
```

When validation fails, the action is not called. `AsyncForm` renders field
errors through the existing field context and moves focus to the first invalid
control in DOM order. That control receives `aria-invalid`, and its
`aria-describedby` points to the error. When fields are present, the same form
message is not rendered again as a second error block. A known validation
failure (`VALIDATION` or HTTP 422) is terminal even when a shared action default
enables retries; repeating the same unchanged input would only add delay.
The action receives transformed data; lifecycle callbacks keep the original
`FormValues` as their second argument so an error handler can inspect the
submitted controls.

An error returned later by the server uses the same field display. Starting a
new submission replaces the previous client result, so client and server errors
do not accumulate as two competing sources of truth.

## Run the authoritative check on the server

The same validator may be used at both boundaries if it contains no secret or
server-only dependency. The server must still call it independently:

```ts
import {
  runValidation,
  validationFailureResponse,
} from "@/lib/validation";
import { validateProfile } from "./validate-profile";

export async function handle(request: Request): Promise<Response> {
  const result = await runValidation(validateProfile, await request.json());
  if (!result.ok) {
    return validationFailureResponse(result); // 422 JSON by default
  }

  // Authentication, authorization, uniqueness, and the write are server work.
  const saved = await saveAuthorizedProfile(result.data);
  return Response.json({ ok: true, id: saved.id });
}
```

`validationFailureResponse` is a Web-standard `Response` adapter rather than a
backend framework. It returns the payload already understood by `jsonRequest`,
`createSubmit`, and `AsyncForm`. It keeps an internal `message` separate from an
explicit user-facing `userMessage`, preserves supplied headers, defaults to
422, and rejects a 2xx status for a failure.

## Adapter example for a schema library

The adapter belongs next to the schema in your application:

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
  return { ok: false, message: "Check the entered values", fields };
};
```

Nasu Stack owns the wiring and the accessibility behavior of its shipped
fields. It does not own the schema, translations, authorization, CSRF
protection, rate limits, database constraints, or response schemas.
