# Popover

`Popover` は trigger のそばへ、補助的で non-modal な内容を出します。開閉の配線、
外側 pointer と Esc で閉じること、focus 復帰、viewport 端での配置を引き受けます。
中身の意味上の role やアプリの状態は決めません。

*[English version](popover.md)*

```bash
npx shadcn add Nasu726/Nasu-Stack/popover
```

一般的な使い方では trigger の文言をそのまま渡します。button の意味と focus 先は
Nasu Stack が用意します。

```tsx
import { Popover } from "@/components/ui/popover";

<Popover trigger="詳細" align="end">
  <p>最終更新は 5 分前です。</p>
</Popover>;
```

content は DOM 上で trigger のすぐ後ろに残ります。開いたときの focus は trigger に
置いたままなので、次の Tab で focus 可能な中身へ自然に入れます。Esc で閉じると
trigger へ戻ります。外側を pointer で選んだときは、その移動先から focus を奪いません。

## 自分の trigger と、content から閉じる方法

既存の button を使う escape hatch は関数形式です。渡された props はすべて展開し、
実際の button を描画して `ref` を転送してください。ref が無いと focus 復帰と実寸計測が
成立しません。

```tsx
<Popover
  trigger={(props) => <Button {...props}>詳細</Button>}
  placement="below"
>
  {({ close }) => (
    <Stack>
      <p>補足情報</p>
      <Button onClick={close}>完了</Button>
    </Stack>
  )}
</Popover>
```

`placement="above" | "below" | "auto"` は希望であって、viewport 外へ出す許可では
ありません。希望側に入らず反対側のほうが広ければ反転します。
`align="start" | "center" | "end"` は最初の横位置を決め、実測した panel が端から
出る場合は viewport 内へ戻します。縦に長い内容には実測した最大高が付き、panel の
内側だけがスクロールします。

## controlled state

別の操作やアプリの state が表示を所有するなら `open` と `onOpenChange` を使います。
`defaultOpen` は uncontrolled な初期値だけに使います。

```tsx
const [open, setOpen] = useState(false);

<Popover open={open} onOpenChange={setOpen} trigger="詳細">
  ...
</Popover>
```

理由が必要なら、`onOpenChange` の第 2 引数で `"trigger"`、`"content"`、
`"escape"`、`"outside"` も受け取れます。

## 責任境界

`Popover` は中立な disclosure surface であり、万能 overlay ではありません。

- アプリの命令と menu keyboard model には `DropdownMenu` を使う
- 値の選択には `Select` または `AsyncSelect` を使う
- modal、focus trap、ブラウザの top layer には `Dialog` を使う
- accessible name や不可欠な情報を隠して Tooltip の代わりにしない

この component は意図的に portal しません。trigger と content を一緒に置くことで、
Tab 順序、copy-and-own の markup、SSR を素直に保つためです。祖先に
`overflow: hidden`、`clip`、または切り取る scroll area があれば、そこでは切れます。
Popover をその container の外へ移すか、本当に top layer の内容なら `Dialog` を使って
ください。中身の見出し、label、validation、選択、業務 state はアプリの責任です。

既存の専門 component では、下位の geometry / dismissal hook として `usePopover` を
引き続き使えます。`anchorRef` と `floatingRef` の両方を付け、`floatingStyle` を適用して
ください。そうしない場合は従来どおり、高さの見積もりによる向きの判断だけになります。
