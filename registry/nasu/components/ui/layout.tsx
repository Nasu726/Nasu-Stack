import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * WebTemplate — レイアウト・プリミティブ
 * ================================================================
 * 唯一の原則:
 *
 *   **コンポーネントは自分の周囲に余白を持たない。**
 *   **余白は、ここにあるレイアウト部品だけが所有する。**
 *
 * この原則があるので、部品をどこに置いても余白が二重にならず、
 * 「なぜかここだけ隙間が広い」が起きません。
 *
 * そして余白の値は下の 9 段階からしか選べません。
 * 13px か 14px かで悩む余地を、型の時点で消してあります。
 *
 *   none  2xs   xs   sm   md   lg   xl   2xl   3xl
 *    0     4    8    12   16   24   40   64    96   (px, neutral テーマ時)
 *
 * 段階の実際の値はテーマごとに変わります（warm は広め、editorial は詰めぎみ）。
 */

/* ================================================================
 * 型
 * ============================================================== */

export type Space =
  | "none"
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl";

/** 画面幅ごとに値を変えたいとき。`space={{ mobile: "sm", tablet: "xl" }}` */
export type Responsive<T> =
  | T
  | { mobile?: T; tablet?: T; desktop?: T };

export type Breakpoint = "tablet" | "desktop";

function resolve<T>(
  value: Responsive<T> | undefined,
): { mobile?: T; tablet?: T; desktop?: T } {
  if (value === undefined) return {};
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as { mobile?: T; tablet?: T; desktop?: T };
  }
  return { mobile: value as T };
}

/**
 * Tailwind はソースを文字列として走査するため、クラス名は必ず
 * 完全な形で書き出す必要があります（`gap-${x}` は検出されません）。
 * 冗長ですが、これが確実です。
 */
function pick<T extends string>(
  maps: {
    mobile: Record<T, string>;
    tablet: Record<T, string>;
    desktop: Record<T, string>;
  },
  value: Responsive<T> | undefined,
): string[] {
  const r = resolve(value);
  return [
    r.mobile ? maps.mobile[r.mobile] : "",
    r.tablet ? maps.tablet[r.tablet] : "",
    r.desktop ? maps.desktop[r.desktop] : "",
  ].filter(Boolean);
}

/* ================================================================
 * クラス表
 * ============================================================== */

const GAP = {
  mobile: {
    none: "gap-none",
    "2xs": "gap-2xs",
    xs: "gap-xs",
    sm: "gap-sm",
    md: "gap-md",
    lg: "gap-lg",
    xl: "gap-xl",
    "2xl": "gap-2xl",
    "3xl": "gap-3xl",
  },
  tablet: {
    none: "md:gap-none",
    "2xs": "md:gap-2xs",
    xs: "md:gap-xs",
    sm: "md:gap-sm",
    md: "md:gap-md",
    lg: "md:gap-lg",
    xl: "md:gap-xl",
    "2xl": "md:gap-2xl",
    "3xl": "md:gap-3xl",
  },
  desktop: {
    none: "lg:gap-none",
    "2xs": "lg:gap-2xs",
    xs: "lg:gap-xs",
    sm: "lg:gap-sm",
    md: "lg:gap-md",
    lg: "lg:gap-lg",
    xl: "lg:gap-xl",
    "2xl": "lg:gap-2xl",
    "3xl": "lg:gap-3xl",
  },
} as const;

const PADDING = {
  mobile: {
    none: "p-none",
    "2xs": "p-2xs",
    xs: "p-xs",
    sm: "p-sm",
    md: "p-md",
    lg: "p-lg",
    xl: "p-xl",
    "2xl": "p-2xl",
    "3xl": "p-3xl",
  },
  tablet: {
    none: "md:p-none",
    "2xs": "md:p-2xs",
    xs: "md:p-xs",
    sm: "md:p-sm",
    md: "md:p-md",
    lg: "md:p-lg",
    xl: "md:p-xl",
    "2xl": "md:p-2xl",
    "3xl": "md:p-3xl",
  },
  desktop: {
    none: "lg:p-none",
    "2xs": "lg:p-2xs",
    xs: "lg:p-xs",
    sm: "lg:p-sm",
    md: "lg:p-md",
    lg: "lg:p-lg",
    xl: "lg:p-xl",
    "2xl": "lg:p-2xl",
    "3xl": "lg:p-3xl",
  },
} as const;

const PADDING_X = {
  mobile: {
    none: "px-none",
    "2xs": "px-2xs",
    xs: "px-xs",
    sm: "px-sm",
    md: "px-md",
    lg: "px-lg",
    xl: "px-xl",
    "2xl": "px-2xl",
    "3xl": "px-3xl",
  },
  tablet: {
    none: "md:px-none",
    "2xs": "md:px-2xs",
    xs: "md:px-xs",
    sm: "md:px-sm",
    md: "md:px-md",
    lg: "md:px-lg",
    xl: "md:px-xl",
    "2xl": "md:px-2xl",
    "3xl": "md:px-3xl",
  },
  desktop: {
    none: "lg:px-none",
    "2xs": "lg:px-2xs",
    xs: "lg:px-xs",
    sm: "lg:px-sm",
    md: "lg:px-md",
    lg: "lg:px-lg",
    xl: "lg:px-xl",
    "2xl": "lg:px-2xl",
    "3xl": "lg:px-3xl",
  },
} as const;

