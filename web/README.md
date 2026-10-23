# Web workbench

`@cland/web` is the React 19/Vite workspace beside `hub`. The root owns the lockfile
and the existing TypeScript compilers; the web reuses `hub/bin/typecheck.ts`. Browser code
has the hub's strict flags plus DOM libraries, JSX, bundler resolution and
`vite/client` types, with no Node globals. Tooling has its own strict Node project.

From the repository root:

```sh
npm install                         # prepare builds web/dist
npm run typecheck                   # hub, Neovim, web and web guards
npm run build                       # production browser bundle
npm run watch --workspace web       # vite build --watch; reload the page
```

Open the workbench with `cland web` from the project. `cland web --no-open`
prints the one-time sign-in link instead of opening a browser. The edge trades
that link for an HttpOnly, SameSite=Strict cookie and redirects to `/`.
The shell connects to the same origin's `/ws` with a secret-free client hello;
its types come from `shared/wire/`. After the authenticated `hub.status` reply,
the top strip shows the project directory's name and a live dot. On disconnect
the dot turns down, keeping the project name, and the shell retries after 250 ms,
doubling to a 10 s cap. A successful status reply resets the backoff. Each
connection has a 5 s hello/status deadline. A hub restart reuses the edge port
and cookie, so an open shell reconnects without reloading when the bundle matches.
The entry HTML's `cland-build-stamp` meta tag and the web welcome's `buildStamp`
identify the same source digest. A mismatched page reloads once per target build
per tab; session storage bounds retries if old HTML persists. Without session
storage the page remains usable. A protocol refusal displays **Restart hub**
and stops reconnecting; restart it through the CLI or Neovim.

Verification's `npm run check` typechecks, builds `web/dist`, then runs static/test
lint. This build runs locally as well as remotely; remote prepare remains the
installation/Neovim step. `web/dist` is generated and ignored. Never commit it.
Install with development dependencies included: prepare needs Vite.
`hub/test/web-auth.test.ts` uses the shared build helper before standalone tests;
suite shards build before its worker even when Web is absent or unavailable.
This is required after remote delivery cleans ignored files while reusing
installed dependencies and the host check. Build failures name
`npm run build --workspace web`.
Vite checks local resource references and the fonts, then writes
`dist/build-stamp.json` with the input digest and build time. Doctor compares that
stamp with the installation's sources, including filenames and modification times;
changed, added, deleted or newer sources warn as stale. Run `npm run build` to refresh.
Watch builds use the same stamp hook. Inputs changing during a build refuse a stamp.
The welcome reads the served receipt at connection time, including a configured
`[web] dist`; a missing or invalid receipt is reported as `buildStamp: null`.

The development loop uses a build and reload, with E-412's same-origin web edge.
There is no Vite dev server or development bridge. The shell navigates the seven
areas through the rail or physical `Digit1`–`Digit7` keys. The main area has its
heading, the Items views, Topics with threads, and stand-in lists of remaining hub objects;
E-416 to E-418 replace the remaining lists with the full areas. Dashes represent
unavailable facts. The palette searches the shell’s actions and hub objects; help
shows the active area’s keys.
Ported from `prototype/web-shell`'s frame and tokens, slice by
slice, following spec v0.2 before prototype behaviour before the accepted boards.

## Components and colours

Copy `src/Shell.tsx` and `src/Shell.module.css`. Components use CSS Modules and
`var(--token)`; `src/tokens.css` is the sole colour-value file. The colour guard
scans every file below `src/` and rejects hex, rgb/rgba and hsl/hsla values elsewhere,
including a nested file named tokens.css. In-memory fixtures cover the rejected forms.
The typecheck runs that guard, contrast/role checks and oxlint with
`react/rules-of-hooks` and `react/exhaustive-deps` as errors; a scratch conditional-hook
fixture must fail the actual configured linter. No UI library or Tailwind is used;
the human approves every new dependency. See the root AGENTS.md web rule.

## Message Markdown

`src/markdown.ts` exports `parseMarkdown(message, { itemPrefixes })` and the
`MarkdownBlock`/`MarkdownInline` token unions. It has only ECMAScript types
(`tsconfig.markdown.json`), with no React, browser or package dependency. Parse
each message separately: even an unclosed fence ends at that message's end.
The default prefixes are T, E, R, Q, M, S and C; pass the configured tracker
prefixes (including T) for the current project. An item token carries the whole
id for the renderer's navigation and non-wrapping treatment.

Blocks are `heading` (level), `paragraph`, `quote`, `list` (ordered/start/items),
`code` (language/text) and `table` (literal text). Inline tokens are `text`,
`code`, `strong`, `em`, `link` (href/text) and `item` (id). Headings, paragraphs
and quotes carry inline `children`; each list item is an inline token array.
Render tokens as elements and text. Raw HTML and image syntax stay text; tables
and code bodies stay literal. Links allow only explicit http/https addresses;
unsupported destinations and syntax remain visible text. This subset does not
implement full CommonMark, nested lists, reference links or syntax highlighting.

Typecheck runs `check-html.ts` with seeded hostile-source fixtures, then scans
every source under `src/`. It refuses references to `dangerouslySetInnerHTML`,
`innerHTML`, `outerHTML` and `insertAdjacentHTML`, including bracket properties
and spread-object props through parentheses, assertions and non-null wrappers.
Named sink references are forbidden even for reads or
method aliases. Ordinary strings and comments are allowed. This is a source
guard, not a runtime HTML sanitizer. The T1 token contracts run with
`node --test hub/test/web-markdown.test.ts`.

`MessageBlock.tsx` renders the P12 message header, the 3 px role gutter, the
human/Aide band and the hub's watch layer. Watch text uses `--text-soft`; only
the decorative gutter uses opacity. Recorded review/QA results and criterion
marks read the hub's structured facts; legacy agent verdicts retain the first-line
convention. A clear verdict stays on one row. `Thread.tsx` inserts local-day
separators without changing message ids or the scrolling anchor.

Page artifacts in a thread use `artifact.url` from the authenticated browser
connection. HTML renders at 240 px in the shared `SandboxedArtifactFrame`, with
`sandbox="allow-scripts"` alone. Its header names the artifact; Open full follows
that capability address in a new tab without an opener, and Open in a pane opens
the artifact at full height beside the thread. This also works for artifacts older
than the loaded inventory page: their thread metadata is a viewer-only fallback,
kept out of the authoritative inventory and its counts. Files and folders remain chips; an unavailable
page remains a chip with the serving reason in its tooltip. A HEAD request checks
availability and HTML type before embedding. Disconnected pages fall back to
chips; reconnect mints a fresh capability.

