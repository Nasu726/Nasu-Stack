/** tabs.mjs の型。中身の唯一の情報源は tabs.mjs のほうです。 */
export interface TabDef {
  key: string;
  label: string;
}
export declare const TABS: TabDef[];
export declare const TAB_KEYS: string[];
export declare const DEFAULT_TAB: string;
export declare function normalizeTab(value: string | null | undefined): string;
