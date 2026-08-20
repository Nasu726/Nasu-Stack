import * as React from "react";
import { Box, ContentBlock, Stack } from "@/components/ui/layout";
import { Scrollable } from "@/components/ui/scrollable";
import { t } from "./lang";

/**
 * カタログ 1 項目の枠。
 *
 * このカタログ自体を、配布しているレイアウト部品だけで組んでいます。
 * 生の `flex flex-col gap-4` を書かないのは、見本として成立させるためです。
 */
export function Panel({
  title,
  description,
  children,
  code,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  code?: string;
}) {
  return (
    <Stack space="md">
      <Stack space="2xs">
        <h2 className="text-xl">{title}</h2>
        {/* 1 行が長すぎると読みにくいので、説明文は prose 幅に収める。
            prose は em 単位なので text-sm に追従して自動的に狭くなります。 */}
        <ContentBlock width="prose" align="start" className="text-sm">
          <p className="leading-relaxed text-muted-fg">{description}</p>
        </ContentBlock>
      </Stack>

      <Box padding="lg" background="card" border radius="xl" shadow="e1">
        <Stack space="md">
          {children}
          {code && <Code>{code}</Code>}
        </Stack>
      </Box>
    </Stack>
  );
}

/** コード例。長い行は折り返さず、この中だけを横スクロールさせます。 */
export function Code({ children }: { children: string }) {
  return (
    <Scrollable label={t("コード例")}>
      <Box as="pre" padding="sm" background="muted" radius="md">
        <code className="text-[11px] leading-relaxed text-muted-fg">
          {children}
        </code>
      </Box>
    </Scrollable>
  );
}

/** デモ内で位置関係を見せるための塗り。 */
export function Blk({
  children,
  h,
}: {
  children?: React.ReactNode;
  h?: string;
}) {
  return (
    <Box
      paddingX="sm"
      paddingY="xs"
      background="accent"
      radius="md"
      className={`flex items-center justify-center text-xs ${h ?? ""}`}
    >
      {children}
    </Box>
  );
}
