---
id: T-116
kind: epic
title: "Epic: The task graph"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: null
blocked_by:
  - T-107
topic: null
branch: null
created: 2026-10-09T21:51:34.781Z
updated: 2026-10-09T21:51:48.320Z
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

The human presses `␣G` and sees the first v0.1 epic as a graph: what can run now on the left, blocked items marked ◌, the claim and the verdict on the nodes in work. They move with `h`, `l`, `j` and `k`, open an item with Enter and come back to the same node with `␣␣`, press `s` to see the plan's stages as columns, and watch a node change in place when a claim lands, with the cursor where they left it.

- [ ] The graph lays out any container's children by `blocked_by` with layers, reduction and tracks, never draws `┼`, and names cycles and the edges left out.
- [ ] Nodes show status, the blocked mark, the title, the ask badge, the claim, the latest verdict and verified/total; done items are dimmed and folded in the tray.
- [ ] The cursor moves node to node with the motions; Enter, `gi`, `gt` and `gs` act on the node; the window scrolls sideways.
- [ ] A hub update redraws only on a visible change and keeps the cursor on its node.
- [ ] With a plan, nodes carry their stage and `s` groups the columns by stage; `gp` on a stage opens the plan view.
- [ ] The graph of T-19 (22 items, 36 edges) is legible at 120, 160 and 200 columns.
- [ ] A headless QA case, the successor of `GRAPH-001`, passes on `dev`.
- [ ] `nvim/README.md` describes the graph and its keys.

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
