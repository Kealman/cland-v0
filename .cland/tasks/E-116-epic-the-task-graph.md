---
id: E-116
kind: epic
title: "The task graph"
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: R-130
blocked_by:
  - E-107
topic: topic-106
branch: null
created: 2026-10-09T21:51:34.781Z
updated: 2026-10-10T21:36:43.937Z
---

## Goal

The human sees an epic's items as a graph laid out by their blocking edges: what follows what, what can run in parallel, with status, claims and verdicts on each node and the plan's stages as a second grouping. A cursor moves node to node with the usual motions, and the graph keeps its place while the work moves under it. Today the items panel and the board show lists and columns, and neither shows order or parallelism.

## Contents

- **The task graph** (map ticket T-98): a centre view, `␣G` or `:Cland graph [T-n]`, that lays out an open container's children left to right by `blocked_by`, carries status, the blocked mark, claims, verdicts and verified/total on each node, moves a cursor node to node with the motions, keeps its place under live updates, and groups the columns by the plan's stages.

The spec has no graph section yet: T-98's resolution adds it from the human's reaction to the prototype, including whether the graph replaces the board on `␣b` or joins it (the prototype keeps it beside the board, on `␣G`). Until then the prototype on `prototype/graph` (commits `e34618f`, `476a0fd` and `847d4ff`) is the reference, and the resolution's words win where they differ. The prototype's rules to keep unless the resolution changes them: cycles are left out and named; edges implied by a longer path are hidden, and `r` draws them; a column is a layer, one past the furthest blocker; long edges pass through dummy vertices; layers are ordered by barycentre sweeps and swaps; each edge owns a track between two columns, and a crossing is `│` over a broken `─`, never `┼`; children with no edge to a sibling wait in a tray, the done ones folded (`d`); the parent is an open container of the current release, cycled with `p` and `P`; `h`, `l`, `j`, `k`, `^` and `$` move the cursor, Enter, `gi`, `gt` and `gs` act on its node, and the winbar spells the node out; with a plan, nodes carry their stage and `s` groups the columns by stage, naming the edges that go back against the plan.

