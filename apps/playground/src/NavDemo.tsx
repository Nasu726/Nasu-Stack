import * as React from "react";
import { Panel } from "./Panel";
import { Button } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Accordion, Disclosure } from "@/components/ui/disclosure";
import { DropdownMenu, NavDropdown } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { Paginator } from "@/components/ui/paginator";
import { SiteHeader, SkipLink } from "@/components/ui/site-nav";
import { SiteFooter } from "@/components/ui/site-footer";
import { useToast } from "@/components/ui/toast";
import { Inline, Stack } from "@/components/ui/layout";
import { t } from "./lang";

const NAV = [
  { href: "#a", label: t("製品") },
  { href: "#b", label: t("料金") },
  { href: "#c", label: t("会社概要") },
  // external の見本。**実際に飛ぶ先なので、実在して差し支えない URL にします。**
  // example.com は表記用に予約された名前ですが、IANA の説明ページが本当に出ます。
  { href: "https://github.com/Nasu726/Nasu-Stack", label: "GitHub", external: true },
];

export function NavDemo() {
  return (
    <Stack space="3xl">
      <HeaderSection />
      {/* メニューは**下に余白がある位置に置きます。**
          最下部だと必ず上向きに開くので、
          「入り切らないときだけ上に出す」動きが見られません。 */}
      <MenuSection />
      <PopoverSection />
      <PaginatorSection />
      <DialogSection />
      <TabsSection />
      <DisclosureSection />
      <FooterSection />
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
          {t("狭い画面のメニューは")} <code className="text-fg">&lt;details&gt;</code>{" "}
          {t("です。")}<strong className="text-fg">{t("JavaScript が 1 行も要りません。")}</strong>
          {t("Astro に置くとき")} <code className="text-fg">client:</code>{" "}
          {t("を付けなくても開閉します。読み込みの遅い回線で「押しても何も起きない数秒」が\r\n          生まれないのが理由です。Esc で閉じる処理だけ JS\r\n          で足していますが、無くてももう一度押せば閉じます。")}
        </>
      }
      code={t("<SkipLink />\n<SiteHeader\n  brand=\"Example Studio\"\n  items={[{ href: \"/works\", label: \"Works\" }]}\n  currentPath={Astro.url.pathname}   // ルーターに依存しない\n  actions={<ThemeSwitcher />}\n/>")}
    >
      <Stack space="xs">
        {/* **行長を止めます。** 器いっぱいだと英語で 1 行 150 字を超えます
            （和文は全角なので上限に当たらず、訳すまで気づけませんでした）。 */}
        <p className="max-w-[var(--width-prose)] text-xs text-muted-fg">
          {t("下は実物です（sticky は切ってあります）。画面を狭くするとハンバーガーに変わります。")}
        </p>
        <p className="max-w-[var(--width-prose)] text-xs text-muted-fg">
          {t("このヘッダは")} <code className="text-fg">z-30</code>{" "}
          {t("です。ページの一部として埋め込むときは、")}
          <strong className="text-fg">{t("外側の枠をそれより手前に置いてください。")}</strong>
          {t("このカタログ自身のヘッダを")} <code className="text-fg">z-40</code>{" "}
          {t("にしているのはそのためです。")}
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
            actions={<SkipLink href="#catalog-panel">{t("本文へ")}</SkipLink>}
          />
          <div className="p-md text-xs text-muted-fg">
            {t("ヘッダの下の中身。「料金」に")}{" "}
            <code className="text-fg">aria-current="page"</code> {t("が付いています。")}
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
          {t("ブラウザ標準の")} <code className="text-fg">&lt;dialog&gt;</code>{" "}
          {t("を使うので、フォーカスの閉じ込め・背面の無効化・Esc・最前面表示は\r\n          ブラウザ任せです。")}
          <strong className="text-fg">
            {t("ただし背面のスクロールだけは止まらない")}
          </strong>
          {t("ので、そこだけ自分で止めています。開閉で画面が横に揺れないよう、\r\n          スクロールバーの幅は常に確保してあります。")}
        </>
      }
      code={t("<Dialog open={open} onOpenChange={setOpen} title=\"設定\">\n  中身\n</Dialog>\n\n// 端から出すシート（狭い画面のメニューなどに）\n<Dialog placement=\"sheet-right\" ... />")}
    >
      <Inline space="xs">
        <Button onClick={() => setCenter(true)}>{t("中央に出す")}</Button>
        <Button variant="outline" onClick={() => setSheet(true)}>
          {t("右から出す")}
        </Button>
      </Inline>

      <Dialog
        open={center}
        onOpenChange={setCenter}
        title={t("通知の設定")}
        description={t("ここは説明文です。読み上げにも渡されます。")}
        footer={
          <Inline space="xs" align="end">
            <Button variant="outline" onClick={() => setCenter(false)}>
              {t("閉じる")}
            </Button>
            <Button
              onClick={() => {
                setCenter(false);
                toast.show({ tone: "success", title: t("保存しました") });
              }}
            >
              {t("保存する")}
            </Button>
          </Inline>
        }
      >
        <p className="text-sm text-muted-fg">
          {t("この裏側は押せません。Tab を何度押してもここから出ません。")}
        </p>
      </Dialog>

      <Dialog
        open={sheet}
        onOpenChange={setSheet}
        placement="sheet-right"
        title={t("シート")}
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
          {t("このカタログ上部のタブも、これに差し替えました。")}
          <strong className="text-fg">{t("矢印キーで移動できるのが本体")}</strong>{t("で、\r\n          Tab キーで止まるのは選択中の 1 つだけです（roving tabindex）。\r\n          入りきらないときは潰さずに横スクロールします。")}
        </>
      }
      code={t("<Tabs items={items} value={tab} onValueChange={setTab}>\n  <TabPanel value=\"a\">…</TabPanel>\n</Tabs>\n\n// 切り替えが重いときは manual（Enter を押すまで切り替えない）\n<Tabs activation=\"manual\" ... />")}
    >
      <Stack space="md">
        <Tabs
          items={[
            { value: "a", label: t("概要") },
            { value: "b", label: t("詳細") },
            { value: "c", label: t("使えない"), disabled: true },
            { value: "d", label: t("履歴") },
          ]}
          label={t("例")}
        >
          <TabPanel value="a">
            <p className="max-w-[var(--width-prose)] text-sm text-muted-fg">
              {t("← → で移動、Home / End で端へ。無効なタブは飛ばします。")}
            </p>
          </TabPanel>
          <TabPanel value="b">
            <input
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
              placeholder={t("何か入力して、別のタブへ行って戻ってみてください")}
            />
          </TabPanel>
          <TabPanel value="c">
            <p className="text-sm text-muted-fg">{t("ここには来られません。")}</p>
          </TabPanel>
          <TabPanel value="d">
            <p className="text-sm text-muted-fg">
              {t("既定では隠すだけなので、上の入力は残っています。")}
              <code className="text-fg">unmountInactive</code> {t("を付けると消えます。")}
            </p>
          </TabPanel>
        </Tabs>

        <Tabs
          items={Array.from({ length: 12 }, (_, i) => ({
            value: `t${i}`,
            label: t("タブ {0}").replace("{0}", String(i + 1)),
          }))}
          value={manual}
          onValueChange={setManual}
          activation="manual"
          label={t("たくさんある例")}
        />
        <p className="max-w-[var(--width-prose)] text-xs text-muted-fg">
          {t("↑ 12 個あるので横スクロールします（manual: 矢印で動かしても切り替わりません）")}
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
          <code className="text-fg">&lt;details&gt;</code> {t("です。")}
          <strong className="text-fg">{t("JavaScript を切っても開閉します。")}</strong>
          {t("Ctrl+F のページ内検索が閉じた中身も見つけてくれるのも、\r\n          自前で作ると失うものです。1 つだけ開く動きは")}{" "}
          <code className="text-fg">name</code> {t("属性でブラウザに任せています。")}
        </>
      }
      code={t("<Disclosure summary=\"送料について\">3,000 円以上で無料です。</Disclosure>\n\n<Accordion items={[{ summary: \"…\", content: \"…\" }]} />")}
    >
      <Stack space="md">
        <div className="rounded-lg border border-border bg-card px-md">
          <Disclosure summary={t("単体で使う（複数開けます）")}>
            <p>{t("中身です。矢印は開くと 180 度回ります。")}</p>
          </Disclosure>
          <Disclosure summary={t("もう 1 つ")}>
            <p>{t("両方開けます。")}</p>
          </Disclosure>
        </div>

        <Accordion
          items={[
            {
              summary: t("支払い方法は？"),
              content: t("カードと銀行振込です。"),
              defaultOpen: true,
            },
            { summary: t("返品できますか？"), content: t("8 日以内なら可能です。") },
            { summary: t("領収書は出ますか？"), content: t("マイページから出せます。") },
          ]}
        />
        <p className="text-xs text-muted-fg">
          {t("↑ こちらは 1 つ開くと他が閉じます（JS ではなく HTML の機能です）")}
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
          {t("見た目は同じでも別部品にしています。")}
          <strong className="text-fg">
            {t("押すと何かが起きるのか、どこかへ行くのか")}
          </strong>
          {t("で読み上げが変わるためです。")}
          <code className="text-fg">role="menu"</code>{" "}
          {t("はアプリの命令用で、リンクの集まりに付けると「リンクだと分からなくなる」\r\n          という壊れ方をします。")}
        </>
      }
      code={t("// 命令 → role=\"menu\" / \"menuitem\"\n<DropdownMenu label=\"操作\" items={[{ label: \"複製\", onSelect: dup }]} />\n\n// リンク → ただの <ul><li><a>\n<NavDropdown label=\"製品\" items={[{ label: \"料金\", href: \"/pricing\" }]} />")}
    >
      <Inline space="md" alignY="center">
        <DropdownMenu
          label={t("操作")}
          items={[
            { label: t("複製する"), onSelect: () => toast.show({ tone: "success", title: t("複製しました") }) },
            { label: t("書き出す"), onSelect: () => toast.show({ tone: "info", title: t("書き出しました") }) },
            { separator: true },
            {
              label: t("削除する"),
              tone: "danger",
              onSelect: () => toast.show({ tone: "danger", title: t("削除しました") }),
            },
          ]}
        />
        <NavDropdown
          label={t("製品")}
          items={[
            { label: t("機能一覧"), href: "#features" },
            { label: t("料金"), href: "#pricing", current: true },
            { label: t("導入事例"), href: "#cases" },
          ]}
        />
      </Inline>
    </Panel>
  );
}

