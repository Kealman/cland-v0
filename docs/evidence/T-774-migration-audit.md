# T-774 Neovim migration and assertion audit

Baseline: `700a029a02789db5bf0525986b3991ee4065b4f8`. Scope is every one of A-4961’s 27 Neovim rows. The Coordinator accepted explicit native keeps in topic-510, decision `19dc76f5-5a4f-4072-8d0b-fcc5e537896d`.

All 291 original test declarations remain under their exact original titles (table-driven declarations retain every input). 162 declarations move to T2 and 129 remain native. All 1,317 original test-local direct assertion calls are byte-identical, in their original per-test order; no expected value, operator, input table or title is weakened. Counts are source declarations/call sites, not expanded runtime cases.

Only three test bodies differ: the client composer/isolation cases replace hub setup with the recorded stdio stub; the layers done/pin case replaces two blind 100 ms waits with bounded observations of the exact panel condition, retaining its final assertions. Other moved test bodies are byte-identical.

Fixtures now use the neutral admission/ownership path; shell control/reconnect waits observe socket readiness and round-trip completion. Plan view observations are extracted unchanged into plan-view-support.ts, so the component import closure excludes the native plan setup. All 26 current Neovim T2 import closures are empty of hub runtime/harness code.

## Every A-4961 row

| Original file | Moved / kept declarations | Disposition and specific native proof |
| --- | ---: | --- |
| nvim/test/agents-filters.test.ts | 0 / 2 | Explicitly kept. Live claim/release and bound-topic history, MCP/UI filtering and loop-breaker metadata exclusion. Later split candidate: recorded log screens with the existing hub rule family. |
| nvim/test/artifact-browser.test.ts | 1 / 10 | Same-title component split. Real artifact folder/file edits, promotion/deletion, watcher updates and attachment transactions. Later split candidate: static browser rows after separating the transaction assertions. |
| nvim/test/artifacts.test.ts | 0 / 9 | Explicitly kept. Actual hub restart and disconnected draft rebinding, editable file saves, browser opener and artifact transactions. Later split candidate: chip/picker permutations after separating those file/transaction assertions. |
| nvim/test/client.test.ts | 2 / 4 | Same-title component split. Actual stdio hub child startup/shutdown, missing/stale discovery and real hub restart/reconnect. |
| nvim/test/crew.test.ts | 0 / 1 | Explicitly kept. Crew CLI writes, external hand edits, invalid-file refusal in the hub log and last-good watcher state. Later split candidate: summary-only rendering with a separate watcher proof. |
| nvim/test/criteria.test.ts | 3 / 2 | Same-title component split. Watched criterion edits, permanent allocated ids and Git-head verification freshness; a same-timestamp disk save refreshes the shown card. Later split candidate: display-only portions after separating the watcher/Git assertions. |
| nvim/test/events-quiet.test.ts | 3 / 0 | Whole-file T2; existing recorded-frame screen assertions are retained. |
| nvim/test/explorer-card.test.ts | 14 / 1 | Same-title component split. Real task.create parsing reaches the displayed summary and cursor-preserving card navigation. Later split candidate: fixture the parsed body after separating actual hub replies. |
| nvim/test/explorer-compose.test.ts | 8 / 1 | Same-title component split. A real Coordinator receives the explorer text and the real tracker binds its new topic. Later split candidate: retain one workbench delivery proof and replay the remaining context. |
| nvim/test/explorer-roots.test.ts | 7 / 1 | Same-title component split. Actual category creation and ranked child summaries reach the root outline. Later split candidate: split the producer reply assertions from the screen. |
| nvim/test/explorer.test.ts | 16 / 2 | Same-title component split. Cold editor preference writes/reopen and production-format restart-snapshot restoration. |
| nvim/test/graph-layout.test.ts | 0 / 1 | Explicitly kept. Pinned native LuaJIT/Neovim interpreter executes the graph layout corpus without a UI or hub; kept as A-4961 specifies. |
| nvim/test/inbox-requests.test.ts | 0 / 1 | Explicitly kept. Aide MCP review request, cland inbox CLI and actual reply transactions agree with the chip. Later split candidate: separate the CLI/MCP rule proof from rendering. |
| nvim/test/item-prefixes.test.ts | 0 / 2 | Explicitly kept. Real configured tracker prefixes and CLI edit/watch updates reach all item, graph, message and launcher surfaces. Later split candidate: recorded prefix screens after separating the live tracker assertion. |
| nvim/test/items.test.ts | 0 / 5 | Explicitly kept. Native Lead launch, CLI claims/verdicts, Git freshness and hand-written/edited tracker files re-index into all views. Later split candidate: pure title/colour/container permutations. |
| nvim/test/layers.test.ts | 9 / 4 | Same-title component split. Actual harness death notifications, competing ui.json writer locks, EPERM process observations and cold UI preference restoration. |
| nvim/test/needs-you.test.ts | 0 / 1 | Explicitly kept. Store-reopened waiting topic, native harness approval signals, verdicts, real visibility preferences and cold snapshots match literal chip and inbox counts. Later split candidate: same-title hub count proofs plus recorded screens. |
| nvim/test/nvim-path.test.ts | 0 / 5 | Explicitly kept. Native binary resolution/download/install and isolated launcher/lock behaviour; kept as A-4961 specifies. |
| nvim/test/palette.test.ts | 13 / 5 | Same-title component split. Native terminal attachment and Shift+Enter byte delivery, Aide attach and actual Coordinator receipt of a palette answer. |
| nvim/test/plan.test.ts | 4 / 5 | Same-title component split. Real watched plan reparent/removal, hub plan writes/gates, disk last-look receipts and actual editor restart. Later split candidate: live rule assertions separated from display-only plan history. |
| nvim/test/qa.test.ts | 0 / 23 | Explicitly kept. Native QA CLI/interpreter, PTY/key transport, readonly runtime and interrupt contracts; kept as A-4961 specifies. |
| nvim/test/rulebook.test.ts | 1 / 3 | Same-title component split. Actual stdio hub rule drafts/CLI writes, file-watcher pushes and historical message-origin lookup. Later split candidate: list/origin rendering after separating persistence and refusal rules. |
| nvim/test/scenarios/workbench.test.ts | 0 / 6 | Explicitly kept. Named real-hub attach/send/ask/artifact/explorer/graph/plan process scenario and live producer drift recorder, retained unchanged. |
| nvim/test/sessions.test.ts | 0 / 5 | Explicitly kept. Three native harness launch/attach/SIGKILL contract, account probe pushes/limit enforcement and verifier hold transactions. Later split candidate: hold/account display after separating those native assertions. |
| nvim/test/shell.test.ts | 58 / 21 | Same-title component split. Real PTY attachments, key bytes, interruption, reconnect/restart and terminal navigation. The negative no-poll and closed-ask windows remain unchanged to preserve their assertion meaning. |
| nvim/test/thread.test.ts | 23 / 0 | Whole-file T2; existing recorded-frame screen assertions are retained. |
| nvim/test/ui.test.ts | 0 / 9 | Explicitly kept. Cold Neovim restarts and WinClosed/WinResized preference/event ordering, retained unchanged. |

