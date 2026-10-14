# Web workbench design

The approved design of cland's web workbench for v0.2 (map M-399; tickets Q-404 and Q-406, both accepted by the human on 2026-10-14). Q-404 is the five boards of the shell, accepted as canvas version 7. Q-406 is the four phone boards. This folder mirrors canvas version 9, which holds all nine boards after a consistency pass (see the reactions below). The boards live on a design canvas, https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6, private to the human's current account. Their sources are kept in this folder so that they move between accounts. Authoritative order when sources disagree:

1. `docs/spec/v0.2.md`, sections 3.2 (the shell), 3.4 (threads and actions), 3.6 (notifications and the phone) and 3.8 (scope of 0.2.0): the decided design in words.
2. The behaviour of the read-only React prototype of the shell on branch `prototype/web-shell` (map ticket Q-405; the branch's `web/PROTOTYPE.md` says how to run it). The prototype is throwaway code: a reference, never something to merge.
3. The boards in this folder, for visual intent: colours, type, density, what each area shows.

The Neovim workbench keeps its boards in `docs/design/main-screen/`. The web boards start from their tokens and glyphs, freed from the console grid (see the visual vocabulary below).

## Files

- `Main.dc.html`: the shell and the entry screen. The rail is expanded with the seven areas and Items current. The Items header carries the view switcher (Tree, Board, Graph, Plan) and the scope, and its buttons wrap onto a second row when the row runs out of room. The explorer tree stands at the release root R-228 with the live epics by rank, each row with its ordinal, and the done ones after them, E-271 unfolded under its stages, the cursor on T-347, Direct tasks, Categories with Bugs open and the other roots folded. The card of T-347 is in the drawer with Split and Close; its quick message goes to General, with a switch, or `M`, to the item's topic. Below the shell sit the proposals legend and the palette on ⌘K drawn apart (Q-404; proposals P1 to P9).
- `Thread.dc.html`: the Topics area with the rail collapsed to icons. Pane 1 holds the topic list in groups (what waits for you, the standing topics General and Agents, the topics opened under items, the closed ones folded) and the T-347 thread: a watch-layer report, an answered ask folded to one line, the human's message in its band, two folded agent runs, a not-clear verdict with its criteria marks and an artifact chip, the open ask card with its two options, an inline HTML artifact and the composer. Pane 2 holds the card of T-347, narrow, and the drawer is closed (Q-404; P10 to P16).
- `Inbox.dc.html`: the inbox on the now layer at 09:40, after the night run. Eleven rows wait in the four sections of v0.1.2 §3.7, newest first, each header a name and a count. The selected ask is unfolded in place with its option buttons and a free answer, the plan approvals section is empty, and the events line and the archive line sit below. The drawer shows the ask's topic thread (Q-404; P17 to P19).
- `Sessions.dc.html`: the Sessions area. The accounts block is a strip of five cells, one per account with its worst window, claude-b limited until 15:00, and a link to the Accounts area. The verify line is opened into the queue view. The groups follow: Yours, Waiting, Busy, Idle (folded) and Stopped. impl-398 is selected and expanded, and the drawer shows its thread, its pending approval and a composer (Q-404; P20 to P23).
- `Phone.dc.html`: the first phone board, at 390x844, drawn with the desktop ones. The inbox is dimmed behind the T-347 ask, open as a bottom sheet, with the bottom bar of four areas below it (Q-404; P24 and P25). It predates the Q-406 boards: its bar has no More and its sheet no Decline.
- `PhoneHome.dc.html`: the installed app's home at 14:12, disconnected. The inbox is home: a strip says Disconnected since 14:10 with the next retry and Retry; the four sections keep their headers, two of them empty at 0; a Claude Code approval is marked "answer in Neovim"; a reply draft is kept as unsent with Send disabled; the events line and the archive line close the list; the More sheet stands above the bar with Items, Artifacts and Accounts, read-only (Q-406; P26 and P39 to P42).
- `PhoneAsk.dc.html`: answering an ask on a phone. The T-385 row is open as a bottom sheet that rides on the keyboard, with two 44 px option buttons and the field in decline mode (Reason to decline, Answer instead, a red Decline); the E-386 row above it is folded in place to its outcome (Q-406; P36 to P38).
- `PhoneThread.dc.html`: a thread on a phone. The T-347 topic fills the screen with a back control to Topics and a button to the card: rev-23's not-clear verdict with its criteria marks and an artifact chip, a folded run in two lines, the answered ask folded, the human's queued message with Withdraw, the kind sheet (Message, Decision, Question) rising from the composer, and the composer in two rows above the bottom bar (Q-406; P31 to P35).
- `PhoneSessions.dc.html`: the sessions on a phone. The header counts, the accounts strip of five cells, the verify line with its chevron, then the groups Yours, Waiting, Busy (folded) and Idle in two-line rows, a waiting row adding the command it waits on (Q-406; P27 to P30).
- `canvas.json`: the artboard layout of the web design canvas: the five boards of Q-404 side by side, the four phone boards of Q-406 in a row below them, with their positions, sizes, titles and order, and the two title notes.
- `screens/`: PNG renders `v02-main.png`, `v02-thread.png`, `v02-inbox.png` and `v02-sessions.png` at 1440 wide and each board's full height, and `v02-phone.png`, `v02-phone-home.png`, `v02-phone-ask.png`, `v02-phone-thread.png` and `v02-phone-sessions.png` at 390x844.

The data on the boards is the tracker as it stood on 2026-10-14 (R-228 and its epics, the tasks of E-271, T-347 with its round 11 verdict), with a few statuses adapted so that every state appears once. The phone boards show one afternoon of the same day, with sessions of the same crew. The session and inbox rows are written in the crew's tone and are not copied from the journal.

The boards load `./support.js`, which the canvas runtime provides. Opened from disk a board renders without it, as plain markup with Golos Text and JetBrains Mono from Google Fonts. That is enough to read it, and it is what the PNGs show.

## Proposals accepted on 2026-10-14

Each proposal is a white `proposal Pn` sticker on its board with the full note as its tooltip; the desktop boards also list each one in a legend below the shell. The human accepted P1 to P25 with the desktop boards (Q-404) and P26 to P42 with the phone boards (Q-406), both on 2026-10-14. Spec v0.2 §3.2 records the first set in brief, §3.4 the rules of threads and asks, and §3.6 the second set. Where a later decision changed a proposal, its line says so.

### Desktop boards (P1 to P25, Q-404)

- P1, the rail: the seven areas of §3.2 as words in the spec's order (Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts), a count only where something asks for attention (the inbox in amber, busy sessions in teal, new events in the watch colour), the key on hover and focus.
- P2, the top strip: the project, the release chip that switches the release (the Items area and its views follow it), search on ⌘K, the Coordinator's chip, the needs-you pill (the inbox count in amber, a green check at zero), the hub's live dot and `?` for the keys.
- P3, the prose font: Golos Text for prose, for its legibility at 12 to 14 px and its Cyrillic; JetBrains Mono for ids, counts, times, keys and code; sentence-case headings.
- P4, focus and hover: the keyboard cursor is the focus, with the selection background and a 2 px blue ring, and the card follows it; hover only lightens a row and a click moves both.
- P5, the explorer grid: the tree's columns on one grid under a sticky header; one cell per child up to 16 children, one proportional bar with its counts beyond (it amends the v0.1.2 explorer's P5, one cell per task).
- P6, the drawer: the card of the row under the cursor, with Split (⌘Enter) and Close (Esc); closed when nothing is selected, never an empty placeholder.
- P7, the palette: a centred panel over the dimmed shell, on ⌘K or Space p; one input, the five prefixes, results grouped in the order of v0.1 §3.11 with the matches in blue; Enter opens, ⌘Enter opens in a pane, Tab changes the kind.
- P8, the quick message: one line on the card, focused by `m`; it goes to the Coordinator in General with the item's context, and the switch beside it, or `M`, sends it to the item's topic instead, creating it when the item has none (the `m` and `M` of the Neovim build); the item and the card line ride along.
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
- P20, the accounts block: a compact strip of cells in the registry's order, each with the account's name and harness and its worst window (the highest used share with its reset time) as a short meter along the cell's foot; amber from 75 percent and red from 90; a limited account turns red and shows its reset and the session that hit it; an account without data shows a dash and never 0 percent; the other windows, the reading's age and its source are in the tooltip, and the registry and the limits live in the Accounts area (P28 is its phone form).
- P21, the queue view: the verify line opens in place into the local slot, the remote slots with their droplets, the waiters in order with the executor each asked for, their wait and ETA, and the metrics of the last 20 runs.
- P22, session rows: a table of glyph, name, role, harness, model and account, the item with its hold and +N, the state with its age, and the usage; the selected row opens Open thread, Stop, Resume, Archive and Capabilities in place; no Attach in 0.2.0.
- P23, the session drawer: the session's recent thread, its pending approval as a card (Approve once, Approve always for this command, Deny with a note) and a composer; the hub relays the choice to the harness.
- P24, the bottom bar: at phone width a bottom bar replaces the rail, with Inbox, Topics, Sessions and Events and their counts; P26 adds More, so the first phone board shows four slots; Board, Graph and Plan stay desktop first.
- P25, the ask sheet: an ask opens as a bottom sheet over the inbox with the question, the options as full-width buttons at least 48 px tall with their numbers, a free answer with Send answer, and the thread one tap away (P36 and P37 refine it for the keyboard and for declining).

