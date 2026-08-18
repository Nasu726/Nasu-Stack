import * as React from "react";
import { Panel } from "./Panel";
import { Button } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Accordion, Disclosure } from "@/components/ui/disclosure";
import { DropdownMenu, NavDropdown } from "@/components/ui/dropdown-menu";
import { SiteHeader, SkipLink } from "@/components/ui/site-nav";
import { useToast } from "@/components/ui/toast";
import { Inline, Stack } from "@/components/ui/layout";

const NAV = [
  { href: "#a", label: "製品" },
  { href: "#b", label: "料金" },
  { href: "#c", label: "会社概要" },
  // external の見本。**実際に飛ぶ先なので、実在して差し支えない URL にします。**
  // example.com は表記用に予約された名前ですが、IANA の説明ページが本当に出ます。
  { href: "https://github.com/Nasu726/WebTemplate", label: "GitHub", external: true },
];

export function NavDemo() {
  return (
    <Stack space="3xl">
      <HeaderSection />
      {/* メニューは**下に余白がある位置に置きます。**
          最下部だと必ず上向きに開くので、
          「入り切らないときだけ上に出す」動きが見られません。 */}
      <MenuSection />
      <DialogSection />
      <TabsSection />
      <DisclosureSection />
    </Stack>
  );
}

/* ================================================================ */

function HeaderSection() {
  return (
    <Panel
      title="SiteHeader / SkipLink"
      description={
        <>
          狭い画面のメニューは <code className="text-fg">&lt;details&gt;</code>{" "}
          です。<strong className="text-fg">JavaScript が 1 行も要りません。</strong>
          Astro に置くとき <code className="text-fg">client:</code>{" "}
          を付けなくても開閉します。読み込みの遅い回線で「押しても何も起きない数秒」が
          生まれないのが理由です。Esc で閉じる処理だけ JS
          で足していますが、無くてももう一度押せば閉じます。
        </>
      }
      code={`<SkipLink />
<SiteHeader
  brand="Example Studio"
  items={[{ href: "/works", label: "Works" }]}
  currentPath={Astro.url.pathname}   // ルーターに依存しない
  actions={<ThemeSwitcher />}
/>`}
    >
      <Stack space="xs">
        <p className="text-xs text-muted-fg">
          下は実物です（sticky は切ってあります）。画面を狭くするとハンバーガーに変わります。
        </p>
        <p className="text-xs text-muted-fg">
          このヘッダは <code className="text-fg">z-30</code>{" "}
          です。ページの一部として埋め込むときは、
          <strong className="text-fg">外側の枠をそれより手前に置いてください。</strong>
          このカタログ自身のヘッダを <code className="text-fg">z-40</code>{" "}
          にしているのはそのためです。
        </p>
        {/* **overflow-hidden を付けてはいけません。** 角丸のために付けたく
            なりますが、狭い画面でハンバーガーを開くと、下へ伸びたメニューが
            この枠で切られます（実測: 枠の下端 794px に対して項目の下端 948px。
            154px 分が見えませんでした）。 */}
        <div className="rounded-lg border border-border">
          <SiteHeader
            brand="Example Studio"
            items={NAV}
            currentPath="#b"
            sticky={false}
            width="full"
            actions={<SkipLink href="#catalog-panel">本文へ</SkipLink>}
          />
          <div className="p-md text-xs text-muted-fg">
            ヘッダの下の中身。「料金」に{" "}
            <code className="text-fg">aria-current="page"</code> が付いています。
          </div>
        </div>
      </Stack>
    </Panel>
  );
}

/* ================================================================ */

function DialogSection() {
  const [center, setCenter] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const toast = useToast();

  return (
    <Panel
      title="Dialog"
      description={
        <>
          ブラウザ標準の <code className="text-fg">&lt;dialog&gt;</code>{" "}
          を使うので、フォーカスの閉じ込め・背面の無効化・Esc・最前面表示は
          ブラウザ任せです。
          <strong className="text-fg">
            ただし背面のスクロールだけは止まらない
          </strong>
          ので、そこだけ自分で止めています。開閉で画面が横に揺れないよう、
          スクロールバーの幅は常に確保してあります。
        </>
      }
      code={`<Dialog open={open} onOpenChange={setOpen} title="設定">
  中身
</Dialog>

// 端から出すシート（狭い画面のメニューなどに）
<Dialog placement="sheet-right" ... />`}
    >
      <Inline space="xs">
        <Button onClick={() => setCenter(true)}>中央に出す</Button>
        <Button variant="outline" onClick={() => setSheet(true)}>
          右から出す
        </Button>
      </Inline>

      <Dialog
        open={center}
        onOpenChange={setCenter}
        title="通知の設定"
        description="ここは説明文です。読み上げにも渡されます。"
        footer={
          <Inline space="xs" align="end">
            <Button variant="outline" onClick={() => setCenter(false)}>
              閉じる
            </Button>
            <Button
              onClick={() => {
                setCenter(false);
                toast.show({ tone: "success", title: "保存しました" });
              }}
            >
              保存する
            </Button>
          </Inline>
        }
      >
        <p className="text-sm text-muted-fg">
          この裏側は押せません。Tab を何度押してもここから出ません。
        </p>
      </Dialog>

      <Dialog
        open={sheet}
        onOpenChange={setSheet}
        placement="sheet-right"
        title="シート"
      >
        <Stack space="xs">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              {...(n.external
                ? { target: "_blank", rel: "noreferrer noopener" }
                : {})}
              className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted"
              onClick={() => setSheet(false)}
            >
              {n.label}
            </a>
          ))}
        </Stack>
      </Dialog>
    </Panel>
  );
}