## Exact moved titles

Each row is covered by the mechanical assertion audit; its original assertion sequence is unchanged.

| Source | Destination | Original title | Assert calls |
| --- | --- | --- | ---: |
| nvim/test/artifact-browser.test.ts | nvim/test/artifact-browser-component.test.ts | a refused ordinary send restores artifacts when an ask was armed while its reply was pending | 1 |
| nvim/test/client.test.ts | nvim/test/client-component.test.ts | Shift+Enter inserts a newline in the composer; Enter sends both lines as one message | 4 |
| nvim/test/client.test.ts | nvim/test/client-component.test.ts | nothing loads from the user configuration: every sourced script is the bundled runtime or nvim/ | 8 |
| nvim/test/criteria.test.ts | nvim/test/criteria-component.test.ts | hub marks drive item glyphs, authors and notes; legacy checked boxes stay open at 80 and 120 columns | 3 |
| nvim/test/criteria.test.ts | nvim/test/criteria-component.test.ts | wide and combining criteria text and marks fit 80/120 layouts; repeated headings render the list once | 9 |
| nvim/test/criteria.test.ts | nvim/test/criteria-component.test.ts | verdict thread shows structured verified and failed criteria, including notes and clear report marks | 1 |
| nvim/test/events-quiet.test.ts | nvim/test/events-quiet.test.ts | one row per verdict counts once in the live inbox, warnings view and saved-filter cold start | 4 |
| nvim/test/events-quiet.test.ts | nvim/test/events-quiet.test.ts | events keys, warning/dim presentation, independent mutes, last look and cold persistence | 11 |
| nvim/test/events-quiet.test.ts | nvim/test/events-quiet.test.ts | hidden and batched replacement chains retain the selected group and older pages | 4 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | a task card shows progress, verdict reason, relations, suite and the folded agents text in order | 5 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | epic cards show stage progress, approval, subtree verdict and latest activity including a closed plan | 5 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | a closed stage uses the latest child closing time or stage verdict, and missing legacy times stay unknown | 0 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | empty and stale card evidence stays explicit, and live suite states come from task summaries | 3 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | zb alone unfolds agents text; hub redraw folds it and Enter on a relation reveals its item | 6 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | the narrow explorer card replaces the right panel and restores it for General and a wider screen | 4 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | card follows rows with written or fallback summaries and task/container facts | 12 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | rapid j movement fetches only the rested row, reuses cached details and refreshes on updated | 4 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | loading summary retains facts and deferred detail answers update the card | 1 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | gi reveals the thread reference without changing folds, keeps containing scope and gI/palette open v0.1 | 6 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | card widths use the centre formula, manual resize persists separately, and other views close it | 12 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | gi reveals category, direct and archived items beyond the current scope without persisting filters or folds | 7 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | gi keeps a virtual scope containing a done target even while D hides that target | 2 |
| nvim/test/explorer-card.test.ts | nvim/test/explorer-card-component.test.ts | same-timestamp status, claim, verdict and verification signals refresh only the shown card; duplicates do not fetch | 2 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | m sends the human text, scope and display id to General through topic.send | 8 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | card m includes its cursor line; M creates a bound topic then reuses it | 7 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | closed and virtual rows refuse M, while Esc and refused sends keep the draft | 2 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | V selections go to General for both keys, skip stage labels and retain selection drafts | 3 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | a 300-row selection keeps whole item lines and cuts remaining ids within 8192 UTF-8 bytes | 7 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | Shift-Enter sends multiple lines, q keeps a normal-mode draft, and disconnection keeps unsent text | 1 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | selection context uses derived container status and plain parent titles, skipping virtual roots | 2 |
| nvim/test/explorer-compose.test.ts | nvim/test/explorer-compose-component.test.ts | new topic titles stop at the hub cap without splitting emoji | 2 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | categories name their counts, open on the top three by rank, and D counts hidden done items | 6 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | idle work comes from the crew snapshot and changes live with its configured order | 3 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | Unscheduled puts maps first; Other releases uses versions and A reveals closed roots newest first | 5 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | each virtual card describes its holdings, and Enter reveals category, more and direct references | 1 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | root cards cap holdings at twelve with the remaining count | 2 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | root cards give done references a green glyph and done colour, and Enter reveals them | 1 |
| nvim/test/explorer-roots.test.ts | nvim/test/explorer-roots-component.test.ts | m and M promote category work by message with the category container in the context | 5 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | outline keys skip detail and stage labels, respect counts and fold the leaf parent | 2 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | scopes carry breadcrumbs and back restores the originating row and preceding centre view | 1 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | D hides done items across the tree and A exposes archived roots with scope-only counts | 1 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | invalid explorer preferences reset alone and are reported while other ui.json keys survive | 6 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | the explorer registry, key help and status hint advertise every outline action | 8 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | release rows, derived glyphs, rank then close order, folded roots and za cursor identity | 13 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | a release with no epics derives from direct tasks and the virtual roots unfold to plain rows | 2 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | an epic-only ladder shows no open release and lists its root epic as unscheduled | 1 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | loading is distinct from an answered empty list | 0 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | configured root kinds keep release rows, epics and direct tasks in the outline | 2 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | the root winbar counts done nodes only under its named release | 0 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | live removal restores the next key, then the previous key, and keeps the card on the cursor | 0 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | status and stage changes move a row while its cursor and cached card keep the item | 3 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | a folded burst rebuilds once without writes; visible counts write once; hidden trees do no work | 5 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | bench reports build and buffer medians for 300 items fully unfolded and restores the human view | 8 |
| nvim/test/explorer.test.ts | nvim/test/explorer-component.test.ts | cold startup shows loading then selects the release without entering the composer | 2 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | inbox archive shows departures in both views while events stay outside the inbox | 1 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | ${view} inbox keeps verdicts, role changes and warnings in the events view | 5 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | sessions show now and watch while background folds behind more (N) | 4 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | session folds use hub layers even for live background and explicitly requested archive | 4 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | thread hides seven-day archive until A and keeps recent replies outside archived asks | 2 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | A retrieves old messages beyond the latest 200 and hides them again | 1 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | items honor hub layers in the board and explicit layer filters, including live changes | 5 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | default board and plan show done items promoted by config and a topic pin | 6 |
| nvim/test/layers.test.ts | nvim/test/layers-component.test.ts | plan items use layer filters and fold background independently of workflow status | 6 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | the palette finds the sessions panel action, displays its key and runs it | 2 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | session events move the selected row between groups and update the chip; stopped sessions fold | 6 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | wide session rows and approval commands fit their cells and the chip stays visible on a narrow screen | 3 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | session notices and stop confirmations terminate within budgets of zero, one and two cells | 2 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | item prefix opens an item; C-v opens another beside the centre | 2 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | every cland mapping has matching registry metadata; missing keys and drift fail the audit | 7 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | an ask option runs through the inbox hub path and vanishes after the hub accepts the answer | 3 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | archived hits are dimmed, matches are blue and wide rows fit the shared display-cell budget | 4 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | later modules register stable action ids and keys; unkeyed preset commands say no key | 1 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | a local palette action uses its panel row while a split action uses the focused topic | 1 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | topic actions in an Agents reply use Agents rather than its synthetic composer id | 2 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | the newline action resumes Insert mode in the composer before executing its native key | 3 |
| nvim/test/palette.test.ts | nvim/test/palette-component.test.ts | a failed live palette render closes it and reports one status-line notice | 1 |
| nvim/test/plan.test.ts | nvim/test/plan-component.test.ts | the plan shows Lead metadata and lane claim/verdict marks, including role labels and long source fences | 3 |
| nvim/test/plan.test.ts | nvim/test/plan-component.test.ts | mid-way plan preserves stage QA marks, outlines active lanes and dims planned stages | 3 |
| nvim/test/plan.test.ts | nvim/test/plan-component.test.ts | equal-time plan history keeps later moves after the saved receipt | 1 |
| nvim/test/plan.test.ts | nvim/test/plan-component.test.ts | future per-item QA excludes only evidence accepted by the hub gate | 2 |
| nvim/test/rulebook.test.ts | nvim/test/rulebook-component.test.ts | a push during the initial snapshot stays current, and Enter on a rule event selects that rule | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the chip and inbox header show only the hub count through event floods, messages and resolutions | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the count stays unknown until the hub says, follows hub.status, and stays unchanged by local answers | 8 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | unread history and live messages never change the chip on startup, refresh or reconnect | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the workbench opens on General: top bar with project, view, Coordinator chip, needs you and sessions; sessions panel on the right | 10 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | with no coordinator the chip warns | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the hub's role.vacant turns the chip into the no-coordinator warning at once, and role.filled brings it back | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a hub that comes back with coordinator null after a disconnect drops the chip (no ghost Coordinator from a missed role.vacant) | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | each panel toggles with its key; the active right-panel key hides it; the status line names the centre view throughout | 9 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | presets are examples: watch opens items, topics docked over the inbox; steady the board and the inbox | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a session.state event updates the chip while the human types in the composer, and Insert mode survives | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a burst of hub events never raises a hit-enter prompt | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the launcher: ␣l opens the form, a role fills its launch defaults, typed values win, Enter submits session.launch; the session shows in the panel | 11 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the launcher cycles model ids from the hub for its selected harness and role account | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the launcher's item line sends `item` instead of the directory: the hub starts the Implementer in the item's worktree | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the launcher shows what the hub refuses in the form and the panel, never a hit-enter prompt; a roleless launch asks first | 6 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | x asks on a line in the panel; n keeps the session, y sends session.stop and the row turns unknown · stopped | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a session.state unknown event shows unknown; a process that died shows unknown · died | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the topics panel groups needs you and open, reveals closed with A, pins what waits for the human, shows unread badges and the warning glyph; Enter opens and reads | 12 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a message event raises the unread badge of a topic out of view, and opening it reads it | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a topic is created from the panel (n) and with :Cland topic new, closed with :Cland topic close and c in the panel, resolved with ␣r | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the thread header shows the status, the binding and the warning; a topic event changes it; gI opens the bound item | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the picker's topics kind lists needs you first, with the binding, the warning and the unread count, and filters by title | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | T-80: in work follows explicit status events, including unclaimed review and QA | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the client agrees with the shared rank fixture and applies the final siblings event | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | configured levels choose the lowest semver release; all folds closed trees and work stays in scope | 7 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the board reads all seven statuses, scopes open parents, and filters its header by parent | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the items panel: vertical sections, hub glyphs, right-aligned claims and counted asks; filters 1–6 and f; map grouping | 13 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | sessions show running token and cost totals; the claiming session total supplies the item cost | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | an item body with a list indented past the window width renders, and Neovim keeps answering | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the item view after a reconnect: a task.view lost with the hub is fetched again, and a body changed meanwhile shows | 0 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the item view: the title line, the fields column beside the body, the verdicts latest first, the comments | 25 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the board: explicit task statuses and badges; ↵ opens a card | 8 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a delayed items snapshot keeps a newer claim, new item and removed file | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | events already reflected in a delayed items snapshot are idempotent; a failed snapshot keeps live items | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | failed-launch cleanup removes its identity live and during delayed session snapshots without removing a new name owner | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | disconnect releases snapshot journals even when another refresh is queued | 2 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | topic replay after reconnect preserves fresh metadata and counts only messages after the snapshot watermark | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | an unanswered items snapshot records only relevant frames and restarts at its deadline | 2 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | an items snapshot restarts when its recording reaches the event cap | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a single oversized relevant frame restarts a snapshot without retaining its bytes | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | messages sharing the snapshot watermark use a fresh unread count | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | overlapping delayed panel snapshots keep topic, session, artifact and inbox events | 12 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the vertical board follows task events: a claim, a new backlog row, a removed file | 1 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the picker's items kind searches ids, titles and claims; Enter opens the item view | 2 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the Agents log (␣L, :Cland view log) lists messages with sender [Role] → addressee and notices with kind glyphs, and follows message events | 8 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | r on a message in the Agents log prepares a reply to its sender; the hub gets topic.send with replyTo; r on a notice says it has no sender | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the inbox puts asks and approvals first, messages next and events outside the inbox; the chip is hub-owned | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | 2 on an ask row answers with option 2: topic.answer goes out, the row leaves and the count drops; d on an ask does nothing | 8 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | i on an ask opens its topic with the composer armed: Enter sends the text as the free answer | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the inbox has no notification rows or dismissal keys | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the ask card in the thread: the question, numbered options and the free-answer hint; 2 on it answers, and the answer shows beneath | 6 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a question and options over several lines render as lines in the card and the inbox; a digit on any line of an option answers it | 6 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a delayed topic history keeps an ask card answered by a newer event | 2 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | the inbox full width (␣N) shows the same sections and acts the same | 4 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | visibility overrides drive thread folds, palette dimming and session counts; the needs-you chip remains hub-owned | 5 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | a current-release change updates other item placements and palette dimming without a snapshot reload | 3 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | live ${role} ${status} keeps palette and session count consistent after its state event | 2 |
| nvim/test/shell.test.ts | nvim/test/shell-component.test.ts | verifier rows show the latest hold plus others and dim pending work until its hold frame | 6 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | live chip grouping rewrites only its ask, and unrelated senders, intervening messages and days keep headers | 2 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | asks have an amber band, kinds stay visible and a clear verdict is one dimmed row while failures keep notes | 7 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | message Markdown conceals headings, code and links and highlights visible item ids | 4 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | reference links and narrow table header links keep destinations and Markdown styling | 3 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | header-only tables retain content and table fitting uses concealed cell widths | 3 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | duplicate references and autolinks retain their destination and label ranges | 2 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | generated ragged tables preserve every header and cell text and target in projection order | 4 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | unclosed fences are isolated, rejected bodies stay plain, and append parses only fresh text | 3 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | verdict results are red/green and the registry gI opens a concealed item reference | 5 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | resize bursts project once at final width and stale closed/reused windows do nothing | 3 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | Aide headers speak for you with blue dashed gutters and never-fold boundaries | 6 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | General shows addressees, local day rules, role gutters and the human band | 4 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | headers and day rules use the local day and daylight-saving offset | 6 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | thread options follow the buffer and an arbitrary scratch split restores global defaults | 5 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | background fold reconstruction leaves the focused board alone and rejects non-thread windows | 7 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | delayed initial history preserves focused composer modes and an unfocused composer | 4 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | appends touch only new lines, delivery changes no text, and retention removes only the oldest block | 5 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | 200 message rewrites and steady-state appends retain cached parsing and incremental cost | 5 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | a retained answer becomes standalone when its older ask leaves the 200-message window | 8 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | generated live appends, ask evictions and delivery changes equal a full render | 4 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | one message layer rule covers the Messages table and every never-fold boundary | 1 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | fold membership survives extension, split, eviction, union and rewrites per window | 5 |
| nvim/test/thread.test.ts | nvim/test/thread.test.ts | an agent ask waits on its named lead, survives inbox reconciliation and offers no human answer keys | 4 |

