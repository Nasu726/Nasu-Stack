import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * WebTemplate — レイアウト・プリミティブ
 * ================================================================
 * 原則は 1 つだけです。
 *
 *   **コンポーネントは自分の周囲に余白を持たない。**
 *   **余白は、ここにあるレイアウト部品だけが所有する。**
 *
 * これで部品をどこに置いても余白が二重にならず、
 * 「なぜかここだけ隙間が広い」が起きません。
 *
 * ----------------------------------------------------------------
 * 余白の決め方 — 既定は 9 段階。でも壁ではありません
 * ----------------------------------------------------------------
 * 段階から選ぶのが既定の道です。入力補完に出るのもこれだけなので、
 * 迷わずに済みます。
 *
 *   none  2xs   xs   sm   md   lg   xl   2xl   3xl
 *    0     4    8    12   16   24   40   64    96   (px / neutral テーマ)
 *
 * ただし段階に無い値が必要なら、そのまま書けます。
 * Tailwind の `p-4` と `p-[13px]` の関係と同じです。
 *
 *   <Stack space="lg" />        段階から選ぶ（推奨・補完が効く）
 *   <Stack space="13px" />      任意の値
 *   <Stack space="clamp(1rem, 4vw, 3rem)" />   計算式も可
 *
 * 「選択肢を減らして迷わせない」と「必要なら踏み外せる」を両立させるため、
 * 段階は**既定値であって制約ではない**という位置づけにしています。
 *
 * 段階の実寸はテーマごとに変わります（warm は広め、editorial は詰めぎみ）。
 * つまり余白の広さもトンマナの一部です。
 */

/* ================================================================
 * 型
 * ============================================================== */

/** 推奨の 9 段階。入力補完にはこれが出ます。 */
export type SpaceToken =
  | "none"
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl";

/**
 * 余白の値。段階名でも、任意の CSS 長さでも構いません。
 * `(string & {})` は、補完に段階名を出しつつ任意の文字列も受けるための書き方です。
 */
export type Space = SpaceToken | (string & {});

/** 画面幅ごとに値を変えたいとき。`space={{ mobile: "sm", tablet: "xl" }}` */
export type Responsive<T> = T | { mobile?: T; tablet?: T; desktop?: T };

export type Breakpoint = "tablet" | "desktop";

const SPACE_TOKENS = new Set<string>([
  "none",
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
]);

function resolve<T>(
  value: Responsive<T> | undefined,
): { mobile?: T; tablet?: T; desktop?: T } {
  if (value === undefined) return {};
  if (typeof value === "object" && value !== null) {
    return value as { mobile?: T; tablet?: T; desktop?: T };
  }
  return { mobile: value as T };
}

/** 段階名ならトークンの変数へ、そうでなければ書かれた値をそのまま使う。 */
function spaceValue(v: Space): string {
  return SPACE_TOKENS.has(v as string) ? `var(--space-${v})` : (v as string);
}

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

/**
 * 余白系の props を CSS 変数へ変換します。
 * 段階でも任意の値でも、画面幅ごとの指定でも、全部ここを通ります。
 */
function spaceVars(
  name: "gap" | "p" | "px" | "py",
  value: Responsive<Space> | undefined,
): CSSVars {
  const r = resolve(value);
  const out = {} as CSSVars;
  if (r.mobile !== undefined) out[`--wt-${name}`] = spaceValue(r.mobile);
  if (r.tablet !== undefined) out[`--wt-${name}-t`] = spaceValue(r.tablet);
  if (r.desktop !== undefined) out[`--wt-${name}-d`] = spaceValue(r.desktop);
  return out;
}

function merge(...objs: (CSSVars | React.CSSProperties | undefined)[]) {
  return Object.assign({}, ...objs.filter(Boolean)) as React.CSSProperties;
}

/* ================================================================
 * Box — 内側の余白と装飾だけを持つ最小単位
 * ============================================================== */

const BACKGROUND = {
  none: "",
  card: "bg-card text-card-fg",
  muted: "bg-muted text-fg",
  accent: "bg-accent text-accent-fg",
  primary: "bg-primary text-primary-fg",
} as const;

const RADIUS = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

