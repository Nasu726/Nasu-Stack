# CopyButtonとuseCopy

[English](copy-button.md)

`CopyButton`は明示的なbutton操作の後に1つの文字列をコピーし、copy中・成功・失敗を
読み上げ可能な状態で返します。`useCopy`は見た目を決めずに同じ状態を提供します。

```tsx
import { CopyButton } from "@/components/ui/copy-button";

<CopyButton text={shareUrl}>リンクをコピー</CopyButton>
```

write中の連打は無視します。成功は既定で2秒後にidleへ戻ります。結果を残す場合は
`resetAfter={null}`、時間を変える場合は0以上の値を渡します。

## 言語と独自content

Nasu Stackはappのlocaleを所有しないため、読み上げ文言の既定値は英語です。`labels`は
画面に見える各状態、`announcements`はlive regionの文言を変更します。

```tsx
<CopyButton
  text={shareUrl}
  labels={{ copying: "リンクをコピー中…", success: "リンクをコピーしました" }}
  announcements={{ success: "記事のリンクをクリップボードへコピーしました" }}
>
  記事のリンクをコピー
</CopyButton>
```

全状態の見た目を自分で決める場合はrender関数を渡します。contextが公開するのはclipboardの
state・method・error・`reset()`だけです。

```tsx
<CopyButton text={token} resetAfter={null}>
  {({ status, reset }) => (
    <>{status === "success" ? "コピー済み — もう一度押せます" : "コピー"}</>
  )}
</CopyButton>
```

## 1段下へ降りる

```tsx
import { useCopy } from "@/hooks/use-copy";

const copy = useCopy({ resetAfter: 1500 });

<button disabled={copy.isCopying} onClick={() => void copy.copy(text)}>
  独自UIでコピー
</button>
```

Reactを使わない処理では、`copyText(text)`がClipboard API / fallbackのどちらで成功したかを
返します。

## fallbackと境界

- 最初に新しいClipboard APIを試します。無い・拒否された場合だけ、read-onlyなtextareaを
  短時間画面外へ作り、legacyなbrowser copy commandを試します。結果にかかわらずtextareaを
  削除し、focusと選択範囲を戻します。
- fallbackは互換性であり、permissionの迂回ではありません。両経路をbrowserが拒否した場合は
  `error`になり、buttonをretry可能なまま残します。
- 秘密情報・個人情報・期限つきtoken・隠れた文字をコピーしてよいかはNasu Stackには判断
  できません。applicationが正確な文字列を選び、漏えいに関わる場合は意図的な利用者操作を
  必須にします。
- clipboard writeはabortできません。`reset()`は進行中writeを取り消したように見せず、連打は
  settleするまでlockします。
- callbackの失敗で、完了済みclipboard writeを失敗へ呼び替えません。

必要な層だけ導入できます。

```bash
npx shadcn add Nasu726/Nasu-Stack/copy-button
npx shadcn add Nasu726/Nasu-Stack/use-copy
```