## Native title accounting

The following original declarations stay in their original file; no retained case is counted as a T3 saving.

### nvim/test/agents-filters.test.ts

- f completes items and sessions, filters history and live notices; F clears; L opens from an item or session row
- a session named loop excludes another pair’s loop metadata in live entries, frames and spoke history

### nvim/test/artifact-browser.test.ts

- Artifacts browser creates v0.2 notes, saves two folder files in place and attaches the folder with s
- browser folds background and archive, keeps live selection, moves a file into a folder and promotes that folder
- s preserves composer text, deduplicates attachments and restores them after a refused send
- hub artifact layer overrides make reports in other topics visible without unfolding a role
- zR unfolds the background subgroup of a role that also contains a kept artifact
- pending message attachments survive both a refused and an accepted ask answer
- s rejects foreign-topic and archived selections, and stale attachments can be cleared before retrying
- artifact pin and mute keys share hub layers with the thread, palette and browser
- x asks before deleting; cancel keeps bytes and confirm updates the browser and topic chips
- deletion updates an already-open attachment-only chip when creation is outside retained history

### nvim/test/artifacts.test.ts

- keeping an agent artifact updates the thread and palette across unkeep and hub restart
- Coordinator artifacts in Agents open from the log and its topic list
- artifact chip opens editable Mermaid source and the browser renderer, topic list and picker open artifacts
- prompt drafts are editable full buffers, survive hub events, reopen, and send saved text
- p in a topic artifact list promotes it and updates the list and picker marks
- topic lists follow archive events and lists and pickers mark retained entries whose files were deleted
- folder chips open their entry and old moved-file chips open inside the folder
- moving an already-open prompt rebinds its editable buffer before the next save
- a draft moved while disconnected resolves and rebinds on reconnect before saving

