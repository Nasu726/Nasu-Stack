# Popover

`Popover` places supporting, non-modal content beside a trigger. It owns the
open state wiring, outside pointer and Escape dismissal, focus return, and
viewport-edge positioning. It deliberately does not choose the content's
semantic role or application state.

*[日本語版はこちら](popover.ja.md)*

```bash
npx shadcn add Nasu726/Nasu-Stack/popover
```

For the common case, pass the trigger label directly. Nasu Stack supplies the
button semantics and focus target:

```tsx
import { Popover } from "@/components/ui/popover";

<Popover trigger="Details" align="end">
  <p>Last updated five minutes ago.</p>
</Popover>;
```

The content stays immediately after the trigger in DOM order. Opening it keeps
focus on the trigger, so the next Tab enters any focusable content naturally.
Escape closes it and returns focus to the trigger. An outside pointer closes it
without stealing focus from the place the user selected.

## Custom triggers and closing from content

A function trigger is the escape hatch for an existing button. Spread every
provided prop; the component must render a real button and forward `ref`.
Without the ref, focus recovery and measurement cannot work.

```tsx
<Popover
  trigger={(props) => <Button {...props}>Details</Button>}
  placement="below"
>
  {({ close }) => (
    <Stack>
      <p>Supporting information</p>
      <Button onClick={close}>Done</Button>
    </Stack>
  )}
</Popover>
```

`placement="above" | "below" | "auto"` is a preference, not permission to
overflow the viewport. If the preferred side cannot fit and the other side has
more room, the component flips. `align="start" | "center" | "end"` controls
the initial horizontal alignment; the measured panel is shifted back inside
the viewport when necessary. Tall content receives a measured maximum height
and scrolls inside the panel.

## Controlled state

Use `open` and `onOpenChange` when another control or application state owns
visibility. Use `defaultOpen` only for an uncontrolled initial value.

```tsx
const [open, setOpen] = useState(false);

<Popover open={open} onOpenChange={setOpen} trigger="Details">
  ...
</Popover>
```

`onOpenChange` also receives `"trigger"`, `"content"`, `"escape"`, or
`"outside"` as its second argument when the reason matters.

## Responsibility boundary

`Popover` is a neutral disclosure surface, not a universal overlay:

- use `DropdownMenu` for application commands and its menu keyboard model;
- use `Select` or `AsyncSelect` for choosing a value;
- use `Dialog` for modal content, focus trapping, and the browser top layer;
- do not turn this into a tooltip by hiding an accessible name or essential
  information behind it.

The component intentionally does not portal. Keeping trigger and content
together preserves predictable Tab order, copy-and-own markup, and simple SSR.
An ancestor with `overflow: hidden`, `clip`, or a clipping scroll area can still
cut it off. Move the popover outside that clipping container, or use `Dialog`
when the content genuinely belongs in the top layer. The application owns the
content's headings, labels, validation, selection, and business state.

For an existing specialized component, `usePopover` remains available as the
lower-level geometry and dismissal hook. Attach both `anchorRef` and
`floatingRef`, and apply `floatingStyle`; otherwise it can only make the older
estimated-height placement decision.
