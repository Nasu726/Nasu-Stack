import { AsyncForm, Field } from "@/components/ui/async-form";
import { HoneypotField } from "@/components/ui/honeypot-field";
import { createSubmit } from "@/lib/submit";

/**
 * Astro の island として読み込むラッパ。
 *
 * 重要: .astro から client:load のコンポーネントへ「関数」は渡せません
 * （props が JSON 化されるため）。独自ロジックを持たせたい島は、
 * このように .tsx 側で action を定義してから <ContactForm client:load /> します。
 *
 * ----------------------------------------------------------------
 * 送信先の決め方
 * ----------------------------------------------------------------
 * 送信先は環境変数で外に出します。**コードに書き込みません。**
 * 本番と開発で違う先に送るのが普通で、書き込むと必ずどちらかで事故ります。
 *
 *   PUBLIC_CONTACT_ENDPOINT=https://api.example.com/contact
 *
 * Astro では `PUBLIC_` で始まる変数だけがブラウザ側へ渡ります。
 * ここはブラウザから叩く URL なので、それで正しい形です
 * （秘密の鍵は絶対にここへ置かないでください。誰でも読めます）。
 *
 * 設定されていないときは、送らずに成功したふりをします。
 * 開発中に「まだ受け口が無い」だけで画面が壊れないようにするためです。
 */
const ENDPOINT = import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined;

const send = ENDPOINT
  ? createSubmit({ url: ENDPOINT })
  : async (values: unknown) => {
      // 受け口が未設定のときの受け皿。中身はコンソールへ。
      // eslint-disable-next-line no-console
      console.info("[ContactForm] PUBLIC_CONTACT_ENDPOINT is not set", values);
      await new Promise((r) => setTimeout(r, 600));
      return { ok: true, mocked: true };
    };

export function ContactForm() {
  return (
    <>
      <AsyncForm
        action={send}
        submitLabel="Send"
        successMessage="Thanks — we have your message"
      >
        <Field name="name" label="Name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="message" label="Message" multiline rows={5} />
        {/* 人には見えず、キーボードでも読み上げでも到達しない、bot 用のおとり */}
        <HoneypotField />
      </AsyncForm>

      {/* 送信先が未設定のときだけ出します。**配線したら自動で消えます。**
          「押したらどこかへ送られるのでは」と思わせないためのものなので、
          本当に送られるようになったら出てはいけません。 */}
      {!ENDPOINT && (
        <p className="mt-xs text-xs text-muted-fg">
          This sample has no endpoint configured. Pressing Send does not send anything.
        </p>
      )}
    </>
  );
}