### nvim/test/client.test.ts

- the client spawns `cland hub serve --stdio` as its child when asked, and speaks the same frames
- with no hub running, the client starts the project hub and connects to it
- a stale hub.json (its hub killed, its socket gone) makes the client start a hub after a few failed connects
- the client follows its hub through a restart and keeps the thread

### nvim/test/crew.test.ts

- sessions header follows crew CLI and hand edits, retaining the last good summary on refusal and refresh

### nvim/test/criteria.test.ts

- human criterion keys preserve marks and removed ids; panel, cards and graph refresh from 3/4 to green 4/4
- the shown explorer card refreshes criteria after a watched save that preserves updated

### nvim/test/explorer-card.test.ts

- the explorer card reads parsed body from a real hub and Enter/h preserve the tree cursor

### nvim/test/explorer-compose.test.ts

- a real Coordinator receives explorer text from the human; M binds the real tracker topic

### nvim/test/explorer-roots.test.ts

- real hub summaries put a category and its ranked work under Categories

### nvim/test/explorer.test.ts

- explorer preferences debounce to ui.json and reopen after a cold workbench start
- the harness default opens General while a preset and a restart snapshot keep their centre

### nvim/test/graph-layout.test.ts

- graph layout: ${name}

### nvim/test/inbox-requests.test.ts