/* ================================================================ */

function PopoverSection() {
  const [controlledOpen, setControlledOpen] = React.useState(false);
  const [outsideCount, setOutsideCount] = React.useState(0);

  return (
    <Panel
      title="Popover"
      description={
        <>
          {t("triggerのそばへ補助的な内容を出し、外側pointer・Esc・focus復帰・viewport端の補正を引き受けます。")} {" "}
          <strong className="text-fg">
            {t("中身のroleや選択状態は決めません。")}
          </strong>{" "}
          {t("命令の一覧はDropdownMenu、modalな内容はDialogを使います。portalを使わないので、Tab順序はDOMのままです。")}
        </>
      }
      code={t("<Popover trigger=\"詳細\" placement=\"auto\" align=\"end\">\n  <p>最終更新は5分前です。</p>\n</Popover>\n\n// 自分のButtonを使うとき\n<Popover trigger={(props) => <Button {...props}>詳細</Button>}>…</Popover>")}
    >
      <Stack space="md">
        {/* 右端・長い中身・狭いviewportを同時に測れる位置へ置きます。 */}
        <div className="flex min-h-36 w-full items-end justify-end">
          <Popover
            trigger={t("詳細を表示")}
            placement="below"
            align="start"
            contentClassName="w-64"
          >
            {({ close }) => (
              <Stack space="sm" align="start">
                <p data-testid="popover-content">
                  {t("これは補足情報です。狭い画面の右端や最下部でも、読める範囲をviewport内へ残します。")}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={close}>
                  {t("内容から閉じる")}
                </Button>
              </Stack>
            )}
          </Popover>
        </div>

        <Inline space="xs" alignY="center">
          <Popover
            open={controlledOpen}
            onOpenChange={setControlledOpen}
            align="end"
            trigger={(props) => (
              <Button {...props} size="sm" variant="outline">
                {t("制御されたPopover")}
              </Button>
            )}
          >
            <p data-testid="popover-controlled-content">
              {t("openとonOpenChangeを親が所有しています。")}
            </p>
          </Popover>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setControlledOpen(!controlledOpen)}
          >
            {t("親から開閉")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="popover-outside-action"
            onClick={() => setOutsideCount((count) => count + 1)}
          >
            {t("外側の操作")} {outsideCount}
          </Button>
        </Inline>

        {/* defaultOpen の契約は見た目の見本と分け、DOMで退行を測ります。 */}
        <div hidden>
          <Popover
            defaultOpen
            closeOnEscape={false}
            closeOnOutside={false}
            trigger="default-open-probe"
          >
            <span data-testid="popover-default-open">open</span>
          </Popover>
        </div>
      </Stack>
    </Panel>
  );
}

