# Web workbench design

The approved design of cland's web workbench for v0.2 (map M-399, ticket Q-404, accepted by the human on 2026-10-14 as canvas version 7). The boards live on a design canvas, https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6, private to the human's current account. Their sources are kept in this folder so that they move between accounts. Authoritative order when sources disagree:

1. `docs/spec/v0.2.md`, sections 3.2 (the shell), 3.4 (threads and actions) and 3.6 (notifications and the phone): the decided design in words.
2. The behaviour of the React prototype on branch `prototype/web-shell` once it exists (map ticket Q-405). The prototype is throwaway code: a reference, never something to merge.
3. The boards in this folder, for visual intent: colours, type, density, what each area shows.

The Neovim workbench keeps its boards in `docs/design/main-screen/`. The web boards start from their tokens and glyphs, freed from the console grid (see the visual vocabulary below).

## Files

- `Main.dc.html`: the shell and the entry screen. The rail is expanded with the seven areas and Items current. The Items header carries the view switcher (Tree, Board, Graph, Plan) and the scope. The explorer tree stands at the release root R-228 with the live epics by rank and the done ones after them, E-271 unfolded under its stages, the cursor on T-347, Direct tasks, Categories with Bugs open and the other roots folded. The card of T-347 is in the drawer with Split and Close. Below the shell sit the proposals legend and the palette on ⌘K drawn apart (map ticket Q-404; proposals P1 to P9).
- `Thread.dc.html`: the Topics area with the rail collapsed to icons. Pane 1 holds the topic list in groups (what waits for you, the standing topics General and Agents, the topics opened under items, the closed ones folded) and the T-347 thread: a watch-layer report, an answered ask folded to one line, the human's message in its band, two folded agent runs, a not-clear verdict with its criteria marks and an artifact chip, the open ask card, an inline HTML artifact and the composer. Pane 2 holds the card of T-347, narrow, and the drawer is closed (Q-404; P10 to P16).
- `Inbox.dc.html`: the inbox on the now layer at 09:40, after the night run. Eleven rows wait in the four sections of v0.1.2 §3.7, newest first. The selected ask is unfolded in place with its option buttons and a free answer, the plan approvals section is empty, and the events line and the archive line sit below. The drawer shows the ask's topic thread (Q-404; P17 to P19).
- `Sessions.dc.html`: the Sessions area. The accounts block shows the meters, with claude-b limited until 15:00. The verify line is opened into the queue view. The groups follow: Yours, Waiting, Busy, Idle (folded) and Stopped. impl-398 is selected and expanded, and the drawer shows its thread, its pending approval and a composer (Q-404; P20 to P23).
- `Phone.dc.html`: the phone at 390x844. The inbox is dimmed behind the T-347 ask, open as a bottom sheet, with the bottom bar of four areas below it (Q-404; P24 and P25; it previews map ticket Q-406, the phone-width mockups).
- `canvas.json`: the artboard layout of the web design canvas: the five boards side by side with their positions, sizes, titles and order, and the title note.
- `screens/`: PNG renders `v02-main.png`, `v02-thread.png`, `v02-inbox.png` and `v02-sessions.png` at 1440 wide and each board's full height, and `v02-phone.png` at 390x844.

The data on the boards is the tracker as it stood on 2026-10-14 (R-228 and its epics, the tasks of E-271, T-347 with its round 11 verdict), with a few statuses adapted so that every state appears once. The session and inbox rows are written in the crew's tone and are not copied from the journal.

The boards load `./support.js`, which the canvas runtime provides. Opened from disk a board renders without it, as plain markup with Golos Text and JetBrains Mono from Google Fonts. That is enough to read it, and it is what the PNGs show.

## Proposals accepted on 2026-10-14

Each proposal is a white `proposal Pn` sticker on its board with the full note as its tooltip, and one line in the board's legend. The human accepted the five boards with P1 to P25. Spec v0.2 §3.2, §3.4 and §3.6 record them.