- the chip equals cland inbox before and after an Aide review request is replied to

### nvim/test/item-prefixes.test.ts

- gI on a legacy reference opens the canonical epic and only kind prefixes are item tokens
- old ids in topics, inbox and journal open migrated items through a restarted real hub and gI

### nvim/test/items.test.ts

- the all tree keeps closed container and task titles in the done colour
- the epic row, item fields and sessions panel show its launched Lead
- configured containers with no children show container counts in the panel and stay outside board cards
- against a real hub: the tree, the map grouping, the item view and the board from hand-written item files; a hand edit shows within a second; e edits the file and a save re-indexes
- the item view shows verdict commits, red stale marks, and file-only provenance

### nvim/test/layers.test.ts

- real bound-topic verdict and death events show warning markers without changing the chip
- a layout flush defers while another writer owns ui.json and preserves its pin
- stale UI recovery preserves a competing replacement and treats EPERM as alive
- the human mutes a topic and pins a Reviewer through keys, then a cold UI restores both

### nvim/test/needs-you.test.ts

- needs-you chip and both inbox views agree: ${scenario.name}

### nvim/test/nvim-path.test.ts

- nvim-path.ts prints the binary from a path with a space, # and %
- two resolvers starting on an empty cache at once: one downloads, the other waits for it, both print the same binary
- an empty download lock (its writer died before the pid) is stale after a grace: the resolver takes it over
- two resolvers that both find a dead holder's lock: one breaks it, neither removes the lock the other then holds
- a linked worktree with no Neovim of its own uses the one cached in the main worktree, and downloads nothing

