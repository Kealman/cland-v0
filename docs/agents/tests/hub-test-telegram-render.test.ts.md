# hub/test/telegram-render.test.ts

T1 calls the public text-conversion boundary, `plainParts(header, markdown)`.
Run this file alone with `node --test hub/test/telegram-render.test.ts`.
No sockets, processes, clock, credentials or browser are involved.

The 101-span case retains each literal body span exactly once, including the
header's share of the hundred-entity budget. Oversized fenced code becomes
plain body text rather than clipped code entities; reconstruct every body
character and count Unicode code points including the repeated header and
numbering. Retain the emoji control: a missing block boundary must not turn
the `lastIndexOf` sentinel into a split through a surrogate pair.

The worked heading/table/code/quote/list/link example checks literal text,
styles and link/language metadata. Production formatting uses UTF-16 offsets;
the component fallback test checks their exact numeric values beside emoji.
Conversion exceptions retain the original Markdown as plain body text.

The quoted-code/link regression retains literal UTF-16 offsets and link metadata,
dropping the outer quote style when it would illegally contain code or a link.
Emphasis-only quotes keep their quote entity. The flag-table control retains
`--force` and its payload; only a complete second-row separator with matching
cells is omitted. The fence control preserves literal fence-prefixed text,
wrong markers, shorter runs and four-space indentation as code content, closing
only on a complete permitted line. These controls follow
[Telegram entity restrictions](https://core.telegram.org/bots/api#formatting-options)
and [GFM tables/fences](https://github.github.com/gfm/).

This boundary proves conversion and splitting, not Telegram rendering or network
acceptance. Keep the production frame/fake receipts in
[telegram-rendering](hub-test-telegram-rendering.test.ts.md).