- P1, the rail: the seven areas of §3.2 as words in the spec's order (Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts), a count only where something asks for attention (the inbox in amber, busy sessions in teal, new events in the watch colour), the key on hover and focus.
- P2, the top strip: the project, the release chip that switches the release, search on ⌘K, the Coordinator's chip, the needs-you pill (the inbox count in amber, a green check at zero), the hub's live dot and `?` for the keys.
- P3, the prose font: Golos Text for prose, for its legibility at 12 to 14 px and its Cyrillic; JetBrains Mono for ids, counts, times, keys and code; sentence-case headings.
- P4, focus and hover: the keyboard cursor is the focus, with the selection background and a 2 px blue ring, and the card follows it; hover only lightens a row and a click moves both.
- P5, the explorer grid: the tree's columns on one grid under a sticky header; one cell per child up to 16 children, one proportional bar with its counts beyond (it amends the v0.1.2 explorer's P5, one cell per task).
- P6, the drawer: the card of the row under the cursor, with Split (⌘Enter) and Close (Esc); closed when nothing is selected, never an empty placeholder.
- P7, the palette: a centred panel over the dimmed shell, on ⌘K or Space p; one input, the five prefixes, results grouped in the order of v0.1 §3.11 with the matches in blue; Enter opens, ⌘Enter opens in a pane, Tab changes the kind.
- P8, the quick message: one line on the card, focused by `m`; it goes to the Coordinator in the item's topic, with a switch to send to General; the item and the card line ride along.
- P9, the card: the blocks of v0.1.2 §3.9 in their order under sentence-case headings, criteria that wrap with their mark and round, the latest verdict in a box bordered all round in its colour and never a coloured left edge.
- P10, the collapsed rail: a 60 px column of stroke icons with count badges and tooltips; a button at its foot toggles it; it collapses by itself below 1280 px and while the main area is split, and the browser keeps the choice.
- P11, the split: ⌘\ splits the main area into two panes and ⌘Enter on a row opens it in the other; each pane has Swap and Close, the divider drags (2:1 by default), and the drawer stays closed while split.
- P12, the message block: a header (sender, role in its colour, addressees, kind, time, delivery stage) over a Markdown body; the role colour is a 3 px bar in its own gutter, the human's band spans the row, no message is a boxed card, watch-layer messages dim.
- P13, the folded run: one quiet row with both sessions, the message count and the time span; Enter, a click or `za` unfolds it in place; asks, verdicts, answers and anything to or from the human never fold.
- P14, the ask card: an amber card with the question and each option as a button with its number key (a click or the key answers at once), a free answer with Send answer, and a link to the same ask in the inbox; an answered ask folds to one line.
- P15, the inline HTML artifact: fixed at 240 px in a sandboxed iframe (scripts allowed, same-origin and top navigation not) under a header with Open full and Open in a pane; a file or folder artifact stays a chip.
- P16, the composer: the addressee as a chip (the Coordinator by default in an item's topic, `@` mentions a session), the send kind as a segmented control (Message, Decision, Question); Enter sends, Shift+Enter breaks a line, `~` attaches an artifact.
- P17, inbox rows: a table of glyph, subject, text, the sender in the role colour and the waiting age at the right; the selected row unfolds in place with real buttons, and `r`, `d` and Enter work as in Neovim.
- P18, the empty section: it stays, as one muted line that says what would land there.
- P19, the inbox drawer: it follows the selected row with the thread of its topic, scrolled to the row's message, and a one-line reply at its foot; for an approval it shows the session's recent thread.
- P20, the accounts block: a table of accounts with a meter per window (the used share and the reset time), the reading's age and its source; amber at 75 percent and red at 90; a limited account fills its row in red; a missing window stays absent and never reads 0 percent.
- P21, the queue view: the verify line opens in place into the local slot, the remote slots with their droplets, the waiters in order with the executor each asked for, their wait and ETA, and the metrics of the last 20 runs.
- P22, session rows: a table of glyph, name, role, harness, model and account, the item with its hold and +N, the state with its age, and the usage; the selected row opens Open thread, Stop, Resume, Archive and Capabilities in place; no Attach in 0.2.0.
- P23, the session drawer: the session's recent thread, its pending approval as a card (Approve once, Approve always for this command, Deny with a note) and a composer; the hub relays the choice to the harness.
- P24, the bottom bar: at phone width Inbox, Topics, Sessions and Events with their counts replace the rail; the planning views, Artifacts and Accounts are reached through search and open read-only.
- P25, the ask sheet: an ask opens as a bottom sheet over the inbox with the question, the options as full-width buttons at least 48 px tall with their numbers, a free answer with Send answer, and the thread one tap away.

## Reactions applied on the canvas

The human reacted on the canvas the same day, and four changes were applied before the boards were accepted. Spec v0.2 §3.2 records each as a rule.

- Standing topics apart from item topics: General and Agents are listed apart from the topics opened under items, so the two are told apart at a glance (applied on the Thread board).
- Folds remembered per client: every group and block folds, with a chevron and the keyboard, and the folded state is remembered per client in the browser (applied on the Sessions board: chevrons on Accounts and on every group, Idle drawn folded).
- No explanatory prose in the interface: headers carry a name and a count, rows carry facts, and what a block means lives behind `?` and in tooltips (applied on the Sessions board: the accounts caption and the group headers' layer notes removed).
- Board, Graph and Plan are views of the Items area, not areas: the rail is Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts, and the Items header carries the view switcher Tree, Board, Graph and Plan, which keeps the scope, the filter and the selection (applied on all four desktop boards).

The spec states each as a rule for the whole interface. A board shows a rule only where it was applied.

## Where the boards are behind the spec

As of canvas version 7. On each point the spec wins (the order above).

- The text of the P1 and P24 stickers predates the fourth reaction: it counts ten areas and names Explorer, Board, Plan and Graph among them. The rail drawn on the boards has the seven areas of §3.2.
- The Sessions board draws the whole accounts block (P20). Spec §3.2 gives the registry and the limits to the Accounts area and keeps a compact strip of meters in Sessions. No board draws the Accounts area.
- The quick message on the card (P8) goes to the item's topic and switches to General. Spec §3.4 follows v0.1.2 §3.8: `m` sends to General with the item context and `M` to the item's topic.
- The Rank fact on the cards reads "1st live of 8 in E-271". Spec §3.2 shows the rank fact only when it was set by hand.
- The Inbox section headers still carry a hint line each, which the no-prose rule of §3.2 moves behind `?` and into tooltips.

## Visual vocabulary

The web boards keep the tokens of the main-screen boards: dark ground `#0b0e14`, panels `#10141b`, borders `#222a35`, text `#d6dbe4`, muted `#8a94a3`; amber `#f0b429` for what needs the human, teal `#35c4a0` for in progress and agent activity, green `#7ddc8a` for done, clear and ready, red `#ff7b72` for died and not clear, blue `#6aa5ff` for links, selection and the human's own messages; the glyphs ○ ◐ ◉ ● ◌ ▲ ? ✗ ✓ ✓✓. No emoji. They add:

- Golos Text for prose (titles, summaries, messages, labels and buttons; legible at 12 to 14 px, with the full Cyrillic the human's own messages may need) and JetBrains Mono for ids, glyph columns, counts, times, keys and code. Headings are sentence case in the prose face and the console's tracked capitals retire. Ids never break at the hyphen.
- The focus ring: the keyboard cursor is the focus, a row with the selection background `#182131` and a 2 px ring in `#6aa5ff` with a 1 px offset. Hover only lightens a row to `#131923` and never moves the cursor.
- The done colour `#98bfa2`: green-tinted and dimmer than live text, it carries the title of a done row beside its green glyph, with no strikethrough (as on the v0.1.2 boards, spec v0.1.2 §3.3).
- The watch colour `#c2a15e` for the watch layer and for what changed since the human's last look, as on the console boards: the new-events count, the events line and the small gold stickers that mark where a reaction was applied (`views of Items` on the Main board, `folds remembered` on the Sessions board).
- The text grey raised to 4.5:1: all secondary text is the muted `#8a94a3`, which reads 6.3:1 on the ground and 5.26:1 on the selection background at the lowest. The console's faint grey `#5b6472` (3.2:1) is not used for text.
- The role colours are the build's, from `nvim/lua/cland/hl.lua`: violet `#bc8cff` for Implementers, pink `#f778ba` for Reviewers, sky `#56d4dd` for QA. The v0.1 Thread board used other values. In a thread the role is a 3 px bar in its own gutter column.
- White `proposal Pn` stickers, as on the v0.1.2 boards, mark the choices the spec leaves open.

## Re-rendering the PNGs

Each board was rendered with headless Chrome at 1440 wide and the height from `canvas.json` (390x844 for the phone), one fresh profile per board:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --user-data-dir=<fresh scratch profile> --window-size=1440,<height> \
  --screenshot=<out.png> "file://<absolute path of the board>"
```

Chrome may not exit on its own: wait for the file, then stop only the processes that carry that profile directory.

## Republishing the canvas

The canvas is a Design artifact. This folder holds everything needed to publish it again, on the same account or on another one.

1. Copy `canvas.json` and the five `*.dc.html` files into a scratch folder under `project/`, the layout the canvas keeps: `<scratch>/project/canvas.json`, `<scratch>/project/Main.dc.html` and so on.
2. Publish with the Artifact tool: `root` is the scratch folder, `file_path` is `project/canvas.json`, and `files` maps each `project/<Board>.dc.html` to itself. Pass the canvas link as `url` to update it in place, after reading the artifact once (the tool refuses to publish over a page the session has not read).
3. On an account that does not have the canvas, create a Design artifact first (a quickstart call with intent `design` lists the type; publish with its `type_url` and a title, no files), then run step 2 with the `url` it returns.
