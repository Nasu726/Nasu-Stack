/**
 * Public AsyncForm overloadsのcompile-time回帰検査。
 * catalogからimportしないのでbundleには入らず、`tsc --noEmit`だけが読みます。
 */
import { AsyncForm, type FormValues } from "@/components/ui/async-form";
import type { Validator } from "@/lib/validation";

interface ParsedProfile {
  email: string;
  age: number;
}

const parseProfile: Validator<ParsedProfile, FormValues> = (values) => ({
  ok: true,
  data: {
    email: String(values.email ?? "").trim(),
    age: Number(values.age),
  },
});

export function ValidationTypeContract() {
  return (
    <>
      <AsyncForm
        validate={parseProfile}
        action={(profile) => profile.age.toFixed(0)}
      />

      {/* 変換後の型をactionへ要求するなら、validateを省略できません。 */}
      {/* @ts-expect-error ParsedProfile action requires a matching validator */}
      <AsyncForm action={(profile: ParsedProfile) => profile.age.toFixed(0)} />
    </>
  );
}
