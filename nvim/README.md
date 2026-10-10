# nvim

The Neovim side of cland: the standalone start and the Lua UI (spec `docs/spec/v0.md`, sections 4.1 and 5; ADR 0005): the workbench shell (#25) around the topic threads of #23. The session launcher and the sessions panel are #28; the items panel, the item view and the board are #36. The Agents log is #34, the inbox and the ask cards #33. Shared artifacts open from topic chips, per-topic lists and the palette.

## Starting it

```sh
cland                                   # on a terminal, anywhere inside a project: the same as `cland open`
cland open [dir] [nvim args…]
nvim/bin/cland-nvim [project-dir] [nvim args…]
```

- **`cland` / `cland open`** runs `cland hub start` (nothing happens when the hub runs already), then `nvim/bin/cland-nvim` on the project's root, and exits with Neovim's status (`hub/src/cli/open.ts`).
- **The project** is the given directory, else the current one. The launcher and the client walk up to the nearest ancestor holding `.git` or `.cland/`, as the hub does, so both work from any directory inside the project.
- **The hub** is found through `.cland/hub.json`. When no hub runs, or three connects in a row fail on the socket a stale `hub.json` names (a hub killed, a reboot), the client runs `cland hub start` once and connects when it answers. With `CLAND_HUB_TRANSPORT=stdio` the client spawns `cland hub serve --stdio` as its child instead and speaks the frames over its stdin and stdout. Quitting closes the child's stdin, which stops that hub.
- **The `cland` CLI** is run as `node hub/bin/cland.ts` from this repository; `CLAND_NODE` names another `node`, and `CLAND_COMMAND` (a JSON array) replaces the whole command (the tests' stub hub).

The launcher runs `NVIM_APPNAME=cland nvim --clean -u nvim/init.lua`, in that order. `NVIM_APPNAME` renames every `stdpath()`; `--clean` then `-u` skips the user's init, `plugin/` and `pack/` directories and sources only cland's `init.lua`. `:scriptnames` lists the bundled runtime and `nvim/init.lua`, nothing else.

## The shell

```
 cland <project> │ <centre view>        ● coord Coordinator · Claude Code · opus · busy   ✓ needs you 0   sessions 2
 ITEMS ␣i    │ centre view                        │ TOPICS (dock) ␣T
             │ thread · session · item · board ·  ├──────────────────
             │ Agents log · inbox full width (␣N) │ INBOX ␣n
             ├────────────────────────────────────┤ or SESSIONS ␣s
             │ composer (threads only)            │ or TOPICS ␣t
 MODE  <the centre view's context> │ hub: connected │ sessions: 1 busy · 0 waiting · 1 idle      key hints
```

- **The top bar** is the tabline: the project, the centre view's title, the Coordinator chip (the live session holding the role and its state; a red "no coordinator" when none). Sessions show as `name [Role]` everywhere (the panel, the palette, the session view's title and header, a thread message's header, an ask's asker in the inbox, a verdict's `by`), from the hub's `label` or the role's label, never the role's key. The hub's word wins: `coordinator` in `hub.status`, and the `role.vacant` and `role.filled` events (#29), which change the chip at once, the single "needs you" count (the hub’s `needsYou`, shared with the inbox header) and the live sessions with the waiting and down counts. The chips are clickable.
- **Needs-you count** (T-165, corrected by T-169): the chip and inbox header both display the hub’s `needsYou` from `hub.status`, `inbox.list` and inbox events through `state.needs_you()`. Before the hub supplies a number, they show no number; payloads without one keep the last known value. Neovim never computes or adjusts the count from asks, approvals, waiting topics, notifications, unread messages or local answers. The chip uses the shared cell-budget fitter, preserving the sessions count and the statusline’s existing hint/notice/context priorities.
- **The status line** (global) shows the centre view's context, hub state (`connected`, `reconnecting`, `starting`, …), active preset, sessions by state, the latest notice and focused key hints. One display-cell budget gives space first to the answer hint, then the notice, then the context (with an ellipsis when truncated), then session counts. Counts also remain in the top bar. cland's notices go there, never to the message area: `vim.notify` is replaced.
- **The centre** shows one view at a time: a topic thread with its composer, a session terminal, the item view, the board, the Agents log, or the inbox full width. `␣␣` returns to the previous one.
- **Topic message blocks** (v0.1, T-132): each header reads `sender [Role] → addressees  HH:MM`, with `you` for the human and up to three addressees followed by `+N`. A message to the human with no explicit addressees shows `→ you`; a bare artifact post keeps its chip. The local time and a rule for each local day follow the machine's time zone. The gutter runs down every screen row, including wrapped rows: teal Coordinator, violet Implementer, pink Reviewer, sky QA and blue human. An Aide uses the human's blue with a dashed bar and a heavier dashed bar under the cursor; its header reads `aide-1 [Aide] · speaks for you`. Messages to or from an Aide never fold. The block under the cursor has a heavier bar; the human's header and body have a full-width band. Delivery stages and ask states sit at the right end of the header, after wrapped text, so they do not cover it. Bodies keep their text and indentation; wrapping breaks at spaces and keeps ids such as `T-58` whole. New messages append their own lines, delivery changes one extmark, and ask updates replace their own block. The buffer keeps the latest 200 messages, deleting expired blocks without rewriting retained messages; a retained answer becomes standalone when its ask expires. History merges that bring older messages can rebuild the thread. Shared topic splits use the same incremental buffer. Thread window options follow the buffer through `BufWinEnter` and `WinNew`; other buffers restore their global defaults, including arbitrary scratch splits. Neovim's `breakat` is global, so this bundled workbench uses spaces only; `linebreak` is local to threads, leaving other windows unaffected. Tail following preserves focus and the user's current mode. Agent-run folds and watch presentation are described below; archive and overrides belong to T-115.
- **Markdown per message** (T-133): each body gets its own bundled tree-sitter Markdown parse, never one tree for the thread. Parsed spans and displayed projections are cached by body text; appends parse only a new body, repeated text reuses it, and failed parses stay plain. Headings are bold, inline code has a chip background, code fences are concealed with a faint language label and the code inset two cells inside its band. List continuations align under the bullet text, links are blue and underlined, and item ids are blue `gi` targets through the existing action registry. Inline and valid full, collapsed and shortcut reference links retain their destinations in row metadata while compact buffer text avoids Neovim's phantom wraps from concealed URLs. Tables align columns by rendered, conceal-aware cell widths and remain full where they fit; narrower tables become labelled cells using the shared display-cell budget. Header-only tables keep their cells, and Markdown labels retain their style and link destinations; resizing reprojects cached spans. Resize bursts coalesce into one projection at the final live window width; closed or reused windows invalidate their queued work. Quote bars never repeat an overlay over continuation text. Review/QA verdict first lines are red for `not clear` and green for `clear`. Conceal options go through the same thread-local window handler and restore global defaults on other buffers. Known first-open cost: cold parsing and rendering of 200 distinct Markdown bodies measured 118–230 ms; a warm full rewrite measured 16–27 ms with zero parses. The test bounds the warm rewrite at 35 ms and append plus eviction at 2 ms, matching the epic’s tens-of-milliseconds budget.

- **Agent-run folds** (T-134): `thread.layer(message)` aliases the shared `message_layer.layer` now/watch/background rule for messages. Asks, answers, traffic to or from the human or an Aide, and not-clear verdicts are now; clear verdicts are watch. Coordinator reports to the human remain now until the quiet-Coordinator presentation is wired. Agent-to-agent exchanges, progress digests, hub event deliveries and unaddressed agent artifact posts are background. Archive and layer overrides belong to T-115.
  Background blocks on one local day form a manual fold per run and per window. `zo`, `za`, `zc`, `zR`, `zM` and Enter are registered actions; Enter toggles a run or opens a chip outside runs. The header counts messages in closed runs. Summary names use the display-cell fitter and reserve room for the message count, including at 80 columns.
  Fold state follows surviving message membership within each window: appending extends the existing open state; a never-folding message inserted mid-run splits it and both halves keep their state; evicting its first member keeps the run open; rejoining runs takes the union (any open member opens the joined run). State transitions run for every window on each append and eviction, even while hidden: new members inherit before old members are evicted, and evicted ids are collected. Rendering on show consumes that state. Full rewrites and leaving/re-entering a thread preserve that window's state; a new split starts closed independently. Retained message text still changes only through the block seams. All fold options are local in the existing window handler.
  Native fold reads, reconstruction, commands and counts reject windows showing another buffer. Reconstruction uses `nvim_win_call` on the thread window and restores its cursor; the focused board keeps its folds, selection, cursor and mode. A thread with no runs or native folds does no reconstruction, so connection notices and layout redraws do not execute Normal commands unnecessarily. Actual manual-fold deletion retains `normal! zE`: Neovim has no Ex form for deletion, and an automatic foldmethod reset does not update correctly while the composer is in Insert mode. Fold-command errors are never suppressed.

- **Asks, chips and kinds** (T-135): ask cards have an amber band, numbered options and the free-answer hint. `1`–`9` answer an open card through the same `ask_card.answer` / `topic.answer` path used by the inbox and palette; `i` arms its composer for a free answer. Answered cards show the chosen option and the human’s answer beneath them. A bare artifact posted immediately after an ask by the same Coordinator, in the same topic and local day, shares its header; intervening messages and other senders keep separate headers. Attached artifacts also appear beneath the card. Enter opens a chip through the existing artifact handler. Retention promotes a surviving chip or answer to its own chronological block when its ask expires. Each header shows the recorded message kind (`progress`, `report`, `question`, `decision`, or a hub lifecycle kind); older records without a kind use `report` for agent text, `question` for asks, `artifact` for bare chips and `message` for human text. The shared layer rule controls watch styling: softer text and a dimmed role bar. A clear review/QA verdict combines its header and green result in one buffer row; a not-clear verdict keeps its red result and following notes. Coordinator reports stay now until T-143 changes the default-report policy. These changes preserve the incremental/full-render invariant and the existing thread-local options and fold guards.

- **The Agents log** (#34) is how Agents is read: `␣L`, `:Cland view log`, or Agents from the topics panel or the palette (never a thread with a composer: Agents is read-only). One row per entry, oldest first: the local time, then `sender [Role] → addressee [Role]` and the text for a message (further lines indented below it), or a kind glyph and the text for a lifecycle notice: `▶` session start, `■` stop, `✖` death, `◆` role assigned, `◇` revoked, `⇄` handover, `⚑` claim, `⚐` release, `⊘` mute (red), `⊙` unmute, `⛔` a refused tool call. It loads `topic.history` on every connect and adds a row on each `message` event for `agents`. `r` on a message opens a composer under the log, titled `↩ reply to <sender [Role]>`: what is sent there goes to Agents with `replyTo`, which the hub resolves to that sender; once the hub accepts it the composer closes. `r` on a notice says it has no sender to answer.
  - **Filters** (T-56): `f` asks for an item id or session name, with `Tab` completion from both. The header shows `AGENTS · T-12` or `AGENTS · impl-12`. It fetches the latest 200 matches from the hub's whole retained record, including older entries outside the unfiltered window, and admits only matching live entries. Item filters match notice details naming the item or its bound topic; session filters match the sender, addressees or session-bearing notice facts (`session`, `from`, `to`, `by`, `pair`), excluding metadata such as the harness or mute rule. Names match exactly, and message text is not searched. `F` clears the filter and reloads the unfiltered history. `L` in an item view or on a sessions-panel row opens Agents filtered to that item or session. Changing the filter closes any reply composer.

- **Panels.** Items on the left (below). On the right one of: the inbox (below), sessions (name, role, harness, model, the state with `(heuristic)` when the adapter's capability table says so, the claimed item) and topics (below). Topics can also dock above the right panel. Opening the workbench shows General with the sessions panel.
- **Topics** (spec 4.5, #32). The panel groups NEEDS YOU (topics waiting for the human, pinned on top, an amber `●`), OPEN (`●` open, `◐` waiting for an agent) and CLOSED (`○`), in the hub's order (activity) within each; Agents is the `≡` log. A row shows the bound item (`T-12`) unless the title says it, a red `▲` while the topic carries a warning (`no coordinator`), and the unread badge (amber when the topic needs the human); the header counts topics and unread messages. A thread in view is read (`topic.read`) and a `message` event raises the badge of a topic out of view. The thread header shows the binding, the warning and the status (`waiting for you`, `topic waiting for agent`, …); the status line names the binding and the status too. The "needs you" chip is the hub's count (asks, approvals and topics waiting for the human, #33).
- **The inbox** (spec 5, #33) in the right panel (`␣n`) or full width (`␣N`): ASKS (each with its topic or bound item, the asker and the time, the question, the numbered options, the free-answer hint), APPROVALS (sessions waiting for approval), WAITING FOR YOU (topics waiting for the human without an ask) and NOTIFICATIONS (`✓`/`✗` verdicts, `↔` role changes, `!` deaths, `○` long idles), in that order; the header and the top bar count what needs you. It comes from `inbox.list` and is replaced by every `inbox` event, so rows come and go without a prompt.
- **Asks in the thread** show as a card under the asker's header (`ask · ▲ waiting for you` on the right): the question, the numbered options and `1-9 answers · free answer: i`. Answered, it marks the chosen option (`✓ 2 …`) and the answer message follows right under it; a withdrawn or cancelled ask says so. `ask` events change the card in place. After every reconnect, once the history is merged, the thread asks `inbox.list` for the open asks: a card it cached as open that is not among them (closed while the client was away, its message older than the latest 200 the history returns) shows `closed` and takes no answer.
- **Sessions** (#28). The panel shows one row per session: the name with its role (`rev-1 [Reviewer]`, the hub's `label`), the claimed item (or `free`), then the harness, the model, the state with `(heuristic)` when the adapter's capability table says so, and the usage where the adapter reports it (`$1.80` or `12.3k tok`). A launched session whose process died shows `✗ … unknown · died` (the hub's log has `harness-exited`), one stopped `× … unknown · stopped`. The last launch or stop, or what the hub refused, is a notice atop the panel. The panel follows `session.state` and `session.role` events and the periodic refresh.
- **The launcher** (`␣l`, or `l` in the sessions panel, or `:Cland launch [name]`) is a floating form: name, role, harness (`claude-code` \| `codex` \| `opencode`), model, directory (the project root), effort, item and an optional brief, one line each. The brief is text or an artifact id (`A-<n>`); the hub delivers it once after the role clause. An item (`T-12`, an Implementer's) replaces the directory: the hub starts the session in the item's task worktree, made first when missing, and gives it the item's claim (`hub/README.md`, Task branches and worktrees). Typing a role (or `C-n`/`C-p` on the role and harness lines) fills the harness, model and effort from the role's launch defaults (`role.list`, from `.cland/roles.toml`); a harness other than the role's clears the model and effort meant for the role's. `Tab`/`S-Tab` move between fields, `Enter` sends `session.launch` (empty fields are left to the hub), `Esc` cancels. What the hub refuses (a name in use, the Coordinator held, an unknown harness) shows under the fields and atop the panel; the form stays open to fix it. With no role the first `Enter` warns that the hub will refuse the session's spoke until one is assigned, and the second launches.
- **Aides** (T-150). `␣A`, `a` in the sessions panel, the palette’s **Launch an Aide** action or `:Cland aide` opens the launcher with the next unused `aide-N` name, the `aide` role’s harness, model and effort defaults, and the project root as directory. Focus starts on the brief: type a one-line task and press Enter, or Enter alone for no brief. A successful launch attaches in the centre. There is no cap; names already in launched processes (stopped ones included) or connected presence are skipped. The form remains editable and retains the usual launch refusal handling. Live Aides appear under **yours** above the crew’s state groups; the role identifies them, regardless of name. Stopped Aides join the stopped fold.
- **Session terminals** only attach: the terminal runs the command `session.attach` returns (`claude attach <id>`), never the harness. Closing the terminal or quitting ends the attach client, not the session. An attach client that ended (`TermClose`) leaves its finished terminal to be read until it is hidden; the session is no longer attached, and `↵` or `C-v` runs the attach command again. A session terminal is never below three rows.
- **UI preferences** (`.cland/ui.json`, T-125) survive ordinary quits and restarts. The version-2 file keeps `preset`, `panels` (`left`, `right`, `dock`), `sizes` (manual `left`/`right` widths and `dock` height, in cells), `items_filter`, and `current_release` (the selected open container id or null for the default release). The right panel and topics dock share a column width. A manual resize takes precedence over the screen-size formulas, survives view and preset switches, and is remembered even while a panel is hidden. A preset applies its panel set and centre view while retaining manual sizes; toggling a panel clears the preset. An absent file silently gives defaults. An existing unreadable or invalid file gives defaults and one status-line notice without blocking startup or hiding the inbox answer hint. Changes are debounced for 200 ms and written to a unique sibling temp file, then atomically renamed; quitting flushes a pending change. Manual sizes are recorded by resize events and flushed before workbench layout operations and native split closes; automatic redistribution after a close or a workbench layout change is excluded, and the saved sizes are restored after closes. A failed write gives one notice and leaves the old complete file intact. The file is per machine and ignored by the managed `.cland/.gitignore`; deleting it resets the preferences. Live attachments and view history remain in the separate, short-lived `:restart` snapshot.
  A resize queued in the same typeahead batch after a split close, before its next-event-loop repair, is reverted; hand-typed keys allow that repair to run first (T-125, rev-65-125-3).
- **`:restart`** writes the layout, the attached sessions and the sessions in `C-v` splits to `stdpath('state')/restart/<project hash>.json` (ExitPre, `v:exitreason` "restart"). The new instance reads them back (`v:startreason` "restart"), builds the shell again over the Vim session `:restart` sources (SessionLoadPost; `'sessionoptions'` is only `curdir`, so no terminal is re-run from it), and runs the attach commands again: a session in a `C-v` split comes back in a split beside the centre, the others in the centre or hidden as they were.
- **Items** (T-123, spec v0.1 §3.1–3.2), from `task.list` and `task` events. Workflow status, rank and parent links are hub data (`lua/cland/items.lua`); the UI never derives workflow status from claims or verdicts.
  - **The panel** (`␣i`) is a vertical board of the selected container. It reads `status` verbatim from the hub and orders rows by epic rank, then task rank, using the shared comparator and the final `siblings` from rank events. Its counted sections are **in progress**, **review**, **qa**, **ready**, **planned**. Backlog and unscheduled start folded; `za`, `zo`, `zc`, `zR` and `zM` control the folds. Done starts hidden and is counted in the header (`board · 12 in work · 6 done`). Task glyphs are `○` backlog/planned, `◐` in progress, amber `◉` review/qa, green `◉` ready and `●` done. A blocked planned task has `◌`; the first unblocked planned row has a teal **next** mark. Each row includes its dim parent prefix, claim or verifier hold, failed last verdict (`✗`), waiting-review text (`for Reviewer`) and counted ask badge. The dim verified/total fraction counts only checked boxes under `## Acceptance criteria` (including subheadings, excluding fenced examples); a complete fraction is green. One replaceable function supplies this stand-in until T-112 supplies hub criteria marks.
  - **Scope and tabs.** Container levels come from `hub.status.tracker.levels`. The default scope is the open top-level item with the lowest SemVer version (prereleases included; unversioned items follow versioned ones, ties use numeric id). `e` / `E` cycle open configured containers, excluding maps and leaves. The choice uses T-125's `current_release` slot in `.cland/ui.json`, survives a cold restart and appears in the top-bar chip; a missing, closed or non-container pick falls back to the default release. The epic tab row names the open descendant containers; `p` / `P` or Tab / Shift+Tab cycle all → each epic → all. The panel and centre board share scope, epic filter and hub order. `K` / `J` rank the selected item before / after its adjacent sibling (including siblings in another status); `T` ranks it to the top. These keys send `task.rank` to the hub. Only resulting `task` events move rows; a refused or result-only request leaves order unchanged, and the cursor follows the item.
  - **Filters**, `1`–`6` or `f` / `F`: **board** (the default: only the selected scope's status sections, plus folded open unscheduled items), **in work** (`planned`, `in progress`, `review`, `qa`, `ready`, with matching unscheduled tasks folded last), **needs you** (unchanged: all open asks or a latest not-clear verdict), **done** (reveals done tasks of the selected scope, including closed parents), **map** (wayfinder groups: decided, frontier, in work by sub-agents, blocked), **all** (the complete ranked item tree, including other containers and closed/done items; unfold with `za` or `zR`). Unscheduled contains only open items outside configured container trees; closed containers keep their membership, and done items never enter this fold. Legacy UI preferences migrate the old default `all` to `board`; an explicit `all` choice persists after migration. Containers and maps retain children's progress (`1/3`); questions/specs have no workflow status. A blocker the tracker does not know counts as open.
  - **The item view** (`↵` on a row or a card, `gi`, the palette, `:Cland view item T-<n>`): a title line with the id and the state; the title, the file and the body as Markdown text; the verdicts, the latest of each kind on top (`✗ review not clear · by rev-1 [Reviewer] · run r-2 · <time>`), the earlier ones below; the comments. The fields column sits beside them when the centre is at least 90 columns wide, above them otherwise: state, kind and labels, parent, assignee, claim, topic (`no topic yet` when unbound), branch, blocked by (each blocker's state), blocks (the items whose `blocked_by` names it), cost (from the claiming session's reported usage, `—` when unknown), file. The body and comments come from `task.view`, fetched again whenever the item changes, on every `task` event for it and after every reconnect (an edit while away may keep `updated`); a failed fetch is never current, and what was shown stays with a `not current` line. An indentation keeps at most half the width. `e` opens the item's file in a normal buffer in the centre (`:edit`); the hub's watcher re-indexes it on `:w`.
  - **The board** (`␣b`) keeps the horizontal cards in seven columns: **backlog**, **planned**, **in progress**, **review**, **qa**, **ready**, **done**. Each task goes into its hub status column, ordered by epic rank then task rank, with its ask, claim/assignee, blockers and verdict marks. It shares the panel's selected scope and shows its tasks whose entire parent chain is open; a closed epic's done cards leave it. Questions, specs and containers have no workflow column. The header names open parents (including deeper configured containers); `p` / `P` cycle all → each parent and back. A closed/removed parent resets that filter to all. `↵` or `gi` opens the card's item.
  - **The experimental graph** (`␣G`, `:Cland graph [T-n]`) draws one container's direct children by their sibling blocking edges, vertically by default. It opens the current release's first open descendant container in rank/tree order; `p` / `P` cycle those containers, then the release itself, and wrap. With no open descendant containers the release is the only choice. An explicit id opens any known container, including an empty or closed one. Each node shows the hub's status glyph, id, title, separate ◌ blocked mark, ask count, claim/assignee, latest verdict and verified/total. Fractions count verified marks from `task.view.criteria`; older hubs without that field use acceptance-section checkboxes. Done nodes are dimmed. Children without sibling edges sit in a tray; its done nodes start folded and `d` reveals them. Linked done nodes stay drawn to preserve their edges. `o` turns the layout sideways; `r` reveals edges implied by longer paths. The footer names cycle edges left out, hidden edges and outside blockers. The cursor moves node to node with `h` / `l` / `j` / `k`: across a band and between layers according to the visible orientation, then into the tray. `^` / `$` select a vertical band’s ends or the first/last sideways layer; `gg` / `G` jump to the first/last vertical layer (the buffer’s ends sideways). Its edges are highlighted and the winbar spells out its full title, status, blockers and badges. `↵` or `gi` opens the node’s item; `gt` opens its topic and `gs` its claiming session. Sideways scrolling keeps the label visible. Hub updates rewrite the canvas only when its text or highlights change, keeping the cursor on its node through layout changes; `␣␣` returns to that node after opening another view. Each parent remembers its own node. The board remains on `␣b`. Vertical labels fit the centre’s display columns (20–40 by default); a wide layer continues below itself under `↳` in the numbered gutter. `+` / `-` change the minimum vertical label width (14–36, in steps of two), or the sideways label width (18–60, in steps of four). Clipped text ends in `…`; focus the node for its full text in the winbar or open its item. The footer and key hints wrap independently of the canvas.
    **Known limits (spec §3.15).** At T-19’s density (22 linked items, 36 edges), crossings still take effort to follow. A vertical line passes over a broken horizontal line; it is never a `┼` junction. Selecting a node highlights its incident edges, but continuation rows add pass-through tracks and can increase crossings. Routing at greater density can exceed the window, so horizontal scrolling remains available. Bundling, collapsing done layers and a different projection remain fog for v0.2. Stage tags and `s` grouping belong to the separate stages slice (T-162); this view currently groups by blocking layers.
    **Headless evidence.** `node hub/bin/cland.ts --headless --qa qa/cases/GRAPH-001.lua --out <directory>` runs the successor to the prototype case on native hub `status`, `claim`, `verdicts` and `criteria` fields. Its fixture freezes T-19’s 44 children from T-86, with field snapshots from 2026-10-10, plus a synthetic workflow sampler; later unlinked tail items are excluded. It polls rendered state and writes complete `.canvas.txt` dumps and screen/state evidence at 120, 160 and 200 columns, with the sessions panel and at full width, plus sideways and live-update evidence. The case is part of `npm run test:nvim`.
- **Hub data** comes from the `message`, `delivery`, `topic`, `ask`, `inbox`, `presence`, `session.process`, `session.usage`, `session.state`, `session.role`, `role.vacant`, `role.filled` and `task` events. On each connect the shell reads `topic.list`, `task.list`, `session.list`, `hub.status`, `role.list` and a shared `inbox.list` once. Presence snapshots keep connected spokes current; process rows carry launches, renames and exits; usage snapshots update token and cost totals at most once per second per session. There is no refresh timer. Only a launch or stop made by this workbench refreshes its sessions and presence again; role and unknown-session events do not request lists. The shell and topic views share the inbox snapshot, kept by `inbox` events. An item view asks `task.view` for its body and comments. Every change renders once, in the next main-loop tick (`state.changed()`), whatever the burst.

### Keys

Space is the leader (`␣`); `␣?` shows the keys in Neovim.

| Key | Where | What it does |
| --- | --- | --- |
| `␣i` | Normal mode, anywhere | Toggle the items panel (left). |
| `␣n` `␣s` `␣t` | anywhere | Inbox, sessions or topics in the right panel. Pressing the active key hides the panel. |
| `␣T` | anywhere | Topics docked above the right panel, which shows the inbox (the Watch layout). Again: undock. |
| `␣N` `␣b` `␣L` | anywhere | The inbox full width, the board, the Agents log in the centre. Again: back. |
| `␣a` | anywhere | The palette on `~` artifacts; Enter opens, Tab switches kind. |
| `f` `F` | Agents log | Filter by an item id or session name (Tab completes both); clear the filter. |
| `L` | item view / sessions panel | Open Agents filtered to this item / the row’s session. |
| `r` | Agents log | Reply to the sender of the message under the cursor: a composer opens under the log (Enter sends, `q` in Normal mode cancels). |
| `␣P` | thread or composer | Open a full prompt draft buffer for this topic. |
| `␣g` `␣c` | anywhere | General; the composer of the current thread, in Insert mode. |
| `␣r` | anywhere | Resolve the topic in view (or under the cursor in the topics panel): its wait is cleared to open. |
| `1`–`6` `f` `F` | items panel | The filters board, in work, needs you, done, map, all; `f` and `F` cycle them. |
| `za` `zo` `zc` `zR` `zM` | items panel | Toggle/open/close a board fold, or open/close all folds. |
| `K` `J` `T` | items panel | Rank before/after the adjacent sibling, or to the top, through the hub. |
| `e` `E` | items panel | Next/previous open container scope; saved in `ui.json`. |
| `p` `P` Tab Shift+Tab | items panel | Next/previous epic tab; all is one choice. |
| `p` `P` | board | Next or previous open parent in the current release; all is one choice. |
| `␣G` | anywhere | Open the experimental task graph. |
| `p` `P` | graph | Next or previous open container of the current release, with the release last. |
| `h` `l` `j` `k` `^` `$` | graph | Move between nodes in the visible orientation; `^` / `$` select band ends vertically or end layers sideways. |
| `↵` `gi` `gt` `gs` | graph | Open the selected node’s item, topic or claiming session; `␣␣` returns to it. |
| `d` `o` `r` | graph | Show/fold done tray nodes, turn the orientation, show/hide implied edges. |
| `e` | item view | Open the item's file in a normal buffer; `:w` saves it and the hub re-indexes it. |
| `n` `c` `r` | topics panel | A new topic (asks for the title, then opens it); close the topic under the cursor; resolve it. |
| `1`–`9` | an ask in the inbox or its card in the thread | Answer with that option (`topic.answer`); the row leaves and the count drops. Elsewhere in a thread a digit is a count, as always. The maps are local to the thread and inbox buffers, so the items panel's `1`–`6` filters never meet them. |
| `i` | an ask in the inbox or its card in the thread | A free answer: the topic opens with its composer armed (`answer to: <question>` in its header), and Enter sends the text as the answer. Elsewhere in a thread `i` goes to the composer. |
| `↵` | inbox | An ask or a waiting topic opens the topic; an approval attaches the session in the centre (Terminal mode), where the harness asks; a notification opens its item, else its session. |
| `d` `D` | inbox | Dismiss the notification under the cursor; dismiss them all. Asks and approvals are not dismissed: `d` on them only says so in the status line. |
| `␣␣` | anywhere | The previous centre view; twice returns, like `CTRL-^`. |
| `gi` `gt` `gs` | any panel or view | The item, topic or session of the reference under the cursor (`T-12`, a topic's title, a session's name), else of the row (a board card too), else of the centre view. A session's item is the one it claims, an item's session the one claiming it, a topic's item the one it is bound to (and an item's topic its bound topic), a topic's session its Coordinator. `gs` shows the session in Normal mode. |
| `␣p` | anywhere | The palette over actions and objects together. Prefixes: `>` actions, `#` items, `@` sessions, `~` artifacts, `/` topics. Enter runs or opens; `C-v` opens an object in a split; Tab changes kind; Esc closes. |
| `↵` | panels, board | Open the row in the centre: a session attaches in Terminal mode, a topic opens its thread, an item (or a board card) its view. |
| `␣l` | anywhere | The session launcher (above). |
| `␣A` / `a` | anywhere / sessions panel | Launch an Aide with role defaults; focus its optional brief. |
| `l` `C-v` `x` `c` | sessions panel | Launch a session; attach the row's session in a vertical split beside the centre (Terminal mode; the centre view stays); stop it, after a line in the panel asks (`y` stops through `session.stop`, `n` or `Esc` keeps it); its adapter's capability table in a float (each state signal and optional capability as `reliable`, `heuristic` or `none`; `q` closes). |
| `za` `zo` `zc` `zR` `zM` | sessions panel | Toggle, open or close the stopped fold on its header or rows; open or fold it from anywhere with `zR` or `zM`. Enter or Tab on the fold header also toggles it. |
| `Enter` `Shift+Enter` | composer | Send; newline (`Alt+Enter` too). A message the hub refuses comes back, ahead of anything typed since. `@reviewer`, `@qa`, … or `@<session>` in the text addresses them instead of the Coordinator. |
| `C-h` `C-j` `C-k` `C-l` | every mode | Focus left, down, up or right; entering a composer or terminal resumes typing. Use the English layout for these chords. |
| `C-\` (also `C-\ C-n`) | session terminal | Leave Terminal mode immediately; Esc still goes to the harness. |

### Sessions grouped by state (T-127)

The panel lists **yours** (live Aides, when any), then **waiting, busy and idle**
for the crew, with counts, then one folded
`stopped (N)` line. Waiting includes both waiting for human and waiting for
approval. Unknown live sessions sit in idle with a `?` glyph; an exited process
sits in stopped with its death glyph. The hub supplies state and process changes;
the workbench never infers them from a session's status text or terminal output.

Each row shows glyph, name, role and item. Moving the cursor onto a session
expands its harness, model, state and running usage total; moving to another
session collapses the previous details. `j` and `k` skip detail lines. A state
event that changes the group keeps the cursor on the same session. Approval
details show `run: <command>` when the hub supplies `approvalCommand`; Claude
Code and Codex also supply a tool name for approvals without a command. Tool
input bodies are never copied into display metadata. OpenCode currently supplies
only the waiting state. Rows and chips use the shared display-cell fitter,
including wide text and ellipses.

The top-bar sessions chip counts **now sessions**, plus a separate amber waiting
count. Until T-115's visibility layers land, `state.session_now` counts every
session whose hub process is running (connected manual spokes count too);
stopped and exited sessions are excluded. Busy, waiting and idle totals include
Aides even while their rows stay in yours. All panel keys, including Aide launch
and the stopped fold, are registered actions
available in the palette. Ctrl chords use the English layout; Normal-mode letters
follow `keys.layouts`.

### Palette and action registry (T-126)

`␣p` always starts with an empty query. Results stay grouped in the order **actions,
items, sessions, artifacts, topics**, and the cursor starts on the highest-scoring
match across the groups. Matching uses Neovim's built-in `matchfuzzypos`: actions by
title and `:Cland` command, items by id/title/claim, sessions by name/role/harness,
artifacts by id/kind/title and topics by title. With no query, object builders keep
their panel order (waiting sessions first, current-topic artifacts first). Matches
are blue. Closed items, stopped sessions and closed topics are dimmed by the single
`palette.dim(kind, object)` function, to be replaced by T-115's visibility layers.

Type `>`, `#`, `@`, `~` or `/` to narrow to one kind; `␣a` starts with `~`. Tab
cycles all → actions → items → sessions → artifacts → topics → all, rewriting the
prefix and preserving the search text; Shift+Tab goes backwards. Up/Down or
Ctrl+n/p move between matches. Enter runs an action or opens an object. Ctrl+v
opens an item, session, text artifact or topic thread beside the centre. Threads
share their card buffer; a free answer still opens the centre composer. Browser
artifacts use the system opener. Object splits follow hub changes; session splits
retain the existing restart behavior. Esc closes and restores focus in Normal
mode. Ctrl chords require the English layout; Normal-mode letters use the existing
`keys.layouts`/`langmap` configuration.

Every action displays its key and a local key's scope, or **no key**. Local actions
use the matching visible buffer and its selected row; panel actions can open their
panel first. Object-specific actions ask for the appropriate view when none is
visible. Each open ask option is its own action and calls `ask_card.answer`, the
same `topic.answer` path as the inbox; accepted/withdrawn options disappear with
inbox updates. Free-answer actions use the same armed composer as the inbox.
Insert and Terminal actions resume their mapped mode before sending keys. Topic
actions use the focused view's topic, including a palette split.

`lua/cland/actions.lua` owns the declarations and `:Cland` dispatch/completion.
All shipped mappings call `actions.map`, which checks the declared key, scope and
mode before installing it and supplies the declared title. `actions.audit()` checks
actual global and buffer mappings for missing keys or disagreeing titles. The
headless test also rejects mapping calls outside this adapter.

For a later view, register its actions once when its module is loaded:

```lua
local actions = require('cland.actions')
actions.register({
  id = 'plan.open', title = 'Open epic plan', scope = 'item',
  keys = {{lhs = 'gp', modes = 'n'}},
})
-- When constructing the view's buffer, after setting vim.b[buf].cland_role = 'item':
actions.map('n', 'gp', function() open_plan(item_id) end, {buffer = buf})
-- Or register an action without a key:
actions.register({id = 'plan.refresh', title = 'Refresh plan', run = refresh_plan})
-- Optional :Cland command; mapped_id shares an existing action's key metadata.
actions.command('view plan', 'Open plan view', function(args) open_plan(args[1]) end)
```

The public API is `register(spec)`, `map(modes, lhs, rhs, opts)`,
`command(path, title, run, mapped_id?)`, `run(id, args?)`, `all()` and `audit()`.
Ids and scope/key pairs are unique. A scope is `vim.b.cland_role` or `global`;
`rhs` and mapping options follow `vim.keymap.set`. `all()` returns title, key,
command and a callable `run`, including the live ask options. A newly keyed scope
needs a visible view, or a panel/view opener in the registry's context resolver.

### Commands

| Command | What it does |
| --- | --- |
| `:Cland preset charting`, `watch`, `steady` | Examples of the three stages, never modes. charting: items beside General, the right panel hidden. watch: items, General, topics docked above the inbox. steady: the board and the inbox. Everything still toggles afterwards. |
| `:Cland view thread <topic>`, `session <name>`, `item <id>`, `board`, `log`, `inbox` | A centre view. |
| `:Cland graph [T-n]` | The experimental graph of the first open container in the current release, or a named container. |
| `:Cland panel items`, `inbox`, `sessions`, `topics`, `dock` | The panel keys as a command. |
| `:Cland launch [name]` | The session launcher, the name filled in. |
| `:Cland aide` | The Aide launcher, focused on the brief. |
| `:Cland topic new <title>`, `close [id]`, `resolve [id]` | Create a topic and open it; close or resolve the topic in view (or the one named). |
| `:Cland qa dump <path>` | Write the screen grid to `<path>.screen.txt` and the state snapshot to `<path>.state.json`, in any run (QA cases below). |
| `:Cland refresh`, `:Cland help` | Ask the hub again; the keys. |

## QA cases: `cland --headless --qa`

```sh
cland --headless --qa <case.lua> [--out <dir>] [--hub stdio|stub] [--timeout <seconds>]
cland --headless --qa qa/cases/SHELL-001.lua
```

One scripted QA case in one headless Neovim with no socket (spec 4.10, #57): the default QA lane, which needs no grant and runs inside a sandbox. The run prints one JSON line on stdout and exits with the result's code.

| Result | Exit | When |
| --- | --- | --- |
| `PASS` | 0 | The case's `run` returned. |
| `FAIL` | 1 | An `expect` did not hold. |
| `INCONCLUSIVE` | 2 | A `wait_for` timed out. |
| `BLOCKED` | 2 | The case could not run or broke: a Lua error in it (with its traceback), a case file that is missing or does not load, no Neovim, no temp dir for a stdio-hub case, `--timeout` (default 120 s) passed, or the run interrupted by a signal. |

```json
{"case":"SHELL-001","result":"PASS","duration_ms":490,"build":"b8368b3","hub":"stdio","evidence":{"screen":"…","state":{…}}}
```

- **`case`** is the file's name without `.lua`. **`build`** is the repository's short commit, else `v<version>` where git cannot run. **`message`** is there for every result but `PASS`: the expectation's message, what the wait was for, the error.
- **`evidence`** is the last screen and state, whatever the result. With `--out <dir>` they are the files `<dir>/<case>.screen.txt` and `<dir>/<case>.state.json`, and `evidence` lists the files written. Without it they are inline: `{"screen", "state"}`, plus `dumps` for what the case dumped along the way.
- **The fixture project.** A case never runs against the live project. The run builds the case's fixture in a directory of its own in the temp dir (`cland-qa-…/<project>`), starts the workbench on it, and removes it at the end.
- **The hub** is the workbench's stdio child: the real hub (`cland hub serve --stdio --no-listen`, which binds nothing) on the fixture project, or the stub hub (`test/stub-hub.ts`) with the case's scenario. `--hub` overrides what the case names.
- **The environment** is the run's own: `NVIM_APPNAME=cland-qa`, `--clean -u nvim/init.lua --headless`, a 160×45 grid, `TERM=xterm-256color`, `LANG=en_US.UTF-8`, `TZ=UTC`, `HOME` and every XDG directory inside the run's directory, no `--listen`, and the server socket Neovim opens by default stopped before the case runs. Nothing of the caller's environment is passed on but `PATH` and `TMPDIR`, so no `CLAND_*` variable of a session reaches it.
- **Nothing is left behind.** Neovim leads a process group of its own; the run kills what remains of it (the hub) and then removes its directory. A session terminal's job is stopped by Neovim when it quits. Once the result is printed, a Neovim that does not quit within 3 s is killed and the result stands.
- **In a sandbox.** With the network denied (no socket can be bound or reached) every case runs. With file writes denied outside the temp dir too, every case runs, and `--out` must be inside the temp dir. With every file write denied (a read-only rescue run) only the stub hub runs, and without `--out`: run a portable case with `--hub stub`. A stdio-hub case is `BLOCKED` there and says so.

### The case file

A case opens with its catalogue header, a block of comment lines with `id`, `title`, `preconditions`, `expected`, `since` and `regression` (the `qa` skill, `docs/review-and-qa.md`; `hub/test/skills-qa.test.ts` checks every shipped case has one). It is a Lua file that returns a table. Two ship in `qa/cases/`: `SHELL-001.lua` (General shows and a message goes `queued`) and `ITEMS-001.lua` (a fixture item in the items panel and its view).

```lua
return {
  title = 'A fixture item shows in the items panel',
  hub = 'stdio', -- or 'stub'; 'stdio' when left out
  fixture = {
    project = 'qa-items',
    items = { { id = 'T-1', kind = 'epic', title = 'Workbench shell' }, { id = 'T-2', title = 'Items panel', parent = 'T-1' } },
  },
  run = function(qa)
    qa.wait_for(function() return #qa.state().items == 2 end, 10000, 'the two fixture items')
    qa.keys('<Esc><Space>i')
    qa.wait_for(function() return qa.screen():find('T-2 Items panel', 1, true) end, 5000, 'T-2 in the items panel')
    qa.expect(qa.state().panels.left, 'the items panel is open')
  end,
}
```

| Field | What it is |
| --- | --- |
| `title` | One line saying what the case checks. |
| `hub` | `stdio` (the default) or `stub`. A case that uses only what both hubs answer is portable: leave `scenario` out of what it asserts and it runs with either. |
| `fixture.project` | The project's name, shown in the top bar (`qa-project` when left out): a plain directory name (letters, digits, `.`, `_`, `-`, not starting with `.`), or the case is `BLOCKED` before anything is written. |
| `fixture.items` | The items: `id` and `title`, and optionally `kind`, `state`, `labels`, `assignee`, `parent`, `blocked_by`, `topic`, `branch`, `created`, `updated`, `body`, `comments` (`{ author, at, text }`). An `id` is `T-<n>`, or the case is `BLOCKED` before anything is written. For the stdio hub they become item files in `.cland/tasks/`, written by the tracker's own writer (`cland --qa-fixture`, `hub/src/cli/qa-fixture.ts`), so they read back as given; for the stub hub they are its `task.list`. Times left out are `2026-01-01T00:00:00.000Z`. |
| `fixture.roles`, `fixture.config` | The text of `.cland/roles.toml` and `.cland/config.toml` (the stdio hub reads them). |
| `scenario` | The stub hub's scenario (`test/stub-hub.ts`): `processes` (sessions with their states), `presence`, `adapters`, `coordinator`, `topics`, `messages`, `inbox`, `roles`, `attach`, `send`. Its `items` win over the fixture's. |
| `run` | `function(qa)`: the case. |

### The Lua QA API

| Call | What it does |
| --- | --- |
| `qa.keys(keys)` | Types the keys with `nvim_input()`, in its notation (`<CR>`, `<Esc>`, `<Space>`, `<C-v>`). They are consumed when it returns. Up to 4 KiB go in at once. A longer sequence goes in chunks of at most 4 KiB (Neovim's input buffer holds 16 KiB, and one filled to the brim takes nothing more), with a pause between them that ends whatever command or mapping is pending; so it is cut only right after an `<Esc>` or a `<CR>`, and a stretch of more than 4 KiB with neither is refused before anything is typed (`BLOCKED`): put an `<Esc>` or a `<CR>` where the mode is known, or split the keys over several calls. Input Neovim stops taking for about 5 s ends the case `BLOCKED` too. |
| `qa.wait_for(predicate, timeout, what)` | Waits (over `vim.wait()`) until `predicate()` is truthy and returns its value. After `timeout` ms (5000 when left out) the case ends `INCONCLUSIVE`, naming `what`. |
| `qa.screen()` | The grid as text, read with `screenstring()` after a redraw: 45 lines joined by newlines, trailing blanks cut. Floating windows and terminal buffers are in it. |
| `qa.state()` | What the client knows, as a table: `project`, `root`, `hub` (`state`, `detail`), `mode`, `view` (`kind`, `id`), `panels` (`left`, `right`, `dock`), `sessions` (`name`, `role`, `label`, `harness`, `model`, `state`, `status`, `live`, `launched`, `item`), `coordinator`, `roles`, `topics` (with their `status`), `asks` (the open ones), `needs_you`, `items`. Topics, asks, items and roles are as the hub sent them. |
| `qa.expect(condition, message)` | Ends the case `FAIL` with `message` unless `condition` is truthy. |
| `qa.dump(path)` | Dumps the grid and the state now. A relative path is under `--out` (`<out>/<path>.screen.txt`, `<out>/<path>.state.json`), or, without `--out`, inline in the evidence as `dumps[path]`. |
| `qa.root` | The fixture project's directory. |

**How a case runs.** The case is a coroutine inside Neovim. Keys typed with `nvim_input()` are consumed by Neovim's main loop only, never while Lua runs, `vim.wait()` included. So `keys` and `wait_for` hand control back to the main loop and continue from a scheduled callback, the way an RPC client's requests arrive between keys. Two rules follow:

- **One mapping, one `keys` call.** `qa.keys('<Space>i')`, never `qa.keys('<Space>')` then `qa.keys('i')`: an event between the two ends the pending mapping.
- **Wait for the effect, not for time.** After keys that ask the hub for something, `wait_for` what the screen or the state should show.

## The pinned Neovim

| File | What it is |
| --- | --- |
| `NVIM_VERSION` | The release tag cland runs on, the one place it is set (`v0.12.5`). |
| `NVIM_SHA256SUMS` | The sha256 of each release tarball cland accepts (macOS and Linux, arm64 and x86_64), copied from the release's asset digests. |
| `bin/nvim-path.ts` | Prints the binary's path. It downloads the official tarball for this machine into `.cache/nvim/<tag>/` at the repository root (ignored by git) when missing, checks it against the pinned digest, unpacks it, and clears the macOS quarantine attributes. Two resolvers share the download through `.download.lock` in the cache: created whole, naming its pid; one whose pid is dead, or that names no pid and is older than 5 s, is stale and broken under a guard (`.download.lock.break`) only if it still reads as found, so concurrent breakers never remove the lock one of them then took. `CLAND_NVIM` names a binary to use instead. |
| `bin/cland-nvim` | The launcher above. |

## The ADR 0005 mitigations

In `init.lua`, and in the shell:

- **Shift+Enter in terminals.** Terminal mode maps `<S-CR>` to the kitty CSI-u sequence `ESC[13;2u`, so a harness sees Shift+Enter.
- **Pastes.** `'termpastefilter'` is `BS,ESC,DEL`, so pasted TABs survive.
- **Scrollback.** `'scrollback'` is 10,000, set before any terminal exists.
- **No hit-enter prompt.** `'cmdheight'` is 1, `'shortmess'` gains `aIcCFsWS`, and cland's notices are one line in the status line or its own buffers, never in the message area (`vim.notify` is replaced).
- **UI updates through `vim.schedule`.** Every hub frame is handled in the main loop, never in a libuv callback, and lands while the human types: Insert mode in the composer is kept. A handler, a request's callback or a refresh timer that fails says so in one line on the status line (`cland: …`), never as an error in the message area; a hub text over several lines (an ask's question or options, a note) is split into buffer lines or flattened, never put in one line.
- **Sessions owned outside Neovim.** Session terminals only attach, `:restart` re-attaches them, and no session terminal is below three rows.

## Snapshot and event ordering

On each connection the shell fetches its lists, then follows live events. A reply can arrive after events
that changed the same data. Each snapshot request owns a client-side journal of the events received while
it was pending. The shell installs the reply as its baseline, then reapplies the relevant updates in arrival
order before rendering. Item upserts and removals, session fields, presence, the Coordinator chip, inbox
counts, artifact metadata and ask cards are idempotent: replaying an event already included in the reply
neither duplicates a row nor restores a deleted one. Topic events supply complete authoritative rows;
message replay changes only `unread` and `lastMessageAt`, never cached titles or status. The fetched topic's
`lastMessageAt` is the watermark: messages beyond it are counted once by id, messages before it are already
represented. Equal or missing timestamps trigger another snapshot for an authoritative unread count,
rather than guessing whether the reply included that message.

The journals belong to individual requests, including overlapping refreshes. A successful reply releases
its journal before applying it. Journals record only that panel's relevant events and are bounded by a
30-second deadline, 2,048 events and 2 MiB. Hitting any limit drops the journal, cancels the old callback and
requests a fresh snapshot; late replies to cancelled attempts are ignored. Live event handlers continue
applying updates throughout. A failed request or disconnect releases the journal and keeps the live panel
data already applied; reconnect fetches a new baseline, including removals missed while away. The inbox
client already prefers its latest whole `inbox` event over a pending `inbox.list` reply. Topic histories
merge messages by id and advance delivery stages; their journals also replay ask cards and delivery events
that arrived before the history's messages. The Agents log merges immutable messages by id and rejects
answers for superseded filters. Item detail fetches retain invalidation while pending and fetch again.

This rule needs no hub sequence or wire protocol change: the new client works with existing hubs. Older
clients keep their existing snapshot behavior. No polling delay or longer timeout establishes ordering.

## Modules

| Path | What it is |
| --- | --- |
| `init.lua` | The entry point: the runtime path, the mitigations, the options the shell needs, then `require('cland').start()` on `VimEnter`. |
| `lua/cland/init.lua` | Finds the project root, creates the hub client, loads the hub's data on every connect, applies events over pending snapshots, wires the keys, `:Cland` and the autocommands, and restores a restart snapshot. |
| `lua/cland/hub.lua` | The hub client: the Unix socket through `hub.json` (reconnecting with backoff, re-reading the file each time, `cland hub start` when none answers) or a stdio child; JSON lines; requests by id; `message`, `delivery`, `session.state`, `session.role`, `role.vacant`, `role.filled`, `state` and `connected` handlers. It subscribes on every connect. |
| `lua/cland/state.lua` | The state: topics, sessions (launched and connected), capability tables, items, the centre view and its history, the open panels; `changed()` renders once in the next tick. |
| `lua/cland/layout.lua` | The windows: panels as top-level splits, the centre and its composer, the view switch and `␣␣`, the presets, the rebuild after a restart. |
| `lua/cland/bars.lua` | The top bar (tabline), the status line, the panel headers (winbars), with the bar-background twins of the highlight groups. |
| `lua/cland/panels.lua` | The items, sessions, topics and inbox panels: drawn from the state, each row knowing what it shows; `↵` opens it. |
| `lua/cland/views.lua` | One topic view per topic, the topic actions (create, close, resolve, read), the item view and the board through their modules, the Agents log through `agents_log.lua`, and the inbox full width through `inbox.lua`. |
| `lua/cland/items.lua` | Hub status/rank/levels, release scope, glyphs, filters, folds, map groups and badges, the `task` event, and the items panel (tree, filters, keys). |
| `lua/cland/item_view.lua` | The item view: the fields column, the body, the verdicts and comments from `task.view`; `e` edits the file. |
| `lua/cland/board.lua` | The board: seven hub-status columns scoped to open parents of the current release; parent filters; `↵` opens the card under the cursor. |
| `lua/cland/graph.lua` | The experimental graph view over `graph_layout.lua`: release parent cycle, hub node fields, criteria adapter, folded tray, node cursor and edge focus, winbar, scrolling and visible-change updates. |
| `lua/cland/sessions.lua` | Session terminals: the attach command from `session.attach`, one request in flight per session, re-attaching after a restart. The panel's stop (`session.stop` after the confirmation line) and the capability table float. |
| `lua/cland/launcher.lua` | The session launcher form: the fields, the role's launch defaults, `session.launch` and its refusals. |
| `lua/cland/picker.lua` | Object entry builders and compatibility calls into the palette. |
| `lua/cland/palette.lua` | The floating fuzzy search, prefixes, grouping, selection and split opening. |
| `lua/cland/actions.lua` | Action declarations, checked keymaps, command dispatch/completion and live ask answers. |
| `lua/cland/agents_log.lua` | The Agents log: the rows (time, `sender [Role] → addressee`, kind glyphs), kept current by `message` events, item/session filters with `f`/`F`/`L`, and `r`'s reply composer. |
| `lua/cland/inbox.lua` | The inbox: its sections (asks, approvals, waiting, notifications) in the right panel and full width, `1`–`9`, `i`, `↵`, `d` and `D` on its rows. |
| `lua/cland/ask_card.lua` | An ask as a card (the question, the numbered options, its state) and the `1`–`9` and `i` keys on a buffer's ask rows, shared by the thread and the inbox. |
| `lua/cland/motions.lua` | `gi`, `gt`, `gs`: the reference under the cursor, the row, or the view, then the dispatch. |
| `lua/cland/restart.lua` | The restart snapshot file. |
| `lua/cland/thread_md.lua` | Cached per-body Markdown spans and compact link/table projections; no whole-thread parser. |
| `lua/cland/topic_view.lua` | One topic's thread and composer, wired to the client (history merged on every connect). |
| `lua/cland/thread.lua` | The thread buffer: `sender [Role]` (the role's label) and local time on each message's header. The human's own messages show their delivery stage right-aligned (`⌁ queued`, `✓ delivered`, `✓✓ injected`), changed in place on `delivery` events. A one-line notice under the messages tells about the hub connection or a failed send. A cursor away from the tail stays where it is. |
| `lua/cland/composer.lua` | The composer, a prompt buffer. Enter sends, Shift+Enter (or Alt+Enter) inserts a newline. The text is kept until the hub accepts it and put back on a refusal. |
| `lua/cland/ui.lua` | The debounced, atomic store for per-machine UI preferences in `.cland/ui.json`. |
| `lua/cland/qa.lua` | The QA lane: the screen grid as text, the state snapshot, `:Cland qa dump`, and the runner of `cland --headless --qa` with the Lua QA API (below). |
| `lua/cland/hl.lua` | The design's colours and glyphs: delivery stages, session states, item states. |

## Tests

```sh
npm run test:nvim          # from the repository root; `npm test` runs it after the hub's tests
```

Every test starts the real client headless as `nvim --clean -u nvim/init.lua --headless --listen <socket>`, under `NVIM_APPNAME=cland`, attaches a 160x45 UI over msgpack-RPC (`test/rpc.ts`), drives it with `nvim_input` and reads the screen back with `screenstring()` (`test/harness.ts`). When a test runs `:restart`, the harness follows the UI's `restart` event to the new server, as a terminal UI does.

- `test/client.test.ts` runs against a real hub (`cland hub start`) in a temporary project and connects real spokes over MCP: sending, delivery stages, Shift+Enter in the composer, the stdio transport, a clean configuration, autostart (also over a stale `hub.json`), following a hub restart.
- `test/items.test.ts` runs against a real hub with item files written by hand (and a claim through `cland task claim`): the tree, the map grouping, the item view and the board; a hand-written file shows in the panel within a second; `e` opens the file and a save re-indexes it.
- `test/shell.test.ts` runs against `test/stub-hub.ts`, a stub hub on stdio with scripted topics, sessions (states, capability tables, attach commands) and items, which emits events on command through a control socket: the top bar, every panel key, the session view and `␣␣`, the palette, `gi`/`gt`/`gs`, the presets, the topics panel (groups, pinning, unread badges, the warning glyph, Enter, `n`/`c`/`r` and `:Cland topic`), the palette's topics kind, the thread header with the status and the binding, an event while typing, a burst of events without a hit-enter prompt (and four writes of 50 waves of every event kind, malformed ones among them, with Insert mode, the typed text and an empty message area kept), a coordinator `null` after a reconnect, an item view and an ask card made current again after a reconnect (also an ask older than the history the reconnect reads, closed through `inbox.list`), an attach client that ended attached again, a deeply indented list, multi-line asks, Shift+Enter and a tabbed paste reaching a session (`test/fakes/keylog.ts` logs the bytes its tty reads), refused sends, a real `:restart` re-attaching the session terminal and a `C-v` split, the sessions (#28): the launcher's frame with typed values and role defaults, the item line sending `item` without the directory, refusals in the form and the panel, the roleless warning, `C-v`, `x` with its confirmation line and `session.stop`, `c`, `unknown` from an event and from a dead process, the palette's order and filters, and the items (#36) over a fixture set: the tree, each filter and the map grouping, the item view's fields column, verdicts and comments, the board's explicit status columns and task events moving a card, `gi`/`gt`/`gs` between items, topics and sessions both ways (a topic event binding an item followed), `task` events, and the palette's items kind, and the inbox and asks (#33): the sections in order with the top bar's count, `2` on an ask row, `i` arming the composer for a free answer, `d` and `D`, the ask card in the thread answered with `2`, the inbox full width.
- `qa/cases/PANELS-015.lua` covers `␣A`, panel `a` and the palette action, role defaults, briefs and successive centre attachments. `PANELS-016.lua` covers the yours group above crew state groups, arbitrary Aide names, connected manual Aides, counts that include waiting Aides, stopped folding and Enter attachment. Both run in `test/qa.test.ts` on the stub hub and poll rendered state. `test/palette.test.ts` also checks the launch frames for defaults, the project root, brief text/omission and name collisions in processes and presence.
- `test/sessions.test.ts` runs against a real hub with the three fake harnesses of `hub/test/fakes` first on the PATH: Claude Code, Codex and OpenCode sessions launched from the launcher, each in the panel with the model chosen and a live state, attached with Enter (each fake's attach client prints its own line in the terminal), a killed one `unknown · died` with `harness-exited` in the hub's log, and `x` `y` stopping one (`session-stopped`), and the Agents log (#34): rows with `sender [Role]`, kind glyphs, an event adding a row, `␣L`, `:Cland view log`, `r` preparing a reply with `replyTo`.
- `test/palette.test.ts` covers action execution and keys, keymap drift, prefixes/group order/best match, Tab/Esc, object splits, hub ask answers, dimming and blue matches, and display-cell fitting. Shipped `PANELS-007` and `PANELS-008` exercise palette opening and answering through the headless QA runner.
- T-127's stub-event test in `test/palette.test.ts` covers state groups, chip updates, approval commands and cursor preservation across group moves. `PANELS-009` and `PANELS-010` cover groups/folding and selected approval/usage details through the headless QA runner.
- `test/ui.test.ts` checks manual resizing across view/preset switches and fresh Neovim processes against the stub hub, custom panel sets, filters, the persisted container pick, corrupt input, debouncing, and killing the writer before rename. Shipped `PANELS-005` and `PANELS-006` continue the prototype panel cases with persistence and failure checks.
- T-136 adds `THREAD-009` and `THREAD-010` for the fitted needs-you count at 120/80 columns, updated by T-169 to use only the hub’s `needsYou`. The headless cases push actual stub-hub message/inbox/ask frames, including 427 mixed notifications with hub count zero and changed hub values, then cover messages, ask identity, reading and resolutions without local additions. Stub-hub shell tests also cover unknown startup counts, `hub.status` before inbox rows, local answers, and cold/reconnect history snapshots with live frames arriving before the answer.
- T-132's `test/thread.test.ts` counts touched lines through Neovim's buffer events (including shared topic splits), covers strict retention and delivery progress, and measures append and rewrite/redraw at 200 messages. The differential compares fold ranges, membership and open state against a fresh buffer through extensions, splits, first-member eviction, unions, rewrites and multi-step hidden appends that evict every original member. `THREAD-005` and `THREAD-006` succeed `THREAD-KEYS` at 120/80 columns, checking all fold keys, counts, boundaries and composer Insert appends. The differential adds Markdown, unclosed fences, responsive tables and link destination metadata at 120/80 columns; parser-boundary instrumentation verifies one fresh parse per append and plain rejection fallback. `THREAD-003` and `THREAD-004` exercise Markdown and four T-86 narrow-width breakages at 120/80 columns (foldtext clipping is covered by T-134 in `THREAD-005`/`THREAD-006`). `THREAD-001` and `THREAD-002` are the 120- and 80-column successors of the prototype's `THREAD-PROTO`, checking headers, local days, gutters, bands and intact wrapped ids on the stub hub.
- `test/qa.test.ts` runs `cland --headless --qa` as a process: the exit code, the JSON line and the dump files for each result (the shipped cases and the ones in `test/qa-cases/`), the state snapshot against a stub scenario, `:Cland qa dump`, `--timeout`, and the three `sandbox-exec` profiles above (skipped with the reason where `sandbox-exec` is missing); a run started inside a live project with a user configuration planted leaves both alone and leaves no process.
- `test/agents-filters.test.ts` runs headless Neovim against a real hub: item/session completion, history and live filters (including bound-topic notices and a metadata collision), clearing, and `L` from an item view or session row.
- `test/nvim-path.test.ts`: the resolver from a path with a space, `#` and `%`; a linked worktree using the main worktree's cache; two resolvers on an empty cache (one download); an empty lock taken over after the grace; two resolvers breaking the same dead holder's lock (one download, no lock removed from under its holder).

The binary comes from `CLAND_NVIM`, else the cache (a linked git worktree with none of its own uses the main worktree's, so a session working there with the network closed needs no download), else a download as above. When none of these works, for example offline with an empty cache, the client tests are skipped with the reason.


## Shared artifacts

Topic messages with artifacts show a chip such as `▣ A-3 diagram · Merge flow`. Put the cursor on it and press Enter to open it. Markdown opens as a read-only buffer; Mermaid opens as source with the `mermaid` filetype (decision D12). Press `R` in a Mermaid buffer to open a generated browser page using Mermaid 11.4.1 with strict security. That preview needs browser access to the pinned CDN module. Press `q` or `␣␣` to return to the previous centre view.

HTML, SVG, PNG, PDF and other common images open through the system opener (`open` on macOS, `xdg-open` elsewhere). `CLAND_OPENER` can name a replacement executable; it receives the absolute file path as its single argument, including for Mermaid previews. Tests use this to record opening without launching a browser.

The thread header counts the topic's artifacts. Press `ga` in the thread for its artifact list, with id, kind, title, creator, status and time; Enter opens the selected row and `q` returns. The Agents log also counts artifacts and supports Enter on a chip and `ga` for its list. `:Cland view artifacts <topic>` opens that list directly. `␣a` opens the palette with `~`; Tab cycles to topics, all kinds, actions, items, sessions and artifacts. Artifacts from the current topic appear first. Type an id, kind or title to filter, then Enter to open.


## Prompt drafts

In a thread, `:Cland prompt [title]` (for example `:Cland prompt Brief for T-12`) or `␣P` next to `␣c` opens an empty prompt artifact in the centre as a normal editable Markdown buffer. `:w` saves its durable `.cland/artifacts/A-<n>-<slug>.md` file. Drafts appear with status `draft` in `ga` and the artifacts palette, where Enter reopens the saved buffer. Incoming hub events update metadata while preserving draft text, cursor and unsaved edits.

`:Cland prompt send` saves and sends the draft's text when it fits the hub's configured byte cap, with the usual queued/delivered/injected stages. Larger drafts send a one-line message with the artifact attached. `:Cland prompt attach` always attaches it. Buffer keys `␣ps` and `␣pa` do the same. A successful post marks the artifact `sent`; refusal keeps the draft available for correction. The file is reserved when the draft opens, so it is available in the palette even before its first save. `q` returns to the thread; attached messages show their text and an opening chip for each artifact.

## Focus and keyboard layouts

`C-h/j/k/l` are focus moves in every mode, including Terminal mode. They take those
chords from the harness (notably `C-j` for newline and `C-k` for delete to end of
line). Backspace remains available. Shift+Enter reaches a harness as `ESC[13;2u`
through the existing `<S-CR>` mapping; Alt+Enter still passes through. Both keys
insert a newline in the composer. No Esc or Meta focus/leave binding is added.
A lone `C-\` leaves Terminal mode; the `C-\ C-n` habit still leaves it, though
its second key runs in Normal mode. The old `C-\ C-o` and literal `C-\ C-\`
terminal sequences are replaced by the lone-key mapping.

`cland doctor` warns, with fixes, when the effective Shift+Enter binding in
the standard Ghostty config files is `shift+enter=text:\n` (Shift+Enter then collides with `C-j`), or the
invoking tty has `erase = ^H` (legacy `C-h` then becomes Backspace). Remove that
Ghostty binding and reload its config; use `stty erase '^?'` in the affected tty.
A non-tty invocation cannot inspect a tty's erase setting. The standard config
locations, case-sensitive config keys and quoted values follow
[Ghostty's configuration documentation](https://ghostty.org/docs/config). The
last binding for Shift+Enter wins, including an unbind; the pinned Ghostty 1.3.1
loads the older `config` before `config.ghostty`, then macOS files after XDG
([pinned implementation](https://github.com/ghostty-org/ghostty/blob/v1.3.1/src/config/Config.zig#L3793)).

Opt into Normal-mode layout translation in `.cland/config.toml`:

```toml
[keys]
layouts = ["ru"]
```

The default is `[]`; `ru` is the supported layout. The hub reads this setting at
startup and returns it to the workbench in `hub.status`; restart the hub to apply
a config change. Neovim sets one `langmap` option string per named layout, for
letters, uppercase letters and punctuation. For example, Russian `о` acts as
Normal-mode `j`. Composer and terminal text stays Cyrillic; mapped RHS keys are
not translated (`langremap` is off). Unknown layout names produce a status notice.

### Kitty base-layout check (T-124, 2026-10-09)

The pinned Neovim **0.12.5 does not use the base-layout alternate** for Ctrl
chords. Free-keys probe A replayed `CSI 1088::104;5u` into an actual Neovim TUI
running in a PTY: `vim.on_key` logged `KEY <C-р>` and the Cyrillic candidate map
fired; the English candidate did not. The control `CSI 104;5u` logged `KEY <C-H>`
and fired `MAP <C-h>`. These candidate maps exist only in the research probe.
The Coordinator chose §3.12's fallback: focus chords need the English layout,
with no Cyrillic duplicates and no TUI patch. Russian Normal-mode keys use
`langmap` independently.

Evidence: artifact **A-219**, stored at
`.cland/artifacts/A-219-t-124-kitty-base-layout-probe-neovim-0-12-5.txt` in the
project root (topic `topic-42`). Repeat using the kit on `origin/research/free-keys`:

```sh
# Extract docs/research/free-keys/ from that ref into a scratch directory first.
FK_OUT="$KEY_PROBE_OUTPUT" NVIM="$CLAND_NVIM" sh "$KEY_PROBE_KIT/run.sh" A ghostty xterm-ghostty
```

The T-124 report also records probe B with tmux defaults and with extended keys,
and probe A with tty erase `^H`. These runs replay bytes through real PTYs and
Neovim's TUI, including Ghostty's legacy and kitty encodings; they do not drive
Ghostty's GUI keyboard. Physical-key checks in Ghostty and tmux remain for the
human's demo. With tmux defaults Shift+Enter arrives as plain Enter; Alt+Enter is
the newline fallback. `extended-keys on` with `extended-keys-format csi-u` preserves
Shift+Enter. The Shift+Enter, paste-tab, scrollback and attach-only workarounds
from ADR 0005 remain in place.

Container kinds follow the hub's loaded `[tracker] levels` from `.cland/config.toml`, exposed through `hub.status.tracker.levels`. The items panel treats each configured container (including an empty one) as a container; the board displays tasks with an explicit workflow status.

T-123's stub-hub tests in `test/shell.test.ts` cover all status transitions, T-80's unclaimed review/QA regression, board parent filtering and closing parents, configured three-level folds, SemVer release selection, current-release done scope and rank ordering against `hub/test/fixtures/rank-order.json` plus the final `siblings` event. `PANELS-011` covers the seven board columns and `p`/`P`; `PANELS-012` covers all five in-work statuses, current-release done and unscheduled last through `cland --headless --qa`. Both run in `test/qa.test.ts`.

T-128's `test/vboard.test.ts` uses one all-status fixture for the vertical panel and centre columns: status/epic ordering, glyph colors, marks, criteria fractions, folds and shared epic tabs. It also probes result-only and refused rank requests, authoritative final siblings, cursor following, cold-restart scope persistence, same-timestamp body edits and Unicode fitting at narrow widths. `PANELS-013` and `PANELS-014` succeed the prototype's `PANELS-001`–`PANELS-004` with hub rank events and configured-container scope persistence; both run through `test/qa.test.ts`.