### nvim/test/palette.test.ts

- Aide launches send role defaults, the project root and optional briefs, avoiding names in processes and presence
- all five kinds stay in fixed order while the cursor selects the best match; prefixes and Tab narrow them
- session, topic and text-artifact selections open in splits and receive live updates
- the terminal Shift+Enter action resumes its attached terminal and reaches the harness
- a palette option reaches the real hub and the Coordinator receives the human answer

### nvim/test/plan.test.ts

- plan changes refresh both view and stage tags; d composes to the epic Lead and e opens ## Plan
- a planned child leaving the epic invalidates its former plan on reparent and removal
- a moved item keeps watch marks and its reason until the next plan visit, with a saved last-look receipt
- done status without a merge receipt cannot close a stage in the view
- :restart of a plan with unseen changes records its restored visit

### nvim/test/qa.test.ts

- SHELL-001 passes against its own stdio hub: exit 0 and one JSON line with the result, the duration, the build and the evidence inline
- a failed expectation exits 1 with FAIL, its message, and the grid and the state dumped in --out
- a wait_for that times out exits 2 with INCONCLUSIVE and the last screen
- a Lua error in the case exits 2 with BLOCKED, the error with its line, and the last screen
- a case that is not there, or does not load, is BLOCKED with exit 2; a bad command line is a usage error
- qa.state() holds the stub scenario: the sessions with their states, the roles, and the topics, asks and items the screen shows
- ITEMS-001 passes against its own stdio hub, and against the stub hub with --hub stub
- the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the fixture role's defaults
- every run is given the fixed grid, the pinned TERM, LANG and TZ, paths of its own and no server socket, whatever the caller has
- fixture values YAML would read as structure reach the client whole, the same under the stdio hub and the stub hub
- a fixture that would write outside the run directory (its project name, an item id) is BLOCKED before any write
- keys longer than Neovim\'s input buffer are all typed, the last ones too
- a long sequence is cut only right after <Esc> or <CR>: rev-6\'s x×4084 then <Esc><Space>i, and the cut at every distance from the limit
- a Normal-mode command after a long stretch arrives whole when there is an <Esc> to cut at; with none in over 4 KiB the keys are refused, never left hanging
- `cland --qa-fixture` writes a new fixture project only: an existing one is refused and left as it was
- a case that never returns is ended by --timeout: BLOCKED, exit 2, and no Neovim left spinning
- a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED
- :Cland qa dump <path> writes the grid and the state in an ordinary run
- with the network denied (no socket to bind or reach), both cases pass
- with file writes also denied outside the temp dir, both cases pass and dump their evidence there
- with every file write denied, as in a read-only rescue run, a stub-hub case without --out passes; one that needs the stdio hub is BLOCKED and says why
- a run reads no user configuration, leaves the live project it was started in alone, and leaves no process and no fixture behind
- stub QA accepts user-authored frames absent from the T2 recording catalog

