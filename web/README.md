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
heading, the Items tree, and stand-in lists of other hub object IDs and titles;
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
snapshot supplies tracker configuration, open item summaries and all non-task rows, sessions, topics, inbox,
events and accounts; `hub.status` supplies the project name and `artifact.list`
the artifact inventory. Item deltas replace or remove rows directly, without a
`task.list` reread. Reconnection takes a fresh snapshot, retaining the previous
display while offline. Inbox pushes update attention immediately;
presence/Coordinator changes refresh status.
Task deltas carry full verdict history: the client selects the latest per kind
and retains its history round, matching the snapshot projection. Any item
replacement/removal invalidates cached sibling orders for its old and new
parent before applying a fresh order supplied by a rank event.

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
| `Enter` | Enter the card or return to the tree |
| `Esc`, `h` in the card | Return to its tree row |
| `?` | Show the active area's keys |

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

The Items header switches between Tree, Board and Graph. Plan is disabled
until its view lands. The view is a browser preference under
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
`Meta+Enter`, `Escape`). The stand-in lists use read-only list replies and refresh
on matching hub frames and reconnection; they expose no domain mutations.

## Palette and keys

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
| `1`–`7` | Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts in the active pane | Type in the input |
| `⌘K`, `Space p` | Open palette (`Space p` outside fields) | `⌘K` keeps palette open |
| `?` | Show current area’s keys, outside fields | Type in the input |
| `⌘\` | Toggle split | — |
| `⌘Enter` | Open selected object in the other pane | Open result in the other pane |
| `Enter` | Native control activation | Open result or run action |
| `Tab`, `Shift+Tab` | Native focus navigation | Next/previous kind, retaining search |
| `↓`, `↑` | Native control behaviour | Next/previous result |
| `Esc` | Close help or drawer | Close without acting |

The top-strip Palette and Help buttons expose the same overlays. Help names the
active pane’s area and lists the shell keys shared by all current stand-in areas;
area-specific keys use the same map. Help lists each action once, with the active area's label replacing the shared label for that action. Native modal
focus containment keeps background controls inert; dismissal restores focus.
The single `keyboard.ts` listener reads physical codes and exact modifiers,
including both strokes of `Space p`, so Cyrillic key values do not change actions.
Composition, already-handled events and ordinary field typing remain untouched.
The leader survives ordinary hub updates at the same focus target; it only
resolves in the shell outside fields and is cleared by the next stroke.
Reserved browser window/tab shortcuts remain unbound.

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
on the same area's fold. Invalid fields default to unfolded. Denied reads or
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
node --test web/test/items-order.test.ts # rank-event cache invalidation on a minimal real hub
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