### Phone boards (P26 to P42, Q-406)

- P26, the bottom bar: Inbox, Topics, Sessions, Events and More, with their counts; More opens a small sheet above the bar, without a scrim, with Items, Artifacts and Accounts, each read-only; search stays in the header (it amends P24).
- P27, the session row: two lines of 52 px, the glyph, the name and the role in its colour with the state and its age at the right, then the harness and the item (the claim, a verifier's hold with its role and +N, or a requested item dimmed until the hold exists); a waiting row adds its command; model, account and usage move to the session's page.
- P28, the accounts strip: one strip of cells in the registry's order, each with the name, the window of the highest used share with that share, and a thin meter along the foot, amber from 75 percent and red from 90; a limited account turns red with its reset; an account without data shows a dash; a tap opens Accounts, read-only.
- P29, the queue view: the verify line keeps its one-line summary and opens the queue view as a full-height sheet, since the in-place table of P21 is too wide.
- P30, session actions: no row actions and no swipe actions; Stop, Resume, Archive and Capabilities sit on the session's page, and Stop and Archive ask for a confirmation.
- P31, the thread screen: a topic opens full screen with a back control to Topics (the browser's back does the same), the title, the topic's id and status, and a button to the item's card, read-only; the bottom bar stays with Topics current.
- P32, the folded run: two lines, the sessions and the message count, then the latest message's kind and first words with its age; the hub builds both from facts; a tap unfolds the run in place and keeps the anchor line on top.
- P33, the composer: docked above the bottom bar in two rows, the kind chip and the addressee chip, then the text and Send; on a touch keyboard return breaks the line and only Send sends.
- P34, the kind sheet: the kind chip opens a small sheet that rises from the composer with Message, Decision and Question as three large buttons, the current one checked; no scrim, and the thread moves up by the sheet's height.
- P35, the queued message: a message to a busy session shows its queued mark under the text with a 44 px Withdraw until the turn starts; Withdraw puts the text back into the composer as a draft.
- P36, the keyboard: when the free-answer field takes focus the ask sheet rides on the keyboard; the question clamps to three lines, the options stay full width at 44 px, and the field with its button sits right above the keyboard; the tapped row stays selected behind the sheet.
- P37, Decline: it sits on the free-answer field's label row, never on a swipe, the scrim or Escape; it turns the field into a reason field and Send answer into a red Decline that stays disabled until a reason is typed; Answer instead turns it back.
- P38, the answered row: an ask answered from any client folds its row in place to one line with the option, who answered and when; the row stays until the human leaves the inbox and then moves to the archive.
- P39, the installed app: the manifest opens the installed app on the inbox, standalone, in the panel colour; installed over HTTPS through the human's tunnel, the app's badge carries the needs-you count.
- P40, the inbox as home: the four sections of v0.1.2 §3.7 in order, each header a 44 px fold button with its count; an empty section keeps its header with 0; with every section at 0 the title reads Nothing needs you in green with a check; the events line and the archive line close the list.
- P41, the disconnected state: when the socket drops a strip under the header says since when and when the next retry runs, with Retry; the last snapshot stays on screen with its time; answers, approvals and Send are disabled and nothing is queued, because another client may answer first; on reconnect the client resumes from its sequence number.
- P42, the reply draft: tapping a message row unfolds it in place with a reply to the sender in the row's topic; the draft is kept in the browser per topic and survives a disconnection and a reload; while disconnected Send is disabled and the label row says unsent.

## Reactions applied on the canvas

The human reacted on the canvas the same day, and four changes were applied before the desktop boards were accepted. Spec v0.2 §3.2 records each as a rule.

- Standing topics apart from item topics: General and Agents are listed apart from the topics opened under items, so the two are told apart at a glance (applied on the Thread board).
- Folds remembered per client: every group and block folds, with a chevron and the keyboard, and the folded state is remembered per client in the browser (applied on the Sessions board: chevrons on Accounts and on every group, Idle drawn folded).
- No explanatory prose in the interface: headers carry a name and a count, rows carry facts, and what a block means lives behind `?` and in tooltips (applied on the Sessions board: the accounts caption and the group headers' layer notes removed).
- Board, Graph and Plan are views of the Items area, not areas: the rail is Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts, and the Items header carries the view switcher Tree, Board, Graph and Plan, which keeps the scope, the filter and the selection (applied on all four desktop boards).

The spec states each as a rule for the whole interface. A board shows a rule only where it was applied.

After the phone boards were accepted, the desktop boards and the first phone board were aligned with the decisions of the spec and of Q-406 in a consistency pass, which this folder holds as canvas version 9. The stickers were reworded: P1 and P2 name the seven areas and the views of Items, P8 follows the quick-message rule, P20 describes the accounts strip, and P24 says that P26 adds More. The Sessions board draws the accounts block as a strip of cells with a link to the Accounts area. The quick message on the card goes to General with the item's context and a switch, or `M`, sends it to the item's topic (v0.1.2 §3.8). The rank fact left the card and the explorer rows carry their ordinal by rank, since the spec shows the raw rank only when it was set by hand. The hint lines under the inbox section headers were removed under the no-prose rule. The "Ask me later" option left the ask cards on the Thread, Inbox and Phone boards, since declining is an answer with a reason and not a deferral (§3.4). The Items header on the Main board wraps onto a second row when its controls run out of room.

## Where the boards are behind the spec

As of canvas version 9. On each point the spec wins (the order above). The consistency pass removed the earlier differences (the area counts in the stickers, the accounts block, the quick message, the rank fact, the inbox hints and "Ask me later"); these remain.

- No board draws the Accounts area (the registry and the limits of §3.2), the Events or Artifacts areas, or the Board, Graph and Plan views of Items. At phone width the Topics list and the Events filters are not drawn, nor are three rules of §3.6: a waiting plan shown as a row, an inline HTML artifact shown as a chip, and the notification switches in More.
- Declining is drawn on the phone only (P37). The ask card on the Thread board and the unfolded row on the Inbox board have no Decline control and no reason field, although §3.4 declines with a reason on its own key. The hint lines on the Thread card and in the Inbox drawer still read "1 to 3", from the days when "Ask me later" was the third option; the asks drawn have two options.
- The folded runs on the desktop boards (P13) show the sessions, the message count and the time span. §3.4 builds the fold line from who, how many messages, the latest step and the age, as P32 draws it on the phone.
- `Phone.dc.html` is the first phone board and predates Q-406: its bottom bar has four slots and no More (P26), and its ask sheet has no Decline on the field's label row (P37). `PhoneHome.dc.html` and `PhoneAsk.dc.html` are the reference for both.

## Visual vocabulary

The web boards keep the tokens of the main-screen boards: dark ground `#0b0e14`, panels `#10141b`, borders `#222a35`, text `#d6dbe4`, muted `#8a94a3`; amber `#f0b429` for what needs the human, teal `#35c4a0` for in progress and agent activity, green `#7ddc8a` for done, clear and ready, red `#ff7b72` for died and not clear, blue `#6aa5ff` for links, selection and the human's own messages; the glyphs ○ ◐ ◉ ● ◌ ▲ ? ✗ ✓ ✓✓. No emoji. They add:

- Golos Text for prose (titles, summaries, messages, labels and buttons; legible at 12 to 14 px, with the full Cyrillic the human's own messages may need) and JetBrains Mono for ids, glyph columns, counts, times, keys and code. Headings are sentence case in the prose face and the console's tracked capitals retire. Ids never break at the hyphen.
- The focus ring: the keyboard cursor is the focus, a row with the selection background `#182131` and a 2 px ring in `#6aa5ff` drawn inside its edge. Controls take the same ring on `:focus-visible`, offset by 1 px. Hover only lightens a row to `#131923` and never moves the cursor.
- The done colour `#98bfa2`: green-tinted and dimmer than live text, it carries the title of a done row beside its green glyph, with no strikethrough (as on the v0.1.2 boards, spec v0.1.2 §3.3).
- The watch colour `#c2a15e` for the watch layer and for what changed since the human's last look, as on the console boards: the new-events count, the events line and the small gold tags that mark a rule the canvas or the spec had already decided (`views of Items` on the Main board, `folds remembered` on the Sessions and PhoneSessions boards, `spec §3.8` on PhoneHome).
- The text grey raised to 4.5:1: all secondary text is the muted `#8a94a3`, which reads 6.3:1 on the ground and 5.26:1 on the selection background at the lowest. The console's faint grey `#5b6472` (3.2:1) is not used for text.
- The role colours are the build's, from `nvim/lua/cland/hl.lua`: violet `#bc8cff` for Implementers, pink `#f778ba` for Reviewers, sky `#56d4dd` for QA. The v0.1 Thread board used other values. In a thread the role is a 3 px bar in its own gutter column.
- White `proposal Pn` stickers, as on the v0.1.2 boards, mark the choices the spec leaves open.

## Re-rendering the PNGs

Each board was rendered with headless Chrome at 1440 wide and the height from `canvas.json` (390x844 for the five phone boards), one fresh profile per board:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --user-data-dir=<fresh scratch profile> --window-size=1440,<height> \
  --screenshot=<out.png> "file://<absolute path of the board>"
```

Chrome may not exit on its own: wait for the file, then stop only the processes that carry that profile directory.

## Republishing the canvas

The canvas is a Design artifact. This folder holds everything needed to publish it again, on the same account or on another one.

1. Copy `canvas.json` and the nine `*.dc.html` files into a scratch folder under `project/`, the layout the canvas keeps: `<scratch>/project/canvas.json`, `<scratch>/project/Main.dc.html` and so on.
2. Publish with the Artifact tool: `root` is the scratch folder, `file_path` is `project/canvas.json`, and `files` maps each `project/<Board>.dc.html` to itself. Pass the canvas link as `url` to update it in place, after reading the artifact once (the tool refuses to publish over a page the session has not read).
3. On an account that does not have the canvas, create a Design artifact first (a quickstart call with intent `design` lists the type; publish with its `type_url` and a title, no files), then run step 2 with the `url` it returns.