### nvim/test/rulebook.test.ts

- Rulebook keys and palette show sorted rule rows, unfold origins and list help
- workbench drafts add and edit rules, retain refused text, retire, and follow shell changes live
- thread origins show topic and message time, and gt reaches an older human message

### nvim/test/scenarios/workbench.test.ts

- a message typed in the composer shows queued, reaches a coordinator with the topic, and turns delivered; the reply shows with sender and time
- a digit in the thread answers through the real hub with answer_to; the ask and next chip share a header
- Space e and the explorer command open a release tree on real hub summaries
- graph nodes show stages from a plan accepted by the real hub
- gp shows stages, lanes, overrides, gates and scoped stage tags; a approves through the real hub
- recorded protocol fixtures match the live hub attach frames

### nvim/test/sessions.test.ts

- the sessions item column shows verifier holds and returns to free on release
- Claude Code, Codex and OpenCode sessions launched from the UI show in the panel with live state, attach on Enter, and a killed one turns unknown with the death in the hub log
- accounts open above verification, show a fake Codex weekly window and follow pushes without re-reading
- source windows keep severity, local resets and stale age, wrap at 30 columns and leave default sessions unnamed
- hard limits show red account names and reset or until-cleared text; clearing removes the mark by push

### nvim/test/shell.test.ts