The thread groups only messages carrying the hub's `runId`, using the supplied
`ThreadRun.foldLine` verbatim. A click, Enter or `za` opens or closes the run in
place; its anchor keeps its viewport position and stays pinned at the top while
scrolling through the open run. `j`/`k` visit the anchor and then its open messages.
Run state belongs to the mounted thread; expansion sends no hub command and
opens no drawer. Message deltas replace the same run's facts, updating closed
lines and adding messages to open runs. The hub excludes asks, answers, verdicts
and human/Aide traffic; the browser does not infer membership. A closed anchor
represents its last loaded message for visible read marks. Enter on message links
and other native controls keeps their own activation.

`AskCard.tsx` renders the same hub ask in a thread and in the Inbox's Asks and
approvals section. With the card or its thread row focused, physical `1`–`9`
answer immediately; `i` or `r` focuses the free answer. `d` switches to a required
reason and a red Decline button, and Answer instead restores answer mode. Escape
never answers or declines. Agent-directed asks show their receiving lead and have
no human answer controls. All bindings use the central key map and shell listener;
typing in an answer field keeps native text input.

Answers use the human `topic.answer` frame, whose durable hub record supplies the
chosen text/reason, answerer and time. Both views fold to that outcome, including
answers from another client. An Inbox fold stays until its mounted Inbox is left.
Sending
disables the card until receipt, a refusal preserves its draft, and disconnected
cards disable writes without replaying them. A refused race or a fresh snapshot
that omits a previously open ask uses bounded `topic.history` reads for its durable
record, independent of the Inbox archive's seven-day window. A loaded ask needs
one forward row; an Inbox-only ask first reads one row before its id, then one
row after that predecessor's numeric sequence. Only an exact id match is merged,
preserving newer live rows and counts. Answering
already marks the topic read in the hub; the browser sends no extra broad read.
The thread's In Inbox link opens the source pane's Inbox list and focuses the
same ask within that destination pane.

`MarkdownBody.tsx` renders the parser tokens as React elements, with external
links underlined and opened using `_blank` and `noopener noreferrer`. Whole item
tokens use the shared item navigation and never wrap at the hyphen; code stays
literal. Attached or posted artifacts show their id, kind and title. HTML pages
render inline in the sandboxed preview described above; files, folders and
unavailable pages remain chips.

All 23 normal foreground tokens, including every role, reach 4.5:1 on ground and
selection. The two dark ink tokens are inverse badge text checked on their bright
badge surfaces. Surface/line tokens are not text. Role colours match
`nvim/lua/cland/hl.lua`, including the raised hub grey. Names, counts and facts
belong on screen; explanations belong in help, tooltips and docs. All keyboard actions use `src/keymap.ts`: its single code/modifier table resolves
actions and supplies their displayed keys. `src/keyboard.ts` owns the only
raw keyboard listener; components receive actions. Fields, composition and
prevented events keep their keys, and reserved browser chords stay unbound.

## Rail and top strip

The rail shows Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts.
Badges report attention: Inbox uses the hub's needs-you count, Items pending
plans, Sessions approval waits and Topics human waits without an ask. Busy
sessions and ordinary inventory totals do not produce badges. The top strip
shows the project directory name, open-release picker, Coordinator name,
needs-you count (a green check at zero) and connection state. A nonzero
needs-you count prefixes the tab title. The Coordinator and needs-you controls
navigate to Sessions and Inbox respectively.

The connection negotiates snapshots, numbered deltas and slim frames. The initial
snapshot supplies tracker configuration, open item summaries and all non-task rows,
merged sessions, roles, the verification queue, topics, inbox, events and account
views. `hub.status` supplies the project name; one `session.list` reads adapter
capabilities and one `artifact.list` reads the artifact inventory per connection.
Item deltas replace or remove rows directly, without a `task.list` reread.
Reconnection resumes numbered deltas or takes fresh snapshots, retaining the
previous display while offline.
Inbox pushes update attention immediately; Coordinator changes refresh status.
Task deltas carry full verdict history: the client selects the latest per kind
and retains its history round, matching the snapshot projection. Any item
replacement/removal invalidates cached sibling orders for its old and new
parent before applying a fresh order supplied by a rank event.

## Topics and threads

Topics renders through `AreaSlot` with its own `topics` context. Waiting topics
come first, followed by General and Agents on the standing surface, open item
discussions (including unbound discussions), then Closed. Standing topics keep
their distinct row treatment when waiting. Groups use the shared `Fold`; Closed
starts folded, and saved explicit choices override that default. Rows show the
hub's unread count, item and latest message time, with the full timestamp in a
tooltip. Within each group, latest activity comes first.

Selecting a topic opens its thread beside the list, without a drawer. `j`/`k`
and the vertical arrows move across topics and group headers; Enter or `l`
enters the thread or unfolds a group, and `h` folds a group. In a thread,
`j`/`k` and the vertical arrows focus messages; `h` or Escape returns to the
topic list. `⌘Enter` opens the thread alone in the other pane. Help and palette
derive these actions from the same physical-code key map.

| Physical keys | Context | Action |
| --- | --- | --- |
| `j`, `k`, `↓`, `↑` | Topics list | Move across topics and group headers |
| `Enter`, `l` | Topics list | Enter thread or unfold group |
| `h` | Topics list | Fold topic group |
| `j`, `k`, `↓`, `↑` | Thread, including ask rows | Move across run anchors and visible messages |
| `Enter`, `za` | Thread, on a run anchor or message in that run | Toggle agent run in place; Enter on native controls keeps their activation |
| `h`, `Esc` | Thread | Return to topic list |
| `1`–`9` | Human-directed ask card or its thread row, outside fields | Answer with the corresponding option immediately |
| `i`, `r` | Human-directed ask card or its thread row, outside fields | Focus the free-answer field when available |
| `d` | Human-directed ask card or its thread row, outside fields | Switch to decline mode with a required reason; in decline mode, restore answer mode |
| `Esc` | Ask card | Never answer or decline; in a thread, return to topic list |

`topic-threads.ts` owns each topic's cached messages and hub-built run facts.
Threads open at their end with the latest 100 messages and request exclusive
numeric `before` pages on upward scrolling. Identity merges keep live messages
and newer delivery/ask facts when a page reply races them. Prepending keeps the
reader's top message in place, including when a live message arrives during the
fetch or an earlier-page error is retried. New messages follow the end only while the reader is already there.
Messages use the role-coloured blocks and Markdown described above, with verdict
and criterion marks, inline HTML artifacts, folded agent runs and shared ask cards.

The connection applies topic, message, delivery and ask frames directly; none
triggers a topic-list or history reread. Reconnect sends its last completed
snapshot/numbered-delta cursor and retains cached data during ring replay. A
fresh snapshot invalidates thread history; an open thread reloads its latest
page. A reset generation restarts a pending initial load even when its loaded
flag remains false; stale replies cannot populate the replacement cache. An
incomplete replacement snapshot cannot become a resume cursor.

After the same last visible message has been on screen for one continuous
second with the document visible, `topic.read` names that message explicitly.
Changing the last visible message, hiding, folding and disconnecting cancel an incomplete interval;
messages below the viewport stay unread. The hub's updated topic row supplies
the shared unread count. Failed writes are never replayed automatically.