const PADDING_Y = {
  mobile: {
    none: "py-none",
    "2xs": "py-2xs",
    xs: "py-xs",
    sm: "py-sm",
    md: "py-md",
    lg: "py-lg",
    xl: "py-xl",
    "2xl": "py-2xl",
    "3xl": "py-3xl",
  },
  tablet: {
    none: "md:py-none",
    "2xs": "md:py-2xs",
    xs: "md:py-xs",
    sm: "md:py-sm",
    md: "md:py-md",
    lg: "md:py-lg",
    xl: "md:py-xl",
    "2xl": "md:py-2xl",
    "3xl": "md:py-3xl",
  },
  desktop: {
    none: "lg:py-none",
    "2xs": "lg:py-2xs",
    xs: "lg:py-xs",
    sm: "lg:py-sm",
    md: "lg:py-md",
    lg: "lg:py-lg",
    xl: "lg:py-xl",
    "2xl": "lg:py-2xl",
    "3xl": "lg:py-3xl",
  },
} as const;

/* ================================================================
 * Box — 内側の余白と装飾だけを持つ最小単位
 * ============================================================== */

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  padding?: Responsive<Space>;
  paddingX?: Responsive<Space>;
  paddingY?: Responsive<Space>;
  background?: "none" | "card" | "muted" | "accent" | "primary";
  border?: boolean;
  radius?: "none" | "sm" | "md" | "lg" | "xl" | "full";
  shadow?: "none" | "e1" | "e2" | "e3";
  children?: React.ReactNode;
}

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
  children,
  ...props
}: BoxProps) {
  return (
    <Tag
      className={cn(
        ...pick(PADDING, padding),
        ...pick(PADDING_X, paddingX),
        ...pick(PADDING_Y, paddingY),
        BACKGROUND[background],
        border && "border border-border",
        RADIUS[radius],
        SHADOW[shadow],
        className,
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
  /** 子同士の間隔。既定 md。 */
  space?: Responsive<Space>;
  /** 横方向の揃え。既定 stretch。 */
  align?: keyof typeof ALIGN_X;
  /** 子の間に区切り線を入れる。 */
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
  children,
  ...props
}: StackProps) {
  return (
    <Tag
      className={cn(
        "flex flex-col",
        ALIGN_X[align],
        ...pick(GAP, space),
        dividers && "divide-y divide-border [&>*]:pt-[inherit]",
        className,
      )}
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
  /** 横方向の寄せ。既定 start。 */
  align?: keyof typeof JUSTIFY;
  /** 縦方向の揃え。既定 center。 */
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
  children,
  ...props
}: InlineProps) {
  return (
    <Tag
      className={cn(
        "flex",
        wrap ? "flex-wrap" : "flex-nowrap",
        JUSTIFY[align],
        ALIGN_Y[alignY],
        ...pick(GAP, space),
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Columns / Column — 段組。狭い画面では縦に畳む
 * ============================================================== */

type ColumnWidth =
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

const ColumnsContext = React.createContext<{ collapseBelow: Breakpoint | null }>(
  { collapseBelow: null },
);

/** 畳む位置ごとに、幅クラスをどの breakpoint から効かせるか */
const WIDTH_FROM_TABLET: Record<ColumnWidth, string> = {
  auto: "md:flex-1",
  content: "md:flex-none",
  "1/2": "md:flex-none md:w-1/2",
  "1/3": "md:flex-none md:w-1/3",
  "2/3": "md:flex-none md:w-2/3",
  "1/4": "md:flex-none md:w-1/4",
  "3/4": "md:flex-none md:w-3/4",
  "1/5": "md:flex-none md:w-1/5",
  "2/5": "md:flex-none md:w-2/5",
  "3/5": "md:flex-none md:w-3/5",
  "4/5": "md:flex-none md:w-4/5",
};

const WIDTH_FROM_DESKTOP: Record<ColumnWidth, string> = {
  auto: "lg:flex-1",
  content: "lg:flex-none",
  "1/2": "lg:flex-none lg:w-1/2",
  "1/3": "lg:flex-none lg:w-1/3",
  "2/3": "lg:flex-none lg:w-2/3",
  "1/4": "lg:flex-none lg:w-1/4",
  "3/4": "lg:flex-none lg:w-3/4",
  "1/5": "lg:flex-none lg:w-1/5",
  "2/5": "lg:flex-none lg:w-2/5",
  "3/5": "lg:flex-none lg:w-3/5",
  "4/5": "lg:flex-none lg:w-4/5",
};

const WIDTH_ALWAYS: Record<ColumnWidth, string> = {
  auto: "flex-1",
  content: "flex-none",
  "1/2": "flex-none w-1/2",
  "1/3": "flex-none w-1/3",
  "2/3": "flex-none w-2/3",
  "1/4": "flex-none w-1/4",
  "3/4": "flex-none w-3/4",
  "1/5": "flex-none w-1/5",
  "2/5": "flex-none w-2/5",
  "3/5": "flex-none w-3/5",
  "4/5": "flex-none w-4/5",
};

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
  children,
  ...props
}: ColumnsProps) {
  const direction =
    collapseBelow === "tablet"
      ? "flex-col md:flex-row"
      : collapseBelow === "desktop"
        ? "flex-col lg:flex-row"
        : "flex-row";

  return (
    <ColumnsContext.Provider value={{ collapseBelow }}>
      <Tag
        className={cn(
          "flex w-full",
          direction,
          ALIGN_Y[alignY],
          ...pick(GAP, space),
          className,
        )}
        {...props}
      >
        {children}
      </Tag>
    </ColumnsContext.Provider>
  );
}

export interface ColumnProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** 既定 auto（残りを等分）。content は中身の幅ぶんだけ。 */
  width?: ColumnWidth;
  children?: React.ReactNode;
}

/** Columns の中に置く 1 列。Columns の外では使えません。 */
export function Column({
  as: Tag = "div",
  width = "auto",
  className,
  children,
  ...props
}: ColumnProps) {
  const { collapseBelow } = React.useContext(ColumnsContext);
  const widthClass =
    collapseBelow === "tablet"
      ? WIDTH_FROM_TABLET[width]
      : collapseBelow === "desktop"
        ? WIDTH_FROM_DESKTOP[width]
        : WIDTH_ALWAYS[width];

  return (
    <Tag className={cn("min-w-0", widthClass, className)} {...props}>
      {children}
    </Tag>
  );
}

/* ================================================================
 * Tiles — 等間隔のグリッド
 * ============================================================== */

const COLS = {
  mobile: {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  },
  tablet: {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6",
  },
  desktop: {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  },
} as const;

type ColumnCount = 1 | 2 | 3 | 4 | 5 | 6;

export interface TilesProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** 列数。既定 { mobile: 1, tablet: 2, desktop: 3 }。 */
  columns?: Responsive<ColumnCount>;
  space?: Responsive<Space>;
  children?: React.ReactNode;
}

/**
 * カードを等間隔に並べるグリッド。要素数が半端でも崩れません。
 *
 * ```tsx
 * <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="lg">
 *   {items.map((i) => <Card key={i.id} {...i} />)}
 * </Tiles>
 * ```
 */
export function Tiles({
  as: Tag = "div",
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  space = "md",
  className,
  children,
  ...props
}: TilesProps) {
  const r = resolve(columns);
  return (
    <Tag
      className={cn(
        "grid",
        r.mobile ? COLS.mobile[r.mobile] : "grid-cols-1",
        r.tablet ? COLS.tablet[r.tablet] : "",
        r.desktop ? COLS.desktop[r.desktop] : "",
        ...pick(GAP, space),
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Spread — 両端に寄せる（ヘッダーのロゴとメニューなど）
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
  children,
  ...props
}: SpreadProps) {
  return (
    <Tag
      className={cn(
        "flex w-full flex-wrap justify-between",
        ALIGN_Y[alignY],
        ...pick(GAP, space),
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * ContentBlock / PageBlock — 最大幅と左右の余白
 * ============================================================== */

const MAX_WIDTH = {
  narrow: "max-w-narrow",
  content: "max-w-content",
  wide: "max-w-wide",
  full: "max-w-none",
} as const;

export interface ContentBlockProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** narrow=読み物向け / content=標準 / wide=広め / full=制限なし。既定 content。 */
  width?: keyof typeof MAX_WIDTH;
  /** 中央寄せ(center)か左寄せ(start)か。既定 center。 */
  align?: "start" | "center";
  children?: React.ReactNode;
}

/**
 * 中身の最大幅を決めます。左右の余白は付けません（それは PageBlock の役目）。
 *
 * 本文が横に伸びすぎると読みにくいので、文章には `width="narrow"` を使ってください。
 * 見出しの下に続く説明文など、左揃えのまま幅だけ絞りたいときは `align="start"`。
 */
export function ContentBlock({
  as: Tag = "div",
  width = "content",
  align = "center",
  className,
  children,
  ...props
}: ContentBlockProps) {
  return (
    <Tag
      className={cn(
        "w-full",
        align === "center" ? "mx-auto" : "mr-auto",
        MAX_WIDTH[width],
        className,
      )}
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
 *
 * ```tsx
 * <PageBlock>
 *   <Stack space="3xl">
 *     <Hero />
 *     <Features />
 *   </Stack>
 * </PageBlock>
 * ```
 */
export function PageBlock({
  as: Tag = "div",
  width = "content",
  gutter = "md",
  className,
  children,
  ...props
}: PageBlockProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full",
        MAX_WIDTH[width],
        ...pick(PADDING_X, gutter),
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ================================================================
 * Divider
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

/* ================================================================
 * Section — 縦方向のリズムを持つページ区画
 * ============================================================== */

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** 上下の余白。既定 2xl。 */
  space?: Responsive<Space>;
  background?: BoxProps["background"];
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
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        ...pick(PADDING_Y, space),
        BACKGROUND[background],
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
