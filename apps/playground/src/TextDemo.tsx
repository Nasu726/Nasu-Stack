import * as React from "react";
import { Panel } from "./Panel";
import { Frame, Img } from "@/components/ui/frame";
import { withBase } from "@/lib/base";
import { ContentBlock, Columns, Column, Stack } from "@/components/ui/layout";
import { Button } from "@/components/ui/action-button";

/**
 * 1600x900 の画像。**外部の URL は使いません。**
 * 検証はネットワークの無い環境でも走る必要があるためです。
 *
 * **base は自分で付けます。** `src` は手で書いた文字列なので、
 * ビルドは書き換えません。付け忘れると、サブパスに公開したときだけ
 * 画像が出なくなります（v0.9d まで実際に出ていませんでした。
 * ボタンを押すまで描画されないので、検査も素通りしていました）。
 */
const IMAGE = withBase("/demo-1600x900.png");

export function TextDemo() {
  return (
    <Stack space="3xl">
      <ProseSection />
      <FrameSection />
    </Stack>
  );
}

/* ================================================================ */

function ProseSection() {
  return (
    <Panel
      title="prose.css"
      description={
        <>
          Markdown を流し込む場所の見た目です。
          <strong className="text-fg">幅は持たせていません。</strong>
          読みやすい行長は <code className="text-fg">ContentBlock width="prose"</code>{" "}
          の担当で、両方が幅を決めると同じ基準が 2 か所に増えて必ずずれるためです。
          この部分だけ「部品は外側の余白を持たない」の原則を破っています。
          <code className="text-fg">&lt;h2&gt;</code> と{" "}
          <code className="text-fg">&lt;p&gt;</code> の間に{" "}
          <code className="text-fg">&lt;Stack&gt;</code> は挟めないからです。
        </>
      }
      code={`<ContentBlock width="prose">
  <div class="wt-prose" set:html={content} />
</ContentBlock>`}
    >
      <ContentBlock width="prose">
        <div className="wt-prose">
          <h2>見出しの例</h2>
          <p>
            本文です。行の長さは <code>ContentBlock</code> が決めています。
            和文はおよそ 40 字で折り返すので、視線が戻る距離が短く保たれます。
            長い URL（
            <a href="#x">https://example.com/very/long/path/that/never/breaks</a>
            ）を書いても、はみ出さずに折り返します。
          </p>
          <h3>箇条書き</h3>
          <ul>
            <li>行間は 1.85。和文は詰まって見えやすいので広めにしています</li>
            <li>
              入れ子も揃います
              <ul>
                <li>2 段目</li>
              </ul>
            </li>
          </ul>
          <blockquote>
            引用。左に線が入り、色が一段落ちます。
          </blockquote>
          <pre>
            <code>{`const answer = 42;
// 横に長いコードは折り返さず、この中だけ横スクロールします`}</code>
          </pre>
          <p>
            リンクの<a href="#x">下線は消していません</a>。
            色だけで示すと、色を見分けにくい人に届かないためです。
          </p>
          <table>
            <thead>
              <tr>
                <th>項目</th>
                <th>値</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>行間</td>
                <td>1.85</td>
              </tr>
              <tr>
                <td>見出しの上余白</td>
                <td>--space-xl</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ContentBlock>
    </Panel>
  );
}

/* ================================================================ */

function FrameSection() {
  const [shown, setShown] = React.useState<"none" | "bad" | "good">("none");

  return (
    <Panel
      title="Frame / Img"
      description={
        <>
          画像は読み込みが終わるまで大きさが分かりません。何もしないと、
          読み込んだ瞬間に
          <strong className="text-fg">その下の本文がガクッと下へずれます</strong>
          （レイアウトシフト）。比率さえ決めておけば、画像がまだ来ていなくても
          高さが確定します。画像そのものの最適化はしません。Astro
          の <code className="text-fg">&lt;Image&gt;</code> をそのまま中に入れられます。
        </>
      }
      code={`<Frame ratio="16/9">
  <Img src="/hero.avif" alt="" priority />   {/* 最初の画面に入る画像 */}
</Frame>`}
    >
      <Stack space="md">
        <Columns space="md" collapseBelow="tablet">
          <Column>
            <Stack space="2xs">
              <p className="text-xs font-medium text-danger">
                包まない（下の文章がずれます）
              </p>
              <div className="rounded-lg border border-dashed border-danger/40 p-2">
                {shown !== "none" && (
                  <img
                    src={`${IMAGE}?a=${shown}`}
                    alt=""
                    className="w-full rounded-md"
                  />
                )}
                <p className="text-xs text-muted-fg">
                  この文章の位置が、画像の到着で下へ動きます。
                </p>
              </div>
            </Stack>
          </Column>
          <Column>
            <Stack space="2xs">
              <p className="text-xs font-medium text-success">
                Frame で包む（動きません）
              </p>
              <div className="rounded-lg border border-dashed border-success/40 p-2">
                <Frame ratio="16/9">
                  {shown !== "none" && (
                    <Img src={`${IMAGE}?b=${shown}`} alt="" priority />
                  )}
                </Frame>
                <p className="text-xs text-muted-fg">
                  こちらは先に場所が取ってあるので、位置が変わりません。
                </p>
              </div>
            </Stack>
          </Column>
        </Columns>

        <Button
          variant="outline"
          onClick={() => setShown(shown === "none" ? "bad" : "none")}
        >
          {shown === "none" ? "画像を読み込む" : "戻す"}
        </Button>

        <Stack space="2xs">
          <p className="text-xs text-muted-fg">比率を変えた例</p>
          <Columns space="sm">
            <Column>
              <Frame ratio="1" radius="md">
                <div className="flex size-full items-center justify-center text-xs text-muted-fg">
                  1 / 1
                </div>
              </Frame>
            </Column>
            <Column>
              <Frame ratio="4/3" radius="md">
                <div className="flex size-full items-center justify-center text-xs text-muted-fg">
                  4 / 3
                </div>
              </Frame>
            </Column>
            <Column>
              <Frame ratio="21/9" radius="md">
                <div className="flex size-full items-center justify-center text-xs text-muted-fg">
                  21 / 9
                </div>
              </Frame>
            </Column>
          </Columns>
        </Stack>
      </Stack>
    </Panel>
  );
}