/* ================================================================ */

function TabsSection() {
  const [manual, setManual] = React.useState("x");

  return (
    <Panel
      title="Tabs"
      description={
        <>
          このカタログ上部のタブも、これに差し替えました。
          <strong className="text-fg">矢印キーで移動できるのが本体</strong>で、
          Tab キーで止まるのは選択中の 1 つだけです（roving tabindex）。
          入りきらないときは潰さずに横スクロールします。
        </>
      }
      code={`<Tabs items={items} value={tab} onValueChange={setTab}>
  <TabPanel value="a">…</TabPanel>
</Tabs>

// 切り替えが重いときは manual（Enter を押すまで切り替えない）
<Tabs activation="manual" ... />`}
    >
      <Stack space="md">
        <Tabs
          items={[
            { value: "a", label: "概要" },
            { value: "b", label: "詳細" },
            { value: "c", label: "使えない", disabled: true },
            { value: "d", label: "履歴" },
          ]}
          label="例"
        >
          <TabPanel value="a">
            <p className="text-sm text-muted-fg">
              ← → で移動、Home / End で端へ。無効なタブは飛ばします。
            </p>
          </TabPanel>
          <TabPanel value="b">
            <input
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
              placeholder="何か入力して、別のタブへ行って戻ってみてください"
            />
          </TabPanel>
          <TabPanel value="c">
            <p className="text-sm text-muted-fg">ここには来られません。</p>
          </TabPanel>
          <TabPanel value="d">
            <p className="text-sm text-muted-fg">
              既定では隠すだけなので、上の入力は残っています。
              <code className="text-fg">unmountInactive</code> を付けると消えます。
            </p>
          </TabPanel>
        </Tabs>

        <Tabs
          items={Array.from({ length: 12 }, (_, i) => ({
            value: `t${i}`,
            label: `タブ ${i + 1}`,
          }))}
          value={manual}
          onValueChange={setManual}
          activation="manual"
          label="たくさんある例"
        />
        <p className="text-xs text-muted-fg">
          ↑ 12 個あるので横スクロールします（manual: 矢印で動かしても切り替わりません）
        </p>
      </Stack>
    </Panel>
  );
}

/* ================================================================ */

function DisclosureSection() {
  return (
    <Panel
      title="Disclosure / Accordion"
      description={
        <>
          <code className="text-fg">&lt;details&gt;</code> です。
          <strong className="text-fg">JavaScript を切っても開閉します。</strong>
          Ctrl+F のページ内検索が閉じた中身も見つけてくれるのも、
          自前で作ると失うものです。1 つだけ開く動きは{" "}
          <code className="text-fg">name</code> 属性でブラウザに任せています。
        </>
      }
      code={`<Disclosure summary="送料について">3,000 円以上で無料です。</Disclosure>

<Accordion items={[{ summary: "…", content: "…" }]} />`}
    >
      <Stack space="md">
        <div className="rounded-lg border border-border bg-card px-md">
          <Disclosure summary="単体で使う（複数開けます）">
            <p>中身です。矢印は開くと 180 度回ります。</p>
          </Disclosure>
          <Disclosure summary="もう 1 つ">
            <p>両方開けます。</p>
          </Disclosure>
        </div>

        <Accordion
          items={[
            {
              summary: "支払い方法は？",
              content: "カードと銀行振込です。",
              defaultOpen: true,
            },
            { summary: "返品できますか？", content: "8 日以内なら可能です。" },
            { summary: "領収書は出ますか？", content: "マイページから出せます。" },
          ]}
        />
        <p className="text-xs text-muted-fg">
          ↑ こちらは 1 つ開くと他が閉じます（JS ではなく HTML の機能です）
        </p>
      </Stack>
    </Panel>
  );
}

/* ================================================================ */

function MenuSection() {
  const toast = useToast();

  return (
    <Panel
      title="DropdownMenu / NavDropdown"
      description={
        <>
          見た目は同じでも別部品にしています。
          <strong className="text-fg">
            押すと何かが起きるのか、どこかへ行くのか
          </strong>
          で読み上げが変わるためです。
          <code className="text-fg">role="menu"</code>{" "}
          はアプリの命令用で、リンクの集まりに付けると「リンクだと分からなくなる」
          という壊れ方をします。
        </>
      }
      code={`// 命令 → role="menu" / "menuitem"
<DropdownMenu label="操作" items={[{ label: "複製", onSelect: dup }]} />

// リンク → ただの <ul><li><a>
<NavDropdown label="製品" items={[{ label: "料金", href: "/pricing" }]} />`}
    >
      <Inline space="md" alignY="center">
        <DropdownMenu
          label="操作"
          items={[
            { label: "複製する", onSelect: () => toast.show({ tone: "success", title: "複製しました" }) },
            { label: "書き出す", onSelect: () => toast.show({ tone: "info", title: "書き出しました" }) },
            { separator: true },
            {
              label: "削除する",
              tone: "danger",
              onSelect: () => toast.show({ tone: "danger", title: "削除しました" }),
            },
          ]}
        />
        <NavDropdown
          label="製品"
          items={[
            { label: "機能一覧", href: "#features" },
            { label: "料金", href: "#pricing", current: true },
            { label: "導入事例", href: "#cases" },
          ]}
        />
      </Inline>
    </Panel>
  );
}
