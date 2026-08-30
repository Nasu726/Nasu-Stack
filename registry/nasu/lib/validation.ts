/**
 * Nasu Stack — validation の結果契約
 * ================================================================
 *
 * これは schema validator ではありません。Zod / Valibot / 手書き関数などが
 * **判定した後の結果を、client と server で同じ形にする**ための小さい契約です。
 *
 * ブラウザ側の判定は入力した人への早い feedback にすぎません。認証・認可・
 * domain rule を含む正規の判定は、同じ validator を使う場合でも server 側で
 * 必ずもう一度行ってください。
 */

/** 1 field に返せる文言。複数ある場合、UI adapter は先頭の有効な文言を出します。 */
export type ValidationFieldMessage = string | readonly string[];

/** `members.0.email` のような nested path も通常の key として扱います。 */
export type ValidationFieldErrors = Readonly<
  Record<string, ValidationFieldMessage>
>;

export interface ValidationSuccess<TData> {
  ok: true;
  /** parse / trim / coercion 後の値。元の input と同じ型でなくても構いません。 */
  data: TData;
}

export interface ValidationFailure {
  ok: false;
  /** 入力欄の `name` と一致する key。 */
  fields?: ValidationFieldErrors;
  /** field に属さない、利用者へ表示してよい文言。 */
  message?: string;
}

export type ValidationResult<TData> =
  | ValidationSuccess<TData>
  | ValidationFailure;

/**
 * library 非依存の validator。同期でも非同期でも同じ契約です。
 *
 * ```ts
 * const validateProfile: Validator<ProfileInput> = (input) => {
 *   if (!isObject(input)) return { ok: false, message: "入力を確認してください" };
 *   // domain に必要な検査と変換はアプリ側で行う
 *   return { ok: true, data: { email: String(input.email).trim() } };
 * };
 * ```
 */
export type Validator<TData, TInput = unknown> = (
  input: TInput,
) => ValidationResult<TData> | Promise<ValidationResult<TData>>;

export interface NormalizedValidationFailure {
  message?: string;
  /** AsyncForm / transport が 1 field に 1 文言として扱える形。 */
  fields?: Record<string, string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function usefulMessage(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * field error を 1 field = 1 文言へ揃えます。
 * 配列は先頭の空でない文言を使い、UI に同じ誤りを何行も重ねません。
 */
export function normalizeValidationFields(
  fields: ValidationFieldErrors | undefined,
): Record<string, string> | undefined {
  if (fields === undefined) return undefined;
  if (!isPlainObject(fields)) {
    throw new TypeError("validation fields は plain object にしてください");
  }

  // `__proto__` 等も通常のfield nameとして保持し、prototypeを書き換えません。
  const out: Record<string, string> = Object.create(null);
  for (const [name, raw] of Object.entries(fields)) {
    if (!usefulMessage(name)) {
      throw new TypeError("validation field の name は空にできません");
    }
    if (typeof raw === "string") {
      if (!usefulMessage(raw)) {
        throw new TypeError(`validation field ${name} の文言は空にできません`);
      }
      out[name] = raw;
      continue;
    }
    if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
      throw new TypeError(
        `validation field ${name} は string または string[] にしてください`,
      );
    }
    const first = raw.find(usefulMessage);
    if (!first) {
      throw new TypeError(`validation field ${name} に空でない文言が必要です`);
    }
    out[name] = first;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * validator が public contract どおりの値を返したかを実行時にも確かめます。
 * TypeScript の型だけでは、JavaScript・外部 adapter・`as` を越えられません。
 */
export async function runValidation<TData, TInput>(
  validator: Validator<TData, TInput>,
  input: TInput,
): Promise<ValidationResult<TData>> {
  const result = await validator(input);
  if (!isPlainObject(result) || typeof result.ok !== "boolean") {
    throw new TypeError(
      "validator は { ok: true, data } または { ok: false, fields/message } を返してください",
    );
  }

  if (result.ok) {
    if (!Object.prototype.hasOwnProperty.call(result, "data")) {
      throw new TypeError("validation success には data が必要です");
    }
    return result as unknown as ValidationSuccess<TData>;
  }

  const failure = result as unknown as ValidationFailure;
  const normalized = normalizeValidationFailure(failure);
  if (!normalized.message && !normalized.fields) {
    throw new TypeError(
      "validation failure には message または 1 件以上の fields が必要です",
    );
  }
  return failure;
}

/** UI と transport が同じ優先順位で failure を扱うための正規化。 */
export function normalizeValidationFailure(
  failure: ValidationFailure,
): NormalizedValidationFailure {
  if (!isPlainObject(failure) || failure.ok !== false) {
    throw new TypeError("validation failure は { ok: false, ... } にしてください");
  }
  if (
    failure.message !== undefined &&
    (typeof failure.message !== "string" || !usefulMessage(failure.message))
  ) {
    throw new TypeError("validation message は空でない string にしてください");
  }

  return {
    message: failure.message,
    fields: normalizeValidationFields(failure.fields),
  };
}

/**
 * AsyncForm / `jsonRequest` が理解する transport payload へ変換します。
 * `message` は内部用の固定値、利用者向け文言は明示的な `userMessage` に分け、
 * server の技術的な message を不用意に画面へ出さない既存契約を保ちます。
 */
export function validationFailurePayload(failure: ValidationFailure): {
  message: "validation failed";
  code: "VALIDATION";
  userMessage?: string;
  fields?: Record<string, string>;
} {
  const normalized = normalizeValidationFailure(failure);
  if (!normalized.message && !normalized.fields) {
    throw new TypeError(
      "validation failure には message または 1 件以上の fields が必要です",
    );
  }
  return {
    message: "validation failed",
    code: "VALIDATION",
    userMessage: normalized.message,
    fields: normalized.fields,
  };
}

/**
 * Web-standard `Response` を使う server adapter。framework には依存しません。
 * 失敗を 2xx にして client が成功扱いしないよう、status は 4xx / 5xx だけです。
 */
export function validationFailureResponse(
  failure: ValidationFailure,
  init: ResponseInit = {},
): Response {
  const status = init.status ?? 422;
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new RangeError("validation failure response の status は 400〜599 にしてください");
  }
  const headers = new Headers(init.headers);
  // bodyは必ずJSONです。呼び出し側の取り違えでtext/plainを名乗ると、
  // jsonRequestが意図どおりfail closedにしてfield errorへ戻せません。
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(validationFailurePayload(failure)), {
    ...init,
    status,
    headers,
  });
}
