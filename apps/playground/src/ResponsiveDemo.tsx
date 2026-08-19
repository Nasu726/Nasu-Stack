import * as React from "react";
import {
  Box,
  Inline,
  Stack,
  Tiles,
  ContentBlock,
} from "@/components/ui/layout";
import { Scrollable } from "@/components/ui/scrollable";
import { Button } from "@/components/ui/action-button";
import { withBase } from "@/lib/base";
import { Panel } from "./Panel";
import { t } from "./lang";

export function ResponsiveDemo() {
  return (
    <Stack space="3xl">
      <DevicePreview />
      <BreakingContent />
      <ScrollableDemo />
      <CheckCommand />
    </Stack>
  );
}

/* ---------------------------------------------------------------- */

const DEVICES = [
  { w: 320, label: "320", note: t("小さいスマホ") },
  { w: 375, label: "375", note: t("標準的なスマホ") },
  { w: 768, label: "768", note: t("タブレット縦") },
  { w: 1024, label: "1024", note: t("タブレット横") },
];

function DevicePreview() {
  const [width, setWidth] = React.useState(375);
  const device = DEVICES.find((d) => d.w === width)!;

  return (
    <Panel
      title={t("端末プレビュー")}
      description={
        <>
          {t("このカタログ自身を、指定した幅で表示します。iframe は独立した\r\n          ビューポートなので、")}<code className="text-fg">md:</code> {t("や")}{" "}
          <code className="text-fg">lg:</code> {t("の切り替わりもそのまま起きます。")}
          <strong className="text-fg">
            {t("画面の広い端末で見るためのものです。")}
          </strong>
          {t("スマホでは元の幅がもともと狭いので、どの幅を選んでもほとんど変わりません。")}
        </>
      }
    >
      <Stack space="md">
        <Inline space="xs">
          {DEVICES.map((d) => (
            <Button
              key={d.w}
              size="sm"
              variant={width === d.w ? "primary" : "outline"}
              onClick={() => setWidth(d.w)}
            >
              {d.label}px
            </Button>
          ))}
          <span className="text-xs text-muted-fg">{device.note}</span>
        </Inline>

        <div className="overflow-x-auto">
          <div
            className="mx-auto overflow-hidden rounded-lg border border-border bg-bg shadow-e2"
            style={{ width, maxWidth: "100%" }}
          >
            <iframe
              // ネストが無限に増えないよう、プレビュー内ではこのタブを出しません。
              // **base を自分で付けます。** src は手で書いた文字列なので、
              // ビルドは書き換えません。付け忘れると、サブパスに公開したときだけ
              // ここが 404 になります（v0.9c で実際にそうなっていました）。
              src={withBase("/?embed=1")}
              title={t("幅 {0}px のプレビュー").replace("{0}", String(width))}
              className="block h-[520px] w-full border-0"
            />
          </div>
        </div>
      </Stack>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

const HOSTILE = [
  {
    name: t("折り返せない長い URL"),
    node: (
      <p>
        https://example.com/very/long/path/that/never/breaks/anywhere/at/all/because/it/has/no/spaces/1234567890
      </p>
    ),
  },
  {
    name: t("長い英単語"),
    node: (
      <p>
        Supercalifragilisticexpialidocious_Pneumonoultramicroscopicsilicovolcanoconiosis
      </p>
    ),
  },
  {
    name: t("実寸 1600px の画像"),
    node: (
      <img
        alt=""
        width={1600}
        height={200}
        src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='200'><rect width='1600' height='200' fill='%23dcdcdc'/><text x='30' y='115' font-size='60' fill='%23666'>1600 x 200</text></svg>"
        className="rounded-md"
      />
    ),
  },
];

function BreakingContent() {
  return (
    <Panel
      title={t("壊しにくる中身を入れてみる")}
      description={t("スマホ表示が壊れる原因のほとんどは「縮まない中身」です。折り返せない文字列と、実寸の大きい画像。どちらもテンプレート側で受け止めるので、利用者が overflow-wrap を知らなくても崩れません。ウィンドウを狭めても横スクロールは出ません。")}
      code={t("/* theme.css が既定で入れているもの */\nbody { overflow-wrap: break-word; }\nimg, video, svg, iframe { max-width: 100%; }\npre { overflow-x: auto; }\n.wt-gap > * { min-width: 0; }")}
    >
      <Stack space="lg">
        {HOSTILE.map((h) => (
          <Stack key={h.name} space="2xs">
            <span className="text-xs font-medium text-muted-fg">{h.name}</span>
            <Box padding="sm" background="muted" radius="md">
              {h.node}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

/* 見本の中身は**誰のものでもない値**にします。
   実在の案件名や氏名を置くと、そのまま公開ページに載ります。 */
const ROWS = [
  ["2026-08-01", t("案件 A"), "Unity / C#", t("進行中"), "me", t("高"), "3", "12,400"],
  ["2026-07-18", t("案件 B"), "TypeScript", t("完了"), "me", t("中"), "8", "8,900"],
  ["2026-07-02", t("案件 C"), "Python", t("完了"), "collaborator", t("低"), "21", "24,100"],
  ["2026-06-20", t("案件 D"), "React / Astro", t("進行中"), "me", t("高"), "5", "3,300"],
];
const HEADERS = [t("日付"), t("案件"), t("技術"), t("状態"), t("担当"), t("優先度"), t("件数"), t("金額")];

function ScrollableDemo() {
  const [bar, setBar] = React.useState<"auto" | "hidden">("auto");

  return (
    <Panel
      title={t("Scrollable — 潰さず、はみ出させず")}
      description={
        <>
          {t("表のように、これ以上縮めると読めなくなる中身があります。\r\n          無理に折り返すのではなく、その部分だけ横スクロールさせるのが正解です。\r\n          端が切れていることを示す影が出て、キーボードでも到達できます。\r\n          ホイールは")}<strong className="text-fg">{t("横の動きだけ")}</strong>{t("を見ます\r\n          （縦を横に回すと、ページを縦に読んでいる途中で止まります）。")}
        </>
      }
      code={t("<Scrollable label=\"売上の表\">\n  <table>…</table>\n</Scrollable>\n\n// スクロールバーが邪魔なとき（端の影は残ります）\n<Scrollable label=\"売上の表\" scrollbar=\"hidden\">…</Scrollable>")}
    >
      <Inline space="xs" alignY="center">
        {(["auto", "hidden"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={bar === v ? "primary" : "outline"}
            onClick={() => setBar(v)}
          >
            scrollbar=&quot;{v}&quot;
          </Button>
        ))}
        <span className="text-xs text-muted-fg">
          {t("隠しても、端の影とキーボード操作は残ります")}
        </span>
      </Inline>

      <Scrollable label={t("案件の一覧")} scrollbar={bar}>
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-sm py-xs font-medium text-muted-fg"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-b border-border last:border-0">
                {r.map((c, i) => (
                  <td key={i} className="whitespace-nowrap px-sm py-xs">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Scrollable>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function CheckCommand() {
  return (
    <Panel
      title={t("崩れていないことを数値で確かめる")}
      description={t("「たぶん大丈夫」ではなく、実際のブラウザを 5 つの幅で開いて機械的に調べます。崩れがあると終了コード 1 を返すので、CI にそのまま載せられます。")}
      code={t("npm run check          # 見に行く URL は package.json に書いてあります\n                       # （astro なら 4321、vite なら 4173）\n\n端末幅チェック: 1 ページ × 5 幅\n\n  ✗ http://localhost:4321  @ 320 (小さいスマホ)\n      横に 577px はみ出しています\n        ↳ <p class=\"…\"> が 577px 外へ  \"https://example.com/very/long…\"\n        → 長い文字列なら overflow-wrap、表やコードなら <Scrollable> で囲んでください\n      入力欄の文字が 16px 未満: 3 件 (name=14px, email=14px, password=14px)\n        → iOS では触れた瞬間に画面が自動拡大されます\n      タップ領域が 24px 未満: 2 件 (a 43x20 \"Works\", a 54x20 \"Contact\")\n        → 指で押しづらく、WCAG 2.1 AA の最低基準を下回ります")}
    >
      <Tiles columns={{ mobile: 1, tablet: 2 }} space="sm">
        {[
          [t("横スクロールの発生"), t("はみ出している要素まで名指しで出します")],
          [t("入力欄の文字サイズ"), t("16px 未満だと iOS が自動拡大します")],
          [t("タップ領域"), t("24px 未満は指で押しづらい")],
          [t("縮まない固定幅"), t("画面幅より大きい min-width / flex-shrink:0")],
          [t("1 行の長さ"), t("長すぎる本文は読みにくい")],
          [t("終了コード"), t("崩れがあれば 1。CI に載せられます")],
        ].map(([t, d]) => (
          <Box key={t} padding="sm" background="muted" radius="md">
            <Stack space="2xs">
              <span className="text-sm font-medium">{t}</span>
              <span className="text-xs text-muted-fg">{d}</span>
            </Stack>
          </Box>
        ))}
      </Tiles>
    </Panel>
  );
}