Not in this epic: plan parsing and the plan view ("The epic plan"; the stage slice's ticket is blocked by its plan ticket); status, rank and the current release ("v0.1 release and status").

Decided on 2026-10-09 (T-98): the graph is an experimental extra view on `␣G` and `:Cland graph`; the board stays as it is on `␣b`; the vertical layout is the default and `o` turns it sideways; the crossing-edge legibility at a real epic's density is fog for the next version (spec §3.15).

## Tracer-bullet order

1. **The layout.** A pure Lua layout module, rebuilt from the prototype's `graph_layout.lua` with unit tests: cycles, reduction, layers, dummy vertices, ordering, tracks, and a text canvas whose cells are display columns. Demo: T-19's 22 items and 36 edges laid out headless, with the crossing count in the footer.
2. **The graph view.** `␣G` and `:Cland graph`, the current release's containers as parents with `p` and `P`, nodes on the hub's status, claims, verdicts and criteria, the tray with done items folded. Demo: `␣G` shows the first v0.1 epic as a graph.
3. **The cursor and live updates.** The node cursor with its edges highlighted, the winbar, the motions, Enter, `gi`, `gt` and `gs`, sideways scrolling, and a redraw only on a visible change with the cursor kept on its node. Demo: a claim lands and its node changes in place under the cursor.
4. **Stages.** Stage tags on nodes, `s` grouping by stage, the edges between stages and against the plan, `gp` on a stage. Demo: an epic with a plan regroups by stage when the human presses `s`.
5. **Legible at size, and the board decision.** Node widths, 120 to 200 columns, the `GRAPH-001` case rebuilt on the hub's fields, and T-98's decision on `␣b` applied: the board stays beside the graph, or the graph takes its key. Demo: T-19 at 120 columns scrolls sideways and stays legible.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human presses `␣G` and sees the first v0.1 epic as a graph: what can run now on the left, blocked items marked ◌, the claim and the verdict on the nodes in work. They move with `h`, `l`, `j` and `k`, open an item with Enter and come back to the same node with `␣␣`, press `s` to see the plan's stages as columns, and watch a node change in place when a claim lands, with the cursor where they left it.

- [ ] C1. The graph lays out any container's children by `blocked_by` with layers, reduction and tracks, never draws `┼`, and names cycles and the edges left out.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C2. Nodes show status, the blocked mark, the title, the ask badge, the claim, the latest verdict and verified/total; done items are dimmed and folded in the tray.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C3. The cursor moves node to node with the motions; Enter, `gi`, `gt` and `gs` act on the node; the window scrolls sideways.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C4. A hub update redraws only on a visible change and keeps the cursor on its node.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C5. With a plan, nodes carry their stage and `s` groups the columns by stage; `gp` on a stage opens the plan view.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C6. The graph of T-19 (22 items, 36 edges) is legible at 120, 160 and 200 columns.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C7. A headless QA case, the successor of `GRAPH-001`, passes on `dev`.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z
- [ ] C8. `nvim/README.md` describes the graph and its keys.
  - verified: qa-16 [qa] · run qa-2026-10-10-16 · 2026-10-10T21:36:27.476Z

## Dogfooding

From this epic on, the human follows the remaining v0.1 epics, and their plans' stages, in the graph, and the Coordinator points the human to it when it explains the order of the remaining work.

## Constraints

- **ADRs.** 0005 (Neovim is the host): a buffer, extmarks and a text canvas, with no plugins. 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): the graph reads the hub's index, never the item files.
- **Research.** `research/nvim-rendering` (`docs/research/nvim-rendering.md`, T-86, with the probes `g1` to `g6` and `t19.lua`): Sugiyama layering fits a buffer at T-19's size, and legibility, not speed, is the limit.
- **References.** `prototype/graph` (`nvim/lua/cland/graph.lua`, `graph_layout.lua`; `qa/cases/GRAPH-001.lua` with `GRAPH-001.items.json`), never merged; it derives status from claims and verdicts, which the build replaces with the hub's fields. No mockup exists for the graph. The order of authority: the spec's graph section once T-98 resolves, then the prototype's behaviour.
- **Risks** from the sizing: legible edges at T-19's size; nodes that stay put under live updates.
- **The v0 tail.** No open tail item touches this code.
- **Order.** Fourth in the Neovim lane, after "The human's own session", because the Neovim epics all edit the layout and `init`; it waits for "v0.1 release and status". "Visibility and artifacts" follows it in the lane.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. The layout is a pure module with unit tests of its own.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.1 (Tree and scope: the graph shows the current release), §3.2 (status glyphs), §3.10 (stages), §3.13 (opening the plan view from a stage); the graph section T-98's resolution adds.
- Map T-81: ticket T-98 (task graph), research T-86.
- GLOSSARY: Item, Status, Plan, Stage, Lane, Release.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`.
- Branches: `prototype/graph`, `research/nvim-rendering`.
- Mockups: none; the prototype is the reference.

## Comments

### qa-16 · 2026-10-10T21:36:27.476Z

verdict: qa
result: clear
by: qa-16 [qa]
run: qa-2026-10-10-16
commit: d822f6e489b0af2c94912926dff4ad9faeb8c259

| Case | Surface | Result | Evidence / observation |
| --- | --- | --- | --- |
| SHELL-001 | headless-grid | PASS | SHELL-001 screen/state; connected shell and queued message |
| GRAPH-001 | headless-grid | PASS | t19-120/160/200 screen/state/canvas, full-width variants, sideways, native-statuses |
| M0 | hub-api + headless-grid | PASS | M0-setup.json, M0-open.screen.txt; T-130 is release, T-159–T-163 closed; scratch Graph T-2, chip R, blocked marks |
| M1 | headless-grid | PASS | M1-horizontal/reveal.canvas.txt; A → B/C → D → F, hidden edge toggles, cycle edge named, no ┼ |
| M1b | headless-grid | PASS | M1b-layout.log and M1b-view.log; 13 layout tests plus 1 cycle/reduction/outside-blocker test |
| M2 | headless-grid | PASS | M2-unverified/done.canvas.txt, M2-dim.json, native-statuses.canvas.txt; claim, status, review, 0/2 live; 1/3 and ask badge in shipped case |
| M3 | headless-grid | PASS | M3-item/gs/scroll.screen.txt and highlights; motions, Enter/gi, return, no-topic notice, claimant target, sideways leftcol 32 |
| M4 | headless-grid | PASS | M4-T6-*.canvas.txt/json and checks.json; comment leaves bytes/tick unchanged; claim, review and child updates retain T-6 |
| M5 | headless-grid | PASS | M5-E2/release/return; p/P cycles E1/E2/release, wraps, remembers T-6; empty E2 renders |
| M6 | headless-grid | PASS | M6-tags/stages/sideways/dependency.canvas.txt; S1–S3, backward T-9 → T-4, within-stage edges, Unplanned band |
| M7 | headless-grid | PASS | M7-plan/command/return.screen.txt, panel-restore.json, E2 canvases; gp and explicit command open plan; filter/scope restored; s is a no-op without a plan |
| M8 | headless-grid | PASS | M8-run.json and graph-001/*.canvas.txt; second explicit case invocation exits 0; all six size/panel canvases have 22 distinct linked labels, no overlaps or ┼; truncation uses … |
| M9 | hub-api / source read | PASS | M9-header.txt, fixture read; since T-163, regression yes, 44 native-field children, recorded case PASS |
| M10 | source read | PASS | M10-readme.txt; graph behavior and all exercised keys documented |

Findings, ranked by severity:

- High: none.
- Medium: brief defects, resolved for this pass by Coordinator message d8eb68f1-ab3d-4303-8376-14cfb74c9cb7 at 21:34:07Z. M0's release chip is correctly the name R, not the version. M6's X/Y are linked, so belong in an Unplanned band; G is linked by the preceding steps. M2's scratch `task criterion T-4 verify C1 --run scratch-qa --as qa-x --role qa` is correctly refused because this remains a human actor. Per the Coordinator, C2 is established by the live 0/2 render plus GRAPH-001's verified 1/3 and ask coverage. The Coordinator is filing these brief errors; no product repair was made.
- Low: none in the agreed scope.

Result: clear. Run: qa-2026-10-10-16. Build: dev d822f6e489b0af2c94912926dff4ad9faeb8c259, unchanged at completion. Only .cland metadata was dirty; no tracked source outside it changed.

Criteria verified in this run: C1 (M1/M1b), C2 (M2/GRAPH-001), C3 (M3/M5/GRAPH-001), C4 (M4), C5 (M6/M7), C6 (M8/GRAPH-001, machine-checkable scope), C7 (M9/GRAPH-001), C8 (M10). All eight Definition-of-done checkboxes were exposed in order with null ids before this verdict; the Coordinator explicitly instructed first-touch C1–C8 assignment through the verdict.

Execution: the prescribed CLI scratch tree and one persistent headless Neovim, keys through nvim_input and screens through screenstring(); only read-only tracker inspection occurred in the real project apart from the QA hold, records and verdict. The scratch hub and Neovim were stopped. Fourteen unique PASS records were appended through qa-record.sh; no full suite was requested or run. An extra Z2 child was added to confirm relayout with T-6 explicitly focused.

Deferred to the T-117 walkthrough (BLOCKED outside this run's acceptance scope): human judgment of dense graph readability, real-terminal appearance and real-model/session attachment. The simulated impl-x target opens correctly; attachment says no such session was launched, as expected. Creating a live verification mark also needs a real verifier in a scratch hub; this is not a blocked acceptance case under the Coordinator's clarification.

Evidence bundle: A-809, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-809-t-116-qa-evidence-qa-2026-10-10-16.gz. Paths in the case table are relative to the archive's qa-2026-10-10-16 directory; it includes the 14 JSONL records, CLI log, control script, canvases, screens, state and checks.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