- Enter on a session attaches it in the centre in Terminal mode; ␣␣ returns to the thread
- the palette: prefixes narrow topics, Tab from items reaches sessions and Enter opens
- gI, gt and gs on a reference under the cursor in the thread
- the workbench reads sessions and presence once per connect; events update the panel without polling (T-71)
- each focus chord moves to its neighboring window from Normal, Insert and Terminal mode
- focus also leaves Visual, Select, operator-pending and command-line modes
- the launcher no longer shadows Ctrl+H as Backspace
- a lone Ctrl+Backslash leaves Terminal mode, the old two-key habit works, and Esc reaches the harness
- Russian Normal-mode letters follow langmap while the composer keeps Cyrillic text
- Shift+Enter reaches the session terminal as ESC[13;2u; a paste keeps its tabs
- a send the hub refuses comes back to the composer; a held send that fails goes back ahead of what was typed since
- :restart re-attaches the session terminals instead of ending the sessions
- :restart restores a C-v split attachment as a split beside the centre, not a hidden terminal
- session row selection ignores a ${distraction}
- an attach client that ended is not reused: Enter and C-v run the attach command again
- the sessions panel: c shows the capability table, C-v attaches in a vertical split, l opens the launcher
- the picker's sessions kind: waiting ones first, filters by name, role and harness, Enter attaches
- gI, gt and gs between items, topics and sessions, both ways; a topic event binding an item is followed
- Enter on an approval attaches the session in the centre
- an ask closed while the client was away, now older than the history the reconnect reads: its card closes, a digit on it does nothing
- an ask answered while the client was away shows answered after the reconnect, and a digit on it does nothing

### nvim/test/ui.test.ts

- legacy all migrates to board; explicit all cycles and persists separately across a cold start
- PANELS-005: manual sizes survive views, presets, hidden panels and a cold restart with filters and scope
- automatic closes preserve every stored size, including a sole board centre; later human resizes persist
- a human resize survives an immediate view or preset operation before WinResized
- a native panel close flushes the human resize immediately before it
- same-batch close then resize before repair follows the documented typeahead limitation
- absent ui.json silently defaults; unreadable or corrupt files notify without hiding inbox answers
- a long centre context cannot displace the inbox answer hint or preference notice at 160 or 80 columns
- writes debounce; a process interrupted before rename preserves the previous complete file

## Validation

See [T-774-validation.md](T-774-validation.md) for the serial whole-file receipts, producer/replay comparison and catalog startup measurements. The final bundle retains the mechanical assertion audit, all raw logs and red controls. Lint debt remains 524; no allowance or quarantine grows. The committed-catalog fallback handles known scheduling variants without loading hub producers in T2; truly unknown frames still fail. Source review and same-head droplet verification remain separate gates.
