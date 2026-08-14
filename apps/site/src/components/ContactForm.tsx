import { AsyncForm, Field } from "@/components/ui/async-form";
import { ActionError } from "@/lib/action";

/**
 * Astro の island として読み込むラッパ。
 *
 * 重要: .astro から client:load のコンポーネントへ「関数」は渡せません
 * （props が JSON 化されるため）。独自ロジックを持たせたい島は、
 * このように .tsx 側で action を定義してから <ContactForm client:load /> します。
 *
 * 逆に、ただ API を叩くだけなら .astro から
 *   <AsyncForm client:load action={{ url: "/api/contact" }} />
 * と宣言で書けます（ActionSpec）。
 */
export function ContactForm() {
  return (
    <AsyncForm
      action={async (values, ctx) => {
        await new Promise((r) => setTimeout(r, 900));
        if (ctx.signal.aborted) return null;

        const fields: Record<string, string> = {};
        if (!String(values.message ?? "").trim())
          fields.message = "本文を入力してください";
        if (!String(values.name ?? "").trim())
          fields.name = "お名前を入力してください";

        if (Object.keys(fields).length) {
          throw new ActionError("validation", {
            displayMessage: "入力内容を確認してください",
            fields,
          });
        }
        return { ok: true };
      }}
      submitLabel="送信する"
      successMessage="お問い合わせを受け付けました"
    >
      <Field name="name" label="お名前" required />
      <Field name="email" label="メールアドレス" type="email" required />
      <Field name="message" label="本文" multiline rows={5} />
    </AsyncForm>
  );
}
