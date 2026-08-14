"use client";

import * as React from "react";
import type { ActionError } from "@/lib/action";

/**
 * アプリ全体の既定の振る舞い。
 *
 * useAction / ActionButton / AsyncForm は、個別に onError を書かなかった場合
 * ここに設定されたものを使います。つまり「毎回エラー処理を書く」必要が無くなります。
 *
 * Provider を置かなくても全部そのまま動きます（既定は空）。
 * あくまで「書かなかったときの受け皿」です。
 */
export interface ActionDefaults {
  /** 個別に onError を指定しなかったアクションが失敗したとき。 */
  onError?: (error: ActionError) => void;
  /** 個別に onSuccess を指定しなかったアクションが成功したとき。 */
  onSuccess?: (data: unknown) => void;
  /** 既定のリトライ回数。 */
  retry?: number;
  /** 成功表示を何 ms 後に idle へ戻すか。 */
  resetAfter?: number;
}

export const ActionDefaultsContext = React.createContext<ActionDefaults>({});

/** 現在の既定値を読みます。Provider が無ければ空オブジェクトです。 */
export function useActionDefaults(): ActionDefaults {
  return React.useContext(ActionDefaultsContext);
}
