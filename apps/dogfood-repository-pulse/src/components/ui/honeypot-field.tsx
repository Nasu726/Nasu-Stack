"use client";

import * as React from "react";
import { HONEYPOT_NAME } from "@/lib/submit";

/**
 * HoneypotField — bot 用のおとりの欄
 * ================================================================
 * ```tsx
 * <AsyncForm action={submit}>
 *   <Field name="name" label="お名前" />
 *   <HoneypotField />
 * </AsyncForm>
 * ```
 *
 * 公開されたフォームは、数日で自動入力の bot に見つかります。
 * ここに入れるのは、**人には見えないが bot は埋めてしまう欄**です。
 * 値が入っていたら、`createSubmit` が送信せずに成功を装います。
 *
 * ----------------------------------------------------------------
 * `display: none` では駄目です
 * ----------------------------------------------------------------
 * 有名な手なので、まともな bot は `display:none` と `visibility:hidden` を
 * 見て避けます。かといって普通に置くと、**人にも見えてしまいます。**
 *
 * 満たすべき条件は 3 つあります。
 *
 *   1. 目に見えない（画面の外へ出す。消さない）
 *   2. キーボードで到達できない（`tabIndex={-1}`）
 *   3. 読み上げが読まない（`aria-hidden`）
 *
 * 2 と 3 を忘れると、**目の見えない利用者や、Tab で操作する人だけが
 * この欄に入力してしまい、送信できなくなります。**
 * おとりで本物の利用者を弾いては本末転倒です。
 *
 * 自動入力（ブラウザのパスワード管理など）に拾わせないため、
 * `autoComplete="off"` と、住所らしくない名前も付けています。
 */
export function HoneypotField({
  name = HONEYPOT_NAME,
  label = "この欄は入力しないでください",
}: {
  name?: string;
  label?: string;
}) {
  const id = React.useId();
  return (
    <div
      // 画面の外へ出します。display:none や visibility:hidden は使いません。
      style={{
        position: "absolute",
        left: "-9999px",
        top: "auto",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="text"
        // キーボードで辿り着かせない
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
