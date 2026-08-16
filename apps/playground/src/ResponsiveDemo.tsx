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
import { Panel } from "./Panel";

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
  { w: 320, label: "320", note: "小さいスマホ" },
  { w: 375, label: "375", note: "標準的なスマホ" },
  { w: 768, label: "768", note: "タブレット縦" },
  { w: 1024, label: "1024", note: "タブレット横" },
];

function DevicePreview() {
  const [width, setWidth] = React.useState(375);
  const device = DEVICES.find((d) => d.w === width)!;

  return (
    <Panel
      title="端末プレビュー"
      description="このカタログ自身を、指定した幅で表示します。実際のブラウザ幅で描画しているので、md: や lg: の切り替わりもそのまま再現されます。"
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
              // ネストが無限に増えないよう、プレビュー内ではこのタブを出しません
              src="/?embed=1"
              title={`幅 ${width}px のプレビュー`}
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
    name: "折り返せない長い URL",
    node: (
      <p>
        https://example.com/very/long/path/that/never/breaks/anywhere/at/all/because/it/has/no/spaces/1234567890
      </p>
    ),
  },
  {
    name: "長い英単語",
    node: (
      <p>
        Supercalifragilisticexpialidocious_Pneumonoultramicroscopicsilicovolcanoconiosis
      </p>
    ),
  },
  {
    name: "実寸 1600px の画像",
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
      title="壊しにくる中身を入れてみる"
      description="スマホ表示が壊れる原因のほとんどは「縮まない中身」です。折り返せない文字列と、実寸の大きい画像。どちらもテンプレート側で受け止めるので、利用者が overflow-wrap を知らなくても崩れません。ウィンドウを狭めても横スクロールは出ません。"
      code={`/* theme.css が既定で入れているもの */
body { overflow-wrap: break-word; }
img, video, svg, iframe { max-width: 100%; }
pre { overflow-x: auto; }
.wt-gap > * { min-width: 0; }`}
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

const ROWS = [
  ["2026-08-01", "レースゲーム", "Unity / C#", "進行中", "なす", "高", "3", "12,400"],
  ["2026-07-18", "口頭作文ツール", "TypeScript", "完了", "なす", "中", "8", "8,900"],
  ["2026-07-02", "Kaggle パイプライン", "Python", "完了", "なす", "低", "21", "24,100"],
  ["2026-06-20", "WebTemplate", "React / Astro", "進行中", "なす", "高", "5", "3,300"],
];
const HEADERS = ["日付", "案件", "技術", "状態", "担当", "優先度", "件数", "金額"];

function ScrollableDemo() {
  return (
    <Panel
      title="Scrollable — 潰さず、はみ出させず"
      description="表のように、これ以上縮めると読めなくなる中身があります。無理に折り返すのではなく、その部分だけ横スクロールさせるのが正解です。端が切れていることを示す影が出て、キーボードでも到達できます。"
      code={`<Scrollable label="売上の表">
  <table>…</table>
</Scrollable>`}
    >
      <Scrollable label="案件の一覧">
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
      title="崩れていないことを数値で確かめる"
      description="「たぶん大丈夫」ではなく、実際のブラウザを 5 つの幅で開いて機械的に調べます。崩れがあると終了コード 1 を返すので、CI にそのまま載せられます。"
      code={`npm run check -- http://localhost:5173

端末幅チェック: 1 ページ × 5 幅

  ✗ http://localhost:5173  @ 320 (小さいスマホ)
      横に 577px はみ出しています
        ↳ <p class="…"> が 577px 外へ  "https://example.com/very/long…"
        → 長い文字列なら overflow-wrap、表やコードなら <Scrollable> で囲んでください
      入力欄の文字が 16px 未満: 3 件 (name=14px, email=14px, password=14px)
        → iOS では触れた瞬間に画面が自動拡大されます
      タップ領域が 24px 未満: 2 件 (a 43x20 "Works", a 54x20 "Contact")
        → 指で押しづらく、WCAG 2.1 AA の最低基準を下回ります`}
    >
      <Tiles columns={{ mobile: 1, tablet: 2 }} space="sm">
        {[
          ["横スクロールの発生", "はみ出している要素まで名指しで出します"],
          ["入力欄の文字サイズ", "16px 未満だと iOS が自動拡大します"],
          ["タップ領域", "24px 未満は指で押しづらい"],
          ["縮まない固定幅", "画面幅より大きい min-width / flex-shrink:0"],
          ["1 行の長さ", "長すぎる本文は読みにくい"],
          ["終了コード", "崩れがあれば 1。CI に載せられます"],
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