## Inbox

Inbox shows the hub's Now rows in **Asks and approvals**, **Plan approvals**,
**Requests** and **Messages to you**, each newest first. Headers show the pending
count. An empty section stays as one muted header; a section with more than five
rows has a More line with the hidden count and oldest wait. Section folds persist
in browser preferences. Waiting ages update locally without polling the hub.
The hub already includes a waiting topic's latest message when it has no ask.

Focusing or selecting a row unfolds it in place. Asks use the shared card;
requests and messages show their full text and buttons; plans show stage, lane
and item counts. Enter opens the topic at that exact message, loading earlier
history pages when needed, or opens the epic's Plan view. Request decline tells
the sender; marking a message read removes only that message. A delayed action reply cannot replace
newer pushed Inbox rows or counts. The Events footer
counts every journal row since the human's shared last look and its warnings,
reading older pages until the mark is reached. It stays when all sections are
empty and opens Events. The full Events view follows in its own slice.

Approval rows offer only the native record's choices: Approve once, Always for
this command and Deny with an optional note. The hub supplies the attributed
outcome. Closed approval and ask rows stay folded for the Inbox visit. Missing pending
approvals on a fresh snapshot and refused answer races recover that exact id's
archived outcome; unavailable outcomes keep controls disabled. A selected ask
reached from its thread reveals its section and the rows beyond the five-row cap. A TUI-only
approval says **Answer in Neovim** and has no answer controls. Offline and pending
writes are disabled; no mutation is replayed after reconnect.

| Key | Inbox action |
| --- | --- |
| `j` / `↓`, `k` / `↑` | Next or previous visible row, fold or footer |
| `Enter` | Open topic/message or Plan; activate fold/footer controls |
| `d` | Decline request, mark message read, ask decline reason or approval denial note |
| `1`–`9` on an ask row | Answer with that option |
| `1`, `2` on an approval row | Approve once, always for this command |
| `i`, `r` on an ask row | Focus the free answer |
| `←`, `→` | Fold or unfold section |
| `?` | Inbox keys for the focused context |

Number keys keep shell area navigation outside ask and approval rows. Inputs keep
native typing. Reply composition, archive and the selected topic drawer follow
in T-1124–T-1126.

## Area modules and live state

`src/AreaSlot.tsx` registers each non-Items area as an `AreaModule`: `Pane` is
its list, `Page` is its detail in a pane (including ⌘Enter in the other pane),
and `Drawer` is its selected object's drawer. Every slot receives the current
`connection`, rows, selection and selection callback; pane controls expose handled
shortcuts through a ref. The module declares its key `context` and `handledActions`.
The shell's shared dispatcher, help and palette use those declarations. Declared actions remain inactive until their area implements them. Modules mark their own content with the matching `data-key-context`.