/* ================================================================ */

const PAGINATOR_LABELS = {
  navigation: t("記事のページ"),
  previous: t("前のページ"),
  next: t("次のページ"),
  page: (page: number) =>
    t("ページ {0}").replace("{0}", String(page)),
};

function PaginatorSection() {
  const [page, setPage] = React.useState(500);

  return (
    <Panel
      title="Paginator"
      description={
        <>
          {t("移動先を本物のlinkとして残したまま、現在page・前後・巨大なpage数のellipsisを扱います。")}{" "}
          <strong className="text-fg">
            {t("totalの取得とURLの意味はapplicationの責任です。")}
          </strong>{" "}
          {t("client routerはmodifierのない通常clickだけを横取りし、新しいtabで開く経路を残します。")}
        </>
      }
      code={t("<Paginator\n  currentPage={page}\n  totalPages={1000}\n  getHref={(next) => `/articles?page=${next}`}\n/>\n\n// client routerを使う場合もhrefは残し、通常clickだけpreventDefaultします")}
    >
      <Stack space="md" id="paginator-demo">
        <Inline space="xs" alignY="center">
          <Button type="button" size="sm" variant="outline" onClick={() => setPage(1)}>
            {t("先頭へ")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPage(500)}>
            {t("中間へ")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPage(1000)}>
            {t("末尾へ")}
          </Button>
        </Inline>

        <Paginator
          data-testid="paginator-large"
          currentPage={page}
          totalPages={1000}
          getHref={(next) => `?tab=nav&page=${next}#paginator-demo`}
          onPageChange={(next, event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            ) return;
            event.preventDefault();
            setPage(next);
            const url = new URL(window.location.href);
            url.searchParams.set("page", String(next));
            url.hash = "paginator-demo";
            window.history.replaceState(null, "", url);
          }}
          labels={PAGINATOR_LABELS}
        />

        <p className="text-xs text-muted-fg">
          {t("現在: ページ {0}").replace("{0}", String(page))}
        </p>

        {/* 小さい総page数も同じpublic componentで測ります。hiddenなのは
            見本を重複して読ませず、DOM contractだけを回帰検査するためです。 */}
        <div hidden>
          <Paginator
            data-testid="paginator-one"
            currentPage={1}
            totalPages={1}
            getHref={(next) => `?page=${next}`}
            labels={PAGINATOR_LABELS}
          />
          <Paginator
            data-testid="paginator-five"
            currentPage={3}
            totalPages={5}
            getHref={(next) => `?page=${next}`}
            labels={PAGINATOR_LABELS}
          />
          <Paginator
            data-testid="paginator-hostile-count"
            currentPage={500_000_000}
            totalPages={1_000_000_000}
            siblingCount={1_000_000_000}
            boundaryCount={1_000_000_000}
            getHref={(next) => `?page=${next}`}
            labels={PAGINATOR_LABELS}
          />
        </div>
      </Stack>
    </Panel>
  );
}

