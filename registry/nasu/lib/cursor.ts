import type { Action } from "@/lib/action";

/** cursorで1回取得した結果。nextCursorが無い、またはnullなら末尾です。 */
export interface CursorPage<TItem, TCursor> {
  items: TItem[];
  nextCursor?: TCursor | null;
}

/** 最初はundefined、2回目以降は直前のnextCursorを受け取るloaderです。 */
export type CursorLoader<TItem, TCursor> = Action<
  TCursor | undefined,
  CursorPage<TItem, TCursor>
>;