const SHADOW = {
  none: "",
  e1: "shadow-e1",
  e2: "shadow-e2",
  e3: "shadow-e3",
} as const;

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  padding?: Responsive<Space>;
  paddingX?: Responsive<Space>;
  paddingY?: Responsive<Space>;
  background?: keyof typeof BACKGROUND;
  border?: boolean;
  radius?: keyof typeof RADIUS;
  shadow?: keyof typeof SHADOW;
  children?: React.ReactNode;
}

/**
 * 内側の余白・背景・角丸・影を持つ箱。**外側の余白は持ちません。**
 * 外側の間隔が欲しいときは、親を Stack / Inline / Columns にしてください。
 */
export function Box({
  as: Tag = "div",
  padding,
  paddingX,
  paddingY,
  background = "none",
  border = false,
  radius = "none",
  shadow = "none",
  className,
  style,
  children,
  ...props
}: BoxProps) {
  return (
    <Tag
      className={cn(
        padding !== undefined && "wt-p",
        paddingX !== undefined && "wt-px",
        paddingY !== undefined && "wt-py",
        BACKGROUND[background],
        border && "border border-border",
        RADIUS[radius],
        SHADOW[shadow],
        className,
      )}
      style={merge(
        spaceVars("p", padding),
        spaceVars("px", paddingX),
        spaceVars("py", paddingY),
        style,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Stack — 縦に等間隔で積む
 * ============================================================== */

const ALIGN_X = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** 子同士の間隔。段階名でも任意の CSS 長さでも可。既定 md。 */
  space?: Responsive<Space>;
  align?: keyof typeof ALIGN_X;
  dividers?: boolean;
  children?: React.ReactNode;
}

/**
 * 縦に積む。**最もよく使う部品です。**
 *
 * ```tsx
 * <Stack space="lg">
 *   <h1>見出し</h1>
 *   <p>本文</p>
 *   <Button>送信</Button>
 * </Stack>
 * ```
 *
 * 子側に `margin-bottom` を書く必要はありません。書くと壊れます。
 */
export function Stack({
  as: Tag = "div",
  space = "md",
  align = "stretch",
  dividers = false,
  className,
  style,
  children,
  ...props
}: StackProps) {
  return (
    <Tag
      className={cn(
        "flex flex-col wt-gap",
        ALIGN_X[align],
        dividers && "divide-y divide-border",
        className,
      )}
      style={merge(spaceVars("gap", space), style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Inline — 横に並べて、入り切らなければ折り返す
 * ============================================================== */

const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

const ALIGN_Y = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
} as const;

export interface InlineProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  space?: Responsive<Space>;
  align?: keyof typeof JUSTIFY;
  alignY?: keyof typeof ALIGN_Y;
  /** 折り返すか。既定 true。 */
  wrap?: boolean;
  children?: React.ReactNode;
}

/**
 * 横に並べる。狭い画面では自動で折り返すので、はみ出しません。
 * タグの列、ボタンの並び、アイコン＋文字などに使います。
 */
export function Inline({
  as: Tag = "div",
  space = "sm",
  align = "start",
  alignY = "center",
  wrap = true,
  className,
  style,
  children,
  ...props
}: InlineProps) {
  return (
    <Tag
      className={cn(
        "flex wt-gap",
        wrap ? "flex-wrap" : "flex-nowrap",
        JUSTIFY[align],
        ALIGN_Y[alignY],
        className,
      )}
      style={merge(spaceVars("gap", space), style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Columns / Column — 段組。狭い画面では縦に畳む
 * ============================================================== */

/** よく使う割合。ここに無い幅（"37%" や "18rem"）もそのまま書けます。 */
export type ColumnWidthToken =
  | "auto"
  | "content"
  | "1/2"
  | "1/3"
  | "2/3"
  | "1/4"
  | "3/4"
  | "1/5"
  | "2/5"
  | "3/5"
  | "4/5";

export type ColumnWidth = ColumnWidthToken | (string & {});

const FRACTION: Record<string, string> = {
  "1/2": "50%",
  "1/3": "33.3333%",
  "2/3": "66.6667%",
  "1/4": "25%",
  "3/4": "75%",
  "1/5": "20%",
  "2/5": "40%",
  "3/5": "60%",
  "4/5": "80%",
};

const ColumnsContext = React.createContext<{
  collapseBelow: Breakpoint | null;
}>({ collapseBelow: "tablet" });

export interface ColumnsProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  space?: Responsive<Space>;
  /**
   * この幅より狭いと縦に畳みます。既定 tablet（768px 未満で縦積み）。
   * null を渡すと常に横並びのままです。
   */
  collapseBelow?: Breakpoint | null;
  alignY?: keyof typeof ALIGN_Y;
  children?: React.ReactNode;
}

/**
 * 段組。**狭い画面での縦積みが既定**なので、スマホで崩れません。
 *
 * ```tsx
 * <Columns space="lg">
 *   <Column width="1/3"><Nav /></Column>
 *   <Column><Article /></Column>
 * </Columns>
 * ```
 */
export function Columns({
  as: Tag = "div",
  space = "md",
  collapseBelow = "tablet",
  alignY = "start",
  className,
  style,
  children,
  ...props
}: ColumnsProps) {
  const direction =
    collapseBelow === "tablet"
      ? "flex-col md:flex-row"
      : collapseBelow === "desktop"
        ? "flex-col lg:flex-row"
        : "flex-row";

  const ctx = React.useMemo(() => ({ collapseBelow }), [collapseBelow]);

  return (
    <ColumnsContext.Provider value={ctx}>
      <Tag
        className={cn("flex w-full wt-gap", direction, ALIGN_Y[alignY], className)}
        style={merge(spaceVars("gap", space), style)}
        {...props}
      >
        {children}
      </Tag>
    </ColumnsContext.Provider>
  );
}

export interface ColumnProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /**
   * 既定 auto（残りを等分）。content は中身の幅ぶんだけ。
   * "1/3" のような割合のほか、"18rem" や "37%" もそのまま書けます。
   */
  width?: ColumnWidth;
  children?: React.ReactNode;
}

/** Columns の中に置く 1 列。 */
export function Column({
  as: Tag = "div",
  width = "auto",
  className,
  style,
  children,
  ...props
}: ColumnProps) {
  const { collapseBelow } = React.useContext(ColumnsContext);

  if (width === "auto") {
    return (
      <Tag className={cn("wt-col", className)} style={style} {...props}>
        {children}
      </Tag>
    );
  }

  const resolved =
    width === "content" ? "auto" : (FRACTION[width as string] ?? width);

  return (
    <Tag
      className={cn(
        "wt-col wt-col--sized",
        collapseBelow === "tablet"
          ? "wt-col--at-tablet"
          : collapseBelow === "desktop"
            ? "wt-col--at-desktop"
            : "wt-col--always",
        className,
      )}
      style={merge({ "--wt-w": resolved } as CSSVars, style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Tiles — 等間隔のグリッド
 * ============================================================== */

/**
 * 列数。数値のほか、CSS の grid-template-columns をそのまま書けます。
 * 例: "repeat(auto-fill, minmax(14rem, 1fr))"
 */
export type Columns_ = number | (string & {});

export interface TilesProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** 既定 { mobile: 1, tablet: 2, desktop: 3 }。 */
  columns?: Responsive<Columns_>;
  space?: Responsive<Space>;
  children?: React.ReactNode;
}

function columnsValue(v: Columns_): string {
  return typeof v === "number" ? `repeat(${v}, minmax(0, 1fr))` : v;
}

/**
 * カードを等間隔に並べるグリッド。要素数が半端でも崩れません。
 *
 * ```tsx
 * <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="lg">
 *   {items.map((i) => <Card key={i.id} {...i} />)}
 * </Tiles>
 *
 * // 列数を決めず、幅で自動的に折り返させることもできます
 * <Tiles columns="repeat(auto-fill, minmax(14rem, 1fr))" space="md" />
 * ```
 */
export function Tiles({
  as: Tag = "div",
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  space = "md",
  className,
  style,
  children,
  ...props
}: TilesProps) {
  const r = resolve(columns);
  const vars = {} as CSSVars;
  if (r.mobile !== undefined) vars["--wt-cols"] = columnsValue(r.mobile);
  if (r.tablet !== undefined) vars["--wt-cols-t"] = columnsValue(r.tablet);
  if (r.desktop !== undefined) vars["--wt-cols-d"] = columnsValue(r.desktop);

  return (
    <Tag
      className={cn("grid wt-cols wt-gap", className)}
      style={merge(vars, spaceVars("gap", space), style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Spread — 両端に寄せる
 * ============================================================== */

export interface SpreadProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  space?: Responsive<Space>;
  alignY?: keyof typeof ALIGN_Y;
  children?: React.ReactNode;
}

/** 子を両端に寄せます。子が 3 つなら等間隔になります。 */
export function Spread({
  as: Tag = "div",
  space = "md",
  alignY = "center",
  className,
  style,
  children,
  ...props
}: SpreadProps) {
  return (
    <Tag
      className={cn(
        "flex w-full flex-wrap justify-between wt-gap",
        ALIGN_Y[alignY],
        className,
      )}
      style={merge(spaceVars("gap", space), style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * ContentBlock / PageBlock — 最大幅と左右の余白
 * ============================================================== */

/** 幅の目安。ここに無い値（"52rem" など）もそのまま書けます。 */
export type WidthToken = "narrow" | "content" | "wide" | "full";
export type Width = WidthToken | (string & {});

const WIDTH_VALUE: Record<string, string> = {
  narrow: "var(--width-narrow)",
  content: "var(--width-content)",
  wide: "var(--width-wide)",
  full: "none",
};

function widthValue(w: Width): string {
  return WIDTH_VALUE[w as string] ?? (w as string);
}

export interface ContentBlockProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** narrow=読み物向け / content=標準 / wide=広め / full=制限なし。既定 content。 */
  width?: Width;
  /** 中央寄せ(center)か左寄せ(start)か。既定 center。 */
  align?: "start" | "center";
  children?: React.ReactNode;
}

/**
 * 中身の最大幅を決めます。左右の余白は付けません（それは PageBlock の役目）。
 * 本文が横に伸びすぎると読みにくいので、文章には `width="narrow"` を使ってください。
 */
export function ContentBlock({
  as: Tag = "div",
  width = "content",
  align = "center",
  className,
  style,
  children,
  ...props
}: ContentBlockProps) {
  return (
    <Tag
      className={cn(
        "w-full wt-maxw",
        align === "center" ? "mx-auto" : "mr-auto",
        className,
      )}
      style={merge({ "--wt-maxw": widthValue(width) } as CSSVars, style)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export interface PageBlockProps extends ContentBlockProps {
  /** 左右の余白。既定 md。 */
  gutter?: Responsive<Space>;
}

/**
 * ページの一番外側。最大幅 + 左右の余白をまとめて面倒みます。
 * **ページを作るときは、まずこれで全体を包んでください。**
 */
export function PageBlock({
  as: Tag = "div",
  width = "content",
  align = "center",
  gutter = "md",
  className,
  style,
  children,
  ...props
}: PageBlockProps) {
  return (
    <Tag
      className={cn(
        "w-full wt-maxw wt-px",
        align === "center" ? "mx-auto" : "mr-auto",
        className,
      )}
      style={merge(
        { "--wt-maxw": widthValue(width) } as CSSVars,
        spaceVars("px", gutter),
        style,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Divider / Section
 * ============================================================== */

/** 区切り線。上下の余白は持たないので、Stack の子として置いてください。 */
export function Divider({
  className,
  ...props
}: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn("w-full border-0 border-t border-border", className)}
      {...props}
    />
  );
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** 上下の余白。既定 2xl。 */
  space?: Responsive<Space>;
  background?: keyof typeof BACKGROUND;
  children?: React.ReactNode;
}

/**
 * ページの 1 区画。上下の余白を統一するためだけの部品です。
 * これを使うと、セクション間の間隔が勝手にばらつきません。
 */
export function Section({
  space = "2xl",
  background = "none",
  className,
  style,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("wt-py", BACKGROUND[background], className)}
      style={merge(spaceVars("py", space), style)}
      {...props}
    >
      {children}
    </section>
  );
}