/* ================================================================ */

/**
 * SiteFooter。**列が多いときに崩れないかを見るための題材です。**
 *
 * v0.9d で「説明文が幅を取ってリンクの列が縦に割れる」のを直しましたが、
 * そのとき試したのは 2 列だけでした。API は列数を制限していないので、
 * 6 列でも壊れないことを確かめられる形にしておきます。
 */
const FOOTER_GROUPS = [
  { label: t("プロダクト"), items: [{ href: "#a", label: t("機能一覧") }, { href: "#b", label: t("料金") }] },
  { label: t("開発者向け"), items: [{ href: "#c", label: t("ドキュメント") }, { href: "#d", label: "API" }] },
  { label: t("コミュニティ"), items: [{ href: "#e", label: t("フォーラム") }] },
  { label: t("サポート"), items: [{ href: "#f", label: t("問い合わせ") }] },
  { label: t("会社情報"), items: [{ href: "#g", label: t("会社概要") }] },
  { label: t("利用規約・法務"), items: [{ href: "#h", label: t("プライバシー") }] },
];

function FooterSection() {
  const [many, setMany] = React.useState(true);

  return (
    <Panel
      title="SiteFooter"
      description={
        <>
          <strong className="text-fg">{t("縮むのはリンクの列ではなく説明文です。")}</strong>
          {t("説明文は何行になっても読めますが、リンクの列は縦に割れると\r\n          「まとまり」が見えなくなります。列が増えて器に収まらなくなったら、\r\n          説明文を潰さずに次の行へ落とします。")}
        </>
      }
      code={t("<SiteFooter\n  brand=\"Example Studio\"\n  groups={[{ label: \"サイト\", items: [{ href: \"/blog\", label: \"ブログ\" }] }]}\n  note=\"© 2026 Example Studio\"\n/>")}
    >
      <Inline space="xs" alignY="center">
        {[
          [true, t("6 列")],
          [false, t("2 列")],
        ].map(([v, label]) => (
          <Button
            key={String(v)}
            size="sm"
            aria-pressed={many === v}
            variant={many === v ? "primary" : "outline"}
            onClick={() => setMany(v as boolean)}
          >
            {label as string}
          </Button>
        ))}
        <span className="text-xs text-muted-fg">
          {t("どちらでも、はみ出さず、列が縦に割れません")}
        </span>
      </Inline>

      <div className="rounded-lg border border-border" data-testid="footer-demo">
        <SiteFooter
          brand="Example Studio"
          description={t("静的なページは Astro、動く部分だけ React。この部品で組んだサイトの見本です。")}
          groups={many ? FOOTER_GROUPS : FOOTER_GROUPS.slice(0, 2)}
          note="© 2026 Example Studio"
          width="narrow"
        />
      </div>
    </Panel>
  );
}