Sessions, Accounts and Artifacts live in `src/sessions/`, `src/accounts/` and
`src/artifacts/`. [Sessions](#sessions) owns its counts, grouped rows and unfolded
selection through `SessionsHeader` and `SessionGroups`. `SessionPage` shows the
session's model, account, usage and capabilities; it shares `SessionActions` with
the selected row. [Accounts](#accounts-strip-and-accounts-area) owns the registry,
limits and profile; `AccountsStrip` shows its account meters in Sessions.
`VerifyLine` owns the [verification summary and queue view](#verification-in-sessions).
[Artifacts](#artifacts) owns its grouped tree and sandboxed page/drawer viewer.
[Topics](#topics-and-threads) owns its grouped list and thread module.
[Inbox](#inbox) owns its four sections, selected row and actions. Events
remains a stand-in list; its full area is pending in E-417 stage 4. Items retains its
[tree and card](#items-tree) and [views](#items-views).

`ConnectionState` includes the state types from each area's `state.ts`:

| Area | Hub state available to its slots |
| --- | --- |
| Sessions | `sessions` (complete merged rows by stable key), `archivedSessions`, on-demand `archivedSessionRows`/`loadArchivedSessions`, inbox `sessionAsks`, `roles` including launch defaults, `adapters`, and `verification` with `queue` and client `receivedAt` milliseconds |
| Accounts, and the Sessions strip | `accounts`: registry path, optional registry error and complete views in registry order, including windows, source, reading time and limited mark |
| Accounts profile | `web.session`: this socket's browser sign-in creation, last use and fixed cookie expiry; separate from the harness account model |
| Artifacts | `artifacts`: complete inventory records, including status, author, kept and layer facts |
| Topics | `topics` with authoritative unread counts and read positions, `marks`, and the per-topic `threads` cache |

Session snapshots replace the merged rows, archived count, roles and queue.
`session.row` replaces/removes by stable key; usage updates match the launch ID,
and process/prune frames carry archived counts. Presence and process changes do
supply merged rows through `session.row`. Opening the archive reads
`session.list` with `archived: true`; archive and prune changes refresh that
loaded archive without composing raw process and presence facts in the browser.
`account` replaces one complete view at its registry position, `verification.queue`
replaces the queue and its receipt time, and `artifact` replaces one complete
record by ID, with no inventory reread; a moved artifact leaves the top-level
inventory, matching `artifact.list`. Visibility reprojects topics and artifacts
by ID together, without modern inventory rereads.
A resync reconnects, and fresh hub snapshots/inventories replace earlier state,
including clearing registry errors and rows absent from the new hub.

`hub/test/web-area-state.test.ts` tests the public connection callback at T1 with a
scripted WebSocket and fake time, using the shared wire types. It covers model
facts that do not yet have UI. `web/test/area-slots.test.ts` keeps the real hub,
production socket and isolated Headless Shell proof: all slots, delta delivery
without inventory requests, and a new hub's Sessions/Accounts without a reload.

## Verification in Sessions

The `verify:` line shows the local holder and running time, remote slots in use
against their budget, waiters and the next admission estimate. Click it or press
Enter on it to toggle the queue in place. The shared fold keys also work; the
open state is browser-only under the Sessions preferences and survives reload.

The queue lists the local holder's item, mode or occasion, PID, worktree, start,
running time and remaining ETA; each remote slot's droplet name, size, region and
start; and waiters in the hub's order with their requested executor, wait and
admission ETA. It includes the last 20 runs' run/wait median and p90. Opening the
view reads `executor.status` once for today's droplet spend and cap; it does not
poll the provider. A failed read keeps a dash with the error in its tooltip.

`src/sessions/verification.ts` is a pure queue/elapsed/status presentation model.
Snapshots and `verification.queue` deltas reset the client receipt time. A local
clock advances running and waiting durations without network reads. Estimates
keep the hub's durations and `~` marker, rather than counting down. Unknown
facts remain unknown. `hub/test/web-verification-model.test.ts` replays sealed
scratch frames at T1; `web/test/verification.test.ts` proves Enter, elapsed time
without frames, replacement, spend reads and fold persistence in Headless Shell.

## Artifacts

The Artifacts tree has **Mine** (the human’s and Aides’ artifacts), **Kept**,
**By role** (Coordinator, Implementers, Reviewers, QA and Other), and **Archived**.
By role, its role groups and Archived start folded. Each section shows its loaded
artifact count and remembers explicit folds in this browser. Folders sort before
files, then titles and ids. Rows show kind, id, title, creator, status and kept.
“This topic” joins in the notes slice.

`j` and ↓ move down through visible rows and section headers; ↑ moves up.
`k` toggles keep, `d` archives, and `A` toggles Archived. Enter toggles a section
or a folder. Folder files come from `artifact.list` only when unfolded and refresh
after reconnect or artifact metadata updates. Keep and archive use the hub’s
receipts and live `artifact` frames; offline writes are disabled and never replayed.
Archiving the human’s or an Aide’s artifact changes its layer and preserves its
files. **More artifacts** loads the next bounded inventory page, preserving newer
live rows and unique identities. Reload replaces the inventory.

Enter opens a page in the drawer, and ⌘Enter opens it in the other pane. The
shared `SandboxedArtifactFrame` fills the available height below the header;
its `sandbox` attribute is exactly `allow-scripts`, never `allow-same-origin`.
The viewer mints `artifact.url` through the authenticated web connection, checks
its capability URL over HTTP, and loads the frame from that URL. The hub adds
its own sandbox response policy. Scripts cannot read the workbench document or
cookies. The selected artifact id remains visible while capability reads load.
Folder children use the same capability with encoded relative paths.

Text files (including Markdown) open as literal text with a named download link;
binary files offer a named download. The response type selects the view; `.mmd`
and `.markdown` are text even when served as octet-stream. Missing files show
**Artifact file not found**. Offline previews remain; reconnect refreshes through
a new capability, and superseded reads cannot replace a later selection.
Diagram HTML and SVG use the sandboxed viewer; raw Mermaid `.mmd` stays source text with a download link, without rendering.

Attaching to the composer is the following slice. Creating, moving, promoting,
deleting and editing remain in Neovim and the CLI in 0.2.0.


## Items tree

The lowest open release version (or the release picker choice) is the root.
Epics appear by rank, followed by done epics in close order. Direct leaf items
sit under **Direct tasks (N)**. **Categories**, **Unscheduled** (maps first) and
**Other releases** start folded. Archived releases and root categories/items
appear with `A`; `D` hides done rows throughout the tree.

The hub supplies status glyphs, blocked and next facts, child counts, work counts,
the current stage, claims, holds and verdict rounds. Bars have one cell per child
up to 16 children and proportional segments beyond 16. Rows show their ordinal;
raw rank appears only when set by hand. An unfolded epic reads its plan once,
groups live tasks by stage, and puts done tasks after them in close order.
Changes to that epic refresh its plan. An unfolded category shows its top three
open items, a folded **N more**, open/done counts, the `idle_from` mark and a
count of done items hidden by `D`.

Closed task children pass through `ConnectionState.closedTasks(parent)` and
`loadClosed(parent)`, backed by bounded per-parent cursor pages. Progress and category totals keep
using the hub's counts when only part of the closed child list is loaded.

| Physical keys | Action |
| --- | --- |
| `j`, `k` | Move to the next or previous row |
| `l` | Unfold a row, or enter its children |
| `h` | Fold a row, or go to and fold its parent |
| `za` | Toggle the row's fold (a leaf folds its parent) |
| `D` | Hide/show done items |
| `A` | Show/hide archived roots |
| `s` | Scope to a container (a leaf uses its parent) |
| `Space Space` | Return to the previous scope |
| `x`, `Shift+j`, `Shift+k` | Toggle a selected row or extend the selection |
| `Esc` | Clear the row selection |
| `m`, `M` | Message General or the item topic |
| `gi`, `gt`, `gs` | Jump to the item, its topic or its session/Coordinator |
| `Enter` | Enter the card or return to the tree |
| `Esc`, `h` in the card | Return to its tree row |
| `e` on the card's Criteria block | Open criterion edits |
| `?` | Show the active area's keys |

The scope breadcrumbs open an ancestor or the project roots; each scope change
keeps a back-stack entry for `Space Space`. Scope and filters are shared with
other Items views; Tree, Board and Graph share the breadcrumbs and selection keys.
Selection and the back stack last for the page. Item ids in
card prose, relations, agents’ text and other detail text are links. Opening one switches to Tree,
resolves its canonical display id, loads missing closed ancestors through bounded
summary pages, unfolds its ancestors and focuses its row. A later navigation supersedes a
pending link lookup. `gi` also opens a
topic’s bound item; `gt` opens the existing item topic; `gs` opens the claimant
or the Coordinator in Sessions.

`m` focuses a one-line field in the card. Enter or Send posts the draft with one
context line per item, explicitly addressed to the Coordinator. Moving the cursor
to an unmarked row keeps the marked selection as the message context. `M` or **Item topic**
uses a task/epic topic, creating it when missing; a multiple-row selection always
goes to General. The field retains the draft on a failed send and never retries a
mutation automatically. Offline sending is disabled.

The card's **Criteria** button, or physical `e` while that block has focus, opens
single-line criterion fields. Add, Save, Remove and Mark done send `task.criterion`
with the authenticated human's authority. Criterion ids stay outside the text
field and are never reused after removal. A done mark names `human`; it cannot
be unchecked here. Opening the block reads `task.view` for the full criteria;
item deltas refresh the open block. Failed writes retain drafts and show their
reason in a tooltip; writes are disabled offline and never retried automatically.
Legacy criteria without persisted ids are read-only; their tooltip explains
that Add or a CLI criterion write assigns ids before they become editable.
Labels, body, status, rank and all other item fields remain read-only in Items;
labels and body are edited in Neovim. Messages and plan approval are separate actions.

Click a row to select it; click its chevron or double-click to fold/unfold it.
The current release stays unfolded. The browser keeps tree folds, `D` and `A`
under `cland.ui.items.v1`, alongside the area's other fold preferences. Two panes
share them; a different browser client starts independently. Folding and filtering
send no hub writes. Cursor identity survives item reordering across deltas.

The selected item's drawer shows its Summary and provenance, facts, progress,
plan stages, latest verdict (reason, round, scope and freshness), relations,
branch and latest verification, dates, last activity and Decision. The verdict
box uses the clear or failed colour. Facts use snapshots and deltas; a closed
item or closed verdict owner reads its deferred card facts through a bounded
by-id summary page. Moving across open rows sends no `task.view`.
The card's ordinal stays `—` until a full sibling-order receipt or completed
closed parent page supplies its position and total. It does not fetch hidden
siblings just to fill that fact. Changes with an unknown previous parent discard
cached sibling orders; loaded pages continue to follow the deltas.

**Agents’ text** starts folded, with section names and word count. Expanding it
fetches the body once; folding or reselecting reuses it. Item deltas and reconnects
invalidate the card/body cache and discard outstanding older replies. Enter on
a tree row focuses the card; Enter on the card itself, Escape or `h` returns to
that same row. In a split, Enter opens the card in the opposite pane; return keys restore the originating tree row, including after Swap. Buttons retain native Enter activation. Split and Close remain
available, and a split detail pane shows the same card.

`web/test/items.test.ts` copies the repository tracker into the scratch fixture
before starting its hub, then adds deterministic rows for ordering, stage groups,
bar modes and category/archive edges. A separate 300-item scratch fixture measures
the synchronous whole-model rebuild after a CLI status delta through the browser's
`cland.items.rebuild` PerformanceMeasure. The asserted 15 ms excludes fixture setup,
transport and the React DOM commit; the test separately observes the changed row
and both ancestor counts. It clears measures once before mutation and compares
the retained measures with an independent PerformanceObserver capture so that a
later fast rebuild cannot erase an earlier slow sample. This is a rebuild bound,
not a page latency claim.

`web/test/items-order.test.ts` keeps the rank-event → ordinary rank edit →
reparent regression in a seven-item scratch hub. It retains the same real
protocol/browser seam, request/DOM bounds and authoritative sibling comparison;
the copied-tracker test owns the large model. This keeps unrelated full-tracker
rescans outside the ordering regression's setup.

The button collapses the rail to a 60 px icon column; below 1280 px CSS forces
that width without overwriting the button choice. Icons keep native tooltips,
accessible names and attention badges. Keyboard focus has a 2 px blue ring on
the selection surface; hover only lightens a row. IDs use non-wrapping
JetBrains Mono.

Browser preferences use `src/interface-state.ts`, one `cland.ui.<area>.v1` key
per area. The shell's rail choice, selected area, release ID, pane contents and split ratio share
`cland.ui.shell.v1`. Reads, parsing and writes (including access to the storage
property) are guarded; invalid fields fall back independently and denied
storage leaves navigation working. This state is local to the browser and
never writes the hub's or Neovim's interface state.

## Items views

The Items header switches between Tree, Board, Graph and Plan. The view is a browser preference under
`cland.ui.items.v1`; changing it preserves the shared scope, done/archive filters
and selected item, including its drawer card. Split panes share the view preference.

Board groups tasks into status sections with counts. Rows carry the parent ID,
claim/hold and verdict marks, verified/total, blocked and next facts from the hub.

At release scope, epics start folded with authoritative done/total and status
breakdowns, including closed children that have not been loaded. Unfolding reads
closed children through bounded parent pages. Epic tabs narrow the Board without
changing its scope or replacing the release's next task. Direct tasks have their
own folded group; categories show their counts below the release.

Board uses the same `j`, `k`, `h`, `l`, `za`, `D`, `A` and card keys as Tree.
Its group folds are browser preferences independent of the tree folds. Board
offers no rank, top, move or drag action. Order follows the hub's hierarchy,
rank facts and sibling-order receipts; blocked and next are never inferred from
the visible rows.

`web/test/board.test.ts` uses one sealed hub and Headless Shell with a fresh
context for each criterion: the scoped Tree/Board round trip; folded release
counts, closed-child unfolding and epic tabs; and inert rank keys/mouse gestures
with unchanged hub ranks and parents.

Graph draws the current scope's direct children as SVG using the ported Neovim
layout and token colours. Sibling dependencies route between layers; unlinked
children sit below in a tray. Containers show hub done/total and in-work counts
(in progress, review, QA and ready); tasks show verified/total. Done nodes use
the done text colour and green check. Closed siblings load through bounded parent
pages; their progress uses hub totals without fetching their own children.
Clicking or focusing a node selects its item and drawer. `j`/`k` move between
nodes, Enter opens the card and Escape returns to that node. The shared `D`/`A`
filters, scope and selected item survive view changes; Tree and Board folds stay
independent from Graph.

## Split and drawer

Open and move panels through the central panel-home and placement helpers: homes are semantic, sizes belong to physical sides, and each window owns its size, mode and reading position. Extend the area's versioned preference key with independent validation, falling back only the malformed extension without losing unrelated fields (A-8634 R10; T-796, T-1000, T-1001, T-1002, T-1004, T-1005, T-995, T-996, T-997).

`⌘\` toggles a split of the main area, initially 2:1. Drag the divider to resize
between 20% and 80%. Each pane has Swap and Close; closing the primary pane keeps
the other pane's contents. Click or focus a pane to direct area navigation to it.
The rail collapses while split and restores the button choice on closing, subject
to the narrow-window rule. The split and ratio survive reloads in the shell's
versioned browser key; unavailable storage leaves them usable for the current page.

Selecting an item by click or keyboard focus opens its card in the drawer; other areas show the selected ID/title.
Close and Escape dismiss it until selection moves. Split or `⌘Enter` opens the
selected object in the other pane; the drawer stays closed during the split and
when it closes until a row is selected again. Swap carries each pane's area and
selection together. Escape sends no hub request and never answers an inbox row.
All three shortcuts use the shared physical-code map (`Meta+Backslash`,
`Meta+Enter`, `Escape`). The inventories expose no domain mutations; area modules consume the live model
described above, while the remaining stand-ins retain their existing reads.

## Palette and keys

Use native modal dialogs for overlays and keep stand-in objects free of mutation actions (A-8634 R10; T-1004, T-1005).

`⌘K` or `Space p` opens the palette over the dimmed, inert shell. `⌘K` also
works from a field without changing its draft. One input searches names and IDs
by case-insensitive character sequence; matching characters are blue. Results
stay grouped as Actions, Items, Sessions, Artifacts and Topics, with the best
match selected. Actions show their keys from `src/keymap.ts`. The prefixes `>`,
`#`, `@`, `~` and `/` select those five kinds in that order. The ordinary read-only
hub lists supply objects until the snapshot client lands; the palette sends no
mutation frame. The shell’s stand-in drawer/pane opens the chosen object.

| Key | Shell | Palette |
| --- | --- | --- |
| `1`–`7` | Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts in the active pane; focused ask cards and Inbox ask/approval rows use option keys instead | Type in the input |
| `⌘K`, `Space p` | Open palette (`Space p` outside fields) | `⌘K` keeps palette open |
| `?` | Show current area’s keys, outside fields | Type in the input |
| `⌘\` | Toggle split | — |
| `⌘Enter` | Open selected object in the other pane | Open result in the other pane |
| `Enter` | Native control activation | Open result or run action |
| `Tab`, `Shift+Tab` | Native focus navigation | Next/previous kind, retaining search |
| `↓`, `↑` | Native control behaviour | Next/previous result |
| `Esc` | Close help or drawer | Close without acting |

`src/keymap.ts` partitions the physical-code table into shell, Items (including
Plan), Topics, thread, ask, inbox, inbox-answer, events, composer, Sessions, Artifacts, Accounts and
modal contexts. The focused context resolves first, then the shell. Modifiers
must match exactly. The shell asks `focusedKeyContext` for a nested
`data-key-context` declaration, falling back to the active pane's area. A field
uses context bindings only when the field itself explicitly declares
one, for example `data-key-context="composer"`; ordinary fields keep native keys
and only `⌘K` opens the palette. Composer Enter, Shift+Enter and `⌘Enter` are
declared now, for the composer ticket to handle.

Every non-Items area renders through `src/AreaSlot.tsx`. Its `AreaModule` supplies
`Pane` and `Drawer` components, receives rows, selected identity and a selection
callback, and declares `handledActions`. A pane exposes its `AreaControls.run`
through the supplied controls ref. The stand-in modules handle no area actions.
Adding a key to an area's table reserves it but does not enable it: an unhandled
context key runs no action and never falls back to a shell binding; native
control activation is preserved. Declared fields reserve their context chords. An area opts in with `handledActions` when its component implements the
action. Labels live in `contextActions`; help and palette combine shell actions
with the handled actions, and derive the displayed chords from the focused
context's table. Sessions enables its implemented navigation and archive keys.
Its future action keys and Artifacts' keys remain reserved, including Artifacts' `k` for Keep and
`↑` for moving up.

The top-strip Palette and Help buttons expose the same overlays. Help names the
active pane’s area and lists the shell keys shared by all current stand-in areas;
area-specific keys use the same map. Help lists each action once, with the active area's label replacing the shared label for that action. Native modal
focus containment keeps background controls inert; dismissal restores focus.
The single `keyboard.ts` listener reads physical codes and exact modifiers,
including both strokes of `Space p`, so Cyrillic key values do not change actions.
Composition, already-handled events and ordinary field typing remain untouched.
The leader survives ordinary hub updates at the same focus target; it only
resolves outside fields and modals, in the same context, and is cleared by the next stroke.
Reserved browser window/tab shortcuts remain unbound.

## Sessions

Sessions reads the hub's merged rows from the snapshot and `session.row` deltas.
The header and the folds show Yours, Waiting, Busy, Idle and Stopped counts.
Live Aides belong to Yours; stopped Aides belong to Stopped. Waiting contains
both approval and human waits. Stopped shows the latest 20, newest first, and
the archived count. Each fold uses the browser's `cland.ui.sessions.v1` record;
folding sends no hub request.

A row shows its state glyph, name, role in its role colour, harness, model,
account, item, state and age, and cost or token usage. The hub supplies the claim
or latest verifier hold with its role and additional-hold count. Requested work
stays muted until a hold exists. Unknown facts show a dash. Selecting a row
unfolds its full pending approval command or the topic of its open human ask.
The selected row offers Capabilities and, for a session launched by cland, Stop
while live or Resume and Archive while stopped. Stop and Archive replace the
actions with an in-place confirmation naming the session: Enter or Confirm runs
it, Esc or Cancel leaves it. Enter on a focused button activates that button.
Only one request is submitted while its receipt is pending; failures and refused
actions show the hub's reason in place. Offline writes are disabled and never
queued for reconnect. Resume uses the harness's own conversation and retains
the name, role and claim. If the hub cannot resume it and offers a fresh launch,
the reason appears with Launch fresh, which reuses the recorded brief.

Capabilities is a read-only table of state signals, history, usage, model
change, approval relay and terminal support, or a message that no adapter/table
exists. Its reliability values come from the hub, including the web terminal's
`none`. `c` toggles the table and Esc closes it. The session's page opens in the
other pane with ⌘Enter and shows model, account, total tokens, cost when known,
and capabilities with the same actions and confirmations. Below 640 px, rows are 52 px tall with two lines: glyph, name and coloured
role with state and age at the right; then harness, item (including hold role
and +N, or a dimmed request) and any pending command, clipped with its full text
in a tooltip. Model, account and usage appear on the session page. Tap or Enter
opens that page in the current pane; Esc cancels a confirmation first, otherwise
returns to the list with focus on the same row, keeping the archive toggle. The narrow list has no row or
swipe actions, no unfolded detail and no drawer; action keys work on the page.
The thread drawer arrives in a following slice.

| Key | Action |
| --- | --- |
| `l` | Launch a session |
| `a` | New Aide |
| `j`, `↓` | Next visible session |
| `k`, `↑` | Previous visible session |
| `x` | Confirm Stop on a live launched session |
| `r` | Resume a stopped launched session |
| `d` | Confirm Archive on a stopped launched session |
| `c` | Toggle capabilities |
| `Enter` | Confirm the pending action; open the session page below 640 px |
| `⌘Enter` | Open the session page in the other pane |
| `Esc` | Cancel a confirmation or close capabilities |
| `←`, `→` | Fold or unfold the focused group |
| `A` | Show or hide archived sessions |
| `?` | Sessions keys |

`gs` from an item selects its claimed session and unfolds its group. The Archive
button shares `A`'s toggle; showing it reads `session.list` with `archived: true`
and consumes its hub-merged `rows` field. It never composes raw processes with
presence in the browser. There is no Attach in Sessions.

### Launching

The Sessions header has **Launch a session** and **New Aide**. The same actions
are in the Sessions palette and on physical `l` and `a`, including on a session's
page. Each opens a small inline form: name, role, harness, model, account, effort,
item and brief. New Aide reserves the next available `aide-N` among known rows,
selects Aide and focuses Brief; a general launch focuses Name. A brief accepts
text or an artifact id such as `A-12`.

Launch actions wait for the authenticated connection and role defaults.
Roles come from the hub. Selecting one fills its harness, model, account and
effort from `roles.toml`. Switching away from that harness clears unchanged
model, effort and account defaults; switching back restores empty defaults.
The harness field offers the three adapters, and Account lists the registry's
accounts for that harness. Focusing Model requests `models.list` for that harness
and selected account, with the default model first. Leaving the field or changing
the harness, role or account invalidates a late catalog reply.

Enter submits and Esc or Cancel closes, restoring focus. Field typing and Tab
remain native. Only one launch is sent while pending; offline launch is disabled,
drafts survive reconnect and no launch is replayed. Hub refusals, including a
limited account's reset, appear below the fields and retain the draft. A successful
launch closes the form; its row arrives through the normal hub updates.

There is no directory field and no `cwd` in the launch frame. The hub chooses the
project root, or the item's task worktree when one applies. The authenticated web
edge refuses directory overrides.

### Accounts strip and Accounts area

Sessions has a folding Accounts strip, with one cell per account in registry
order and synthetic `default:` accounts last. Each cell shows its name, harness,
highest-used window, share, reset and a meter along its foot. Shares turn amber
from 75 percent and red from 90, unless the source supplies its own severity.
A limited account is red and shows its reset (or `until cleared`) and the session
that hit it. Missing readings, signed-out accounts and OpenCode show a dash;
they never become zero percent or an empty meter. Tooltips carry every window,
the reading's age and source, and limited details. The header link and each cell
open Accounts in that pane. The strip's fold is browser-local under Sessions.

Accounts opens with the human's **Profile** block, visually set apart above
the registry. **This browser** shows Created, Last used and Cookie expires as
local dates and times, with exact hub timestamps in their tooltips. Its own
sign-in state comes from the authenticated socket's `web.session` read on entry
and reconnect; the cookie expires 30 days after creation, even after later use.
The profile is not a harness account and never enters account counts, selection
or the Sessions strip. Its fold is remembered in this browser. It lists no
other browser and offers no revoke; `cland web --sessions` and
`cland web --revoke <id>` stay in the CLI. Notification switches join this block
in their own slice.

Below the profile, Accounts lists a block per account, using the same pure projection in
`src/accounts/model.ts`. It shows the harness and directory or database path
(or `harness default`), every source window with its used share and reset,
the reading's age and source session or poll, and a limited mark's since,
reason, hitting session and reset. The registry path and its read error are
shown too. Paths are the only account locations displayed; no secret or account
file content enters either view. Reset and age formats follow Neovim's
`accounts.lua`, in the browser's local timezone, sampled on redraw.

Entering Accounts requests one `account.poll` once connected. The hub decides
which idle accounts are eligible and enforces its polling limits. The reply
refreshes the registry and readings; live account deltas update both views.
Polls do not repeat on ordinary redraws or replay after a lost connection.
Accounts is read-only; clearing a limited mark stays in `cland account clear`.
Its account blocks use the shared `←`/`→` fold keys and `?` help.

## Folds and factual labels

`src/Fold.tsx` is the reusable group/block component used by the reference
`Shell.tsx` for area lists, detail blocks and the drawer. Supply an area, a stable
fold ID, a name, a count and contents. Its chevron button exposes `aria-expanded`
and `aria-controls`; folded contents are hidden, while the heading and actions
stay available. On the header or inside its contents, `←` folds and `→` unfolds,
returning focus to the header. Enter and Space activate the header button.
The arrow actions come from the single physical-code map and appear in `?` help;
fields keep their normal typing and cursor movement.

Folds live in the area's `cland.ui.<area>.v1` record under `folds`, keyed by the
stable fold ID. Updates preserve other fields and fold IDs, and both panes agree
on the same area's fold. Invalid fields use the block's default (unfolded unless
`defaultFolded` is supplied). Denied reads or
writes leave folds working in memory for the page. No fold sends a hub frame
or changes Neovim's `ui.json`.

`test/prose.ts` checks visible text nodes mechanically: a trailing full stop or
more than six whitespace-separated words fails. It excludes hidden text,
`title` attributes, elements with `role="tooltip"` and the `?` panel marked by
`data-keys-help`. `test/folds.test.ts` applies it to the shell and plants header
fixtures for both failure rules; explanations belong in those excluded help
surfaces or docs. Names, counts and facts belong in headings and rows.

## Fonts and asset checks

Golos Text (400–900) and JetBrains Mono (100–800), normal variable WOFF2 subsets
for Latin and Cyrillic, live in `public/fonts/`. CSS requests only `/fonts/…` from
the serving origin. Their unmodified SIL OFL 1.1 licences are alongside the fonts.
`public/fonts/SOURCES.md` records the upstream URLs. Every production build checks
WOFF2 signatures, licences, no absolute external resource URL in HTML/CSS and no
external literal import/fetch/XHR/WebSocket/EventSource target in JS. React's diagnostic links,
namespace strings and OFL licence links are metadata, not network requests.
Browser request observation belongs to T-991's Web phase.

## Browser tests

For rule 18's isolated-browser checks, stub every opener on PATH, assert the launched executable and profile, and retain a final owned process-group census (A-8634 R1 techniques; T-980, T-991, T-1011).

Growing help overlays and lists get a small-viewport keyboard-scroll regression: collect rows actually visible over a bounded native scroll traversal, then assert the last row and its viewport containment. Avoid depending on the row after a single page-sized jump; a real-browser check proves visible reachability (A-9063 R6; T-1095, T-1097).

The separate **Web** phase uses `node:test`, the pinned `playwright-core` and its
Chrome Headless Shell. `npm install` builds the bundle and installs only the
headless shell under `node_modules/playwright-core/.local-browsers`; no installed
Chrome, Safari, human profile or GUI browser is used. To repair the test binary,
run `npm run test:web:install`; on a Linux executor, pass `-- --with-deps` to install
the shell's OS libraries too. Executor snapshots must be refreshed after a lockfile
change; the preparation step's `npm ci` installs the pinned shell on a cold image.

```sh
npm run test:web                     # just Web, under the normal suite queue
node --test web/test/smoke.test.ts    # targeted file; build first with npm run build
node --test web/test/connection.test.ts # sign-in, connection and hub restart
node --test web/test/palette.test.ts    # palette, prefixes, keys help and physical-code controls
node --test web/test/folds.test.ts      # local folds, zero fold frames and visible-prose guard
node --test web/test/shell.test.ts      # rail, top strip, state, keys and focus
node --test web/test/items.test.ts      # snapshot tree, CLI deltas, folds and 300-item rebuild
node --test web/test/item-card.test.ts # snapshot facts, lazy text, closed deltas and focus
node --test web/test/items-actions.test.ts # scope, selection, quick messages and item links
node --test web/test/session-launch.test.ts # role defaults, fake Aide launch, no cwd and account refusals
node --test web/test/sessions.test.ts # groups, folds, merged row facts, waiting detail and archive
node --test web/test/artifacts.test.ts # tree, capability pages, sandbox isolation, text and downloads
node --test web/test/accounts.test.ts # own browser profile, two-context isolation, registry, windows, polls and Sessions strip
node --test hub/test/web-accounts.test.ts # T1 worst window, severity, missing data and clock formats
node --test web/test/items-order.test.ts # rank-event cache invalidation on a minimal real hub
node --test web/test/topics.test.ts    # groups, numeric pages, live races, resume and visible read marks
node --test web/test/messages.test.ts  # P12 headers, bands, verdicts, safe Markdown, item links and chips
node --test web/test/thread-runs.test.ts # hub fold lines, inline expansion, pinned anchors and live growth
node --test web/test/inbox.test.ts      # Now sections, ages/folds, row actions, approval keys, navigation and events footer
node --test web/test/asks.test.ts       # shared cards, physical answers, declines, two-client races and reconnect
node --test web/test/thread-artifacts.test.ts # HTML capability frames, sandbox isolation and opening actions
node --test hub/test/web-keymap.test.ts # T1 shortcut resolution and reserved chords
```

Full runs place Web after the hub phases, with resource `machine`, two local
workers and four droplet workers. Web is outside T0–T3. A `web/**` diff selects
`web-only`: Web plus hub and Neovim smoke. Other package selections retain
`web/test/smoke.test.ts`. Protocol, shared wire, edge and mixed web/package diffs
force full. Task verification includes Web even with the T0–T2 cap; merge batches
exclude it. Periodic dev, integrated, stage, epic, release and soak runs include it.
The root check builds `web/dist` once; a hand-run package suite reuses that source
receipt or builds once before workers if it is missing/stale.

`test/harness.ts` creates one scratch `projectHub` and one Headless Shell per file.
Use `webFixture(t)` and `fixture.pageCase(t, body)` in sequential cases. Each case
gets a fresh context, a one-time `web.link` minted by a local test-client frame,
a real `/auth` cookie trade and a `Notification` init stub. HOME/XDG/Git and child
environments use the shared credential filter. Browser profiles and TMPDIR paths
belong to short scratch roots. Keep CSP enabled; `pageUntil` polls with
`page.evaluate`, retaining the final assertion. Observe the exact DOM/event
boundary before asserting a result, with setup bounded separately.

A failed case writes a Playwright trace ZIP under ignored `web/test-results/` and
closes its context. Publish the file with `artifact.create` when reporting a
failure. Teardown explicitly closes the browser, observes its process exit and
an empty process-group census, then stops the scratch hub before removing roots.
The smoke includes a planted failure to prove trace writing and context disposal.
The budgets are 4 seconds per top-level test and 40 seconds for the phase, currently
reported under the repository's duration report mode. A 60-second gross hang
guard reaps a stuck phase. Web never receives load-gate repetitions; browser
assertions use deterministic facts and bounded waits, not latency assertions.

The connection case opens the link printed by `cland web --no-open` in its
disposable project (with both browser openers stubbed). It proves the rendered
project/live state, `/auth` redirect, cookie flags and the served JS bundle's CSP.
It scans every served bundle file, browser storage, cookie values, HTTP responses
and WebSocket frames for the scratch hub's secret. Restarting the in-process hub
proves offline/live rendering and cookie persistence without navigation; a
controlled browser clock proves the retry schedule without latency assertions.

The runner calls `test/prerequisite.ts` before a selected Web phase. It resolves
the pinned package's Headless Shell revision and checkout-local executable; Linux
also checks the shell and bundled shared libraries with bounded `ldd` calls in a
sealed scratch environment. It launches no browser. Web runs on macOS and Linux
droplets; prepared Ubuntu 24.04 snapshots include the shell's runtime libraries.
A machine missing the shell or required libraries reports Web unavailable, with
no passing Web receipt, while preserving other phase results. The fixture uses
the probe's exact executable path, with no fallback to an installed browser.

## Graph geometry

`src/graph-layout.ts` ports the geometry in
`nvim/lua/cland/graph_layout.lua`: cycle removal, transitive reduction, ASAP or
supplied layers, dummy chains, barycentre sweeps, transpose, weighted placement,
source-block track ordering and vertical-band fitting. It uses no layout library
or DOM; `tsconfig.graph.json` checks it with only ECMAScript types as part of the
normal typecheck. Keep changes to this algorithm paired with the Lua differential
oracle. The SVG view supplies token colours and scales the returned geometry.

`fromItems(children, options)` takes siblings in tracker order; external blockers
are reported separately and unlinked siblings go to `tray`. `layout(nodes, edges,
options)` accepts blocker-first edge pairs. `reduce: false` keeps shortcuts;
`rank`, `keep_order` and `include` support planned stages. Layers and chain ids
stay **1-based** for Lua parity; positions and route coordinates are **0-based**
display units. IDs beginning with `~` are reserved for generated dummy vertices.

`rows(layout, size, extraGap, pack)` places vertices along their layers. A dummy
uses one unit and every vertex has a one-unit trailing gap. Supply a real node's
height for horizontal layout, or its width plus port/gap allowance for vertical
layout. `fitWindow` returns a fitted layout, label width and the original layer
of each continued band; use packed rows when drawing these continued bands.

`route(layout, positions, options)` returns bounds and orthogonal segments carrying
their chain id. `h` tuples contain row, start column, end column and chain; `v`
tuples contain column, start row, end row and chain. `p` tuples contain row,
column, direction bits and chain, representing coincident vertical ports
(`3` means up and down). Segment direction is preserved, so endpoints may decrease.
Routes through dummies belong to the same original chain. Keep crossing ownership
when drawing SVG; a crossing does not join its two edges. Labels and tray drawing
belong to the view; Neovim's text canvas and Unicode clipping are not browser APIs.

The targeted oracle command is:

```sh
node --test nvim/test/web-graph-layout.test.ts
```

It requires the pinned Neovim prepared by verification, runs it headless in sealed
scratch state and compares exact layers, within-layer order, diagnostics, positions
and route segments in both orientations. Inputs include `GRAPH-001.items.json`,
every epic/release in a scratch copy of `.cland/tasks`, seeded cyclic/ranked/dense
graphs and narrow-band wrapping. It is T3 because the oracle is a real binary;
task T0–T2 verification defers it to integrated/stage process occasions. Small
literal geometry contracts run in T1 (`hub/test/web-graph-layout.test.ts`).


The open snapshot holds open rows and their ancestors; fully closed container
subtrees remain on demand. The Items tree reads closed children of every kind through `ConnectionState.closedTasks(parent)`
and `loadClosed(parent)`. Unfolding a parent while done work is shown loads
`task.list` summary pages with `state:"closed", parent`, at most 100 rows per
reply and below 256 KiB. The connection follows `next` cursors, merges task deltas
received during the load and caches completed parent pages. A closing task leaves
`connection.items` and joins any loaded closed parent page. Reconnection renews
requested parents. Newly loaded containers expose their own pages on expansion;
`A` reads closed roots. The tree and card traverse these nested pages and
deduplicate snapshot/page overlaps by identity. Container roll-ups supply counts
before children load.

The done-hidden total reads the hub's `done_items` inventory from the items
snapshot and task deltas. Stage fractions and derived stage state read the
parent item's authoritative stage summaries (`merged`, `total`, `statuses`,
`state`); an absent legacy summary displays unavailable merged progress. These
facts remain complete with D hiding done and closed child pages still unloaded.

### Plan

Plan opens the selected epic, or the epic containing the selected item. It shows
stages, ordered lanes, QA policies and overrides, stage gates, hub progress,
history, crew and external blockers. Missing plan members load through bounded
by-id summary reads, including closed tasks on a Plan-first entry; their deltas
remain visible without body reads. Its summary column folds below the stages
under 1280 px. The source excerpt is read only and loads when expanded.

At desktop width (at least 1280 px), `a` or **Approve** approves a waiting plan
through the hub as the human. The action is absent below that width and remains
inert on the keyboard. Offline, pending and stale requests cannot approve.
`d` opens a message field for the epic's Lead in its topic, creating that topic
when needed. A failed send retains the draft; mutations never retry automatically.
There is no plan editing.

Changes since the human's last look use the watch colour. Entry freezes the
previous per-human receipt, then acknowledges the newest loaded history record
through `marks.set`. That visit keeps its highlights, including later live
changes; a new visit uses the hub's updated receipt. Marks agree with Neovim and
other browsers and follow history order even when timestamps match.
