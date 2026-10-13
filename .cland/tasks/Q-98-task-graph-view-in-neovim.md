---
id: Q-98
kind: question
title: Task graph view in Neovim
state: closed
labels:
  - wayfinder:prototype
assignee: null
parent: M-81
blocked_by:
  - Q-86
  - Q-88
topic: null
branch: null
created: 2026-10-09T19:09:50.060Z
updated: 2026-10-09T21:48:19.213Z
closed: 2026-10-09T21:48:19.217Z
---

## Question

Does a graph view of an epic's items, laid out by dependencies in lanes, serve the human better than the board, and what does it need to show?

## Context

The board proved less useful than the left items panel. The human wants to see the items of a release or epic as a graph: what follows what, what runs in parallel, scrollable up, down and sideways, to watch the process. The research "Neovim rendering techniques for the thread and a task graph" picks the layout technique; the status ticket defines the glyphs and columns the nodes carry.

## Prototype

Branch `prototype/graph` (never merged): a centre view that lays out an epic's items by `blocked_by` in lanes on real tracker data (the v0 epics are a good test: 22 tickets, 36 edges), with status glyphs, claim and verdict marks, a cursor on a node, `gi`, `gt`, `gs` and Enter, horizontal scrolling, and a parent filter. Try the epic plan's stages as a second grouping if the plan ticket has resolved by then.

Resolve with the human's reaction: whether the graph replaces the board as `␣b` or joins it, what a node shows, and the spec section, recorded as a comment with the branch link.

## Comments

### human · 2026-10-09T21:11:47.235Z

The prototype is ready for the human's reaction.

- **Branch** `prototype/graph`, pushed to `origin` only and never merged. Commits:
  - `e34618f`: the view.
  - `476a0fd`: its QA case.
  - `847d4ff`: the plan's stages as a second grouping.
- **It is the real plugin**, branched from `dev` at `29ef41d`, so it runs against the live hub.

## Try it on the live hub

From the main worktree, with the hub running:

```sh
git worktree add --detach /tmp/cland-graph prototype/graph && /tmp/cland-graph/nvim/bin/cland-nvim .
```

Then `␣G` (or `:Cland graph`, `:Cland graph T-81`). It is the usual workbench with the graph added; the board stays `␣b`. Remove it afterwards with `git worktree remove /tmp/cland-graph`.

## What the view shows

- **The layout.** One parent's children, laid out left to right by `blocked_by`.
  - A column is a layer: an item's layer is one past its furthest blocker (Sugiyama layering, ASAP). So a column holds the items that can run in parallel once everything left of it is done, each in its own row (lane).
  - The column numbers are on top.
- **The parent.** By default, the open epic with the lowest id (T-19).
  - `p` / `P` cycle the open epics, then the open maps; the tracker has no release kind yet.
  - `:Cland graph T-<n>` draws any item's children, for example T-20.
  - The top bar names the parent.
- **Edges.**
  - Edges implied by a longer path are hidden: T-19 draws 32 of its 36, T-81 25 of 35. `r` shows them all; T-81 then goes from 6 crossings to 84.
  - Long edges pass through dummy vertices. Each layer is ordered by barycentre sweeps and adjacent swaps.
  - Between two columns every edge has its own vertical track. A source's tracks stand side by side, and the sources are ordered for the fewest crossings.
  - A crossing is drawn as `│` over a broken `─`. Lines join only where a track ends (`┴` `┬`) or where they part from their source's line, so `┼` never appears.
  - Every position is a display column; byte columns are computed once, when a row becomes text. These are the research's two ambiguities.
- **A node** is one line, plus a second for an open item that has something to show. It is 30 columns wide; `+` and `-` change that.
  - Line one: the status glyph, the id, the stage in the parent's plan (`S2`), `◌` while an open blocker remains, and the title cut to fit.
  - Line two: the ask badge (`?1`), the claiming session, the latest verdict (`✓rev`, `✗qa`) or else the assignee, and verified/total of the acceptance criteria.
  - Done items are dimmed.
  - `◌` sits next to the status, never in its place. In its place, it hid the status of 9 of the 13 items of T-200, the synthetic epic in the QA case.
- **The tray.** Children with no blocking edge to a sibling are listed under the graph in id order, rather than stacked into the first column, as the research advised. The done ones are folded; `d` shows them. On the live tracker, T-19 has 27 such children: 6 open shown, 21 done folded.
- **The cursor** sits on a node.
  - The node is highlighted, and its edges in and out are drawn in blue, over any crossing.
  - The winbar spells out the node: its status in colour, blockers, claim, latest verdict, criteria and whole title. The status line keeps a short form.
- **The footer** counts what was laid out, the edges drawn, the layers and the crossings drawn. It names any blocker outside the parent and any edge left out to break a cycle, and ends with a legend.
- **The epic plan** (T-96, spec v0.1 §3.10). It resolved while I built this, so I tried it as the second grouping the ticket asks for.
  - When the parent's file has a `## Plan` section, each node shows its stage, and the ready rule takes the stage's QA policy.
  - `s` groups the columns by stage. Each stage's name and QA policy head its column. Its lanes stack in order, with a blank row between two lanes.
  - Blocking edges between stages are drawn. Those inside a stage are counted. Those going back against the plan are named in red.
  - Children in no stage wait in the tray.
  - No tracker epic has a plan yet, so this is shown on the synthetic T-200.

## Keys

| Key | Does |
| --- | --- |
| `␣G` | The graph in the centre; again: back. `:Cland graph [T-<n>]` and `:Cland view graph` do the same. |
| `h` `l` | The previous / next layer, at the nearest row. |
| `j` `k` | The next / previous node in the layer, down into the tray and back. |
| `^` `$` | The first / last layer. |
| `↵` | Opens the item; `␣␣` comes back to the same node. |
| `gi` `gt` `gs` | The node's item, topic and session. |
| `p` `P` | The next / previous parent. |
| `r` | Every edge / the reduced ones. |
| `s` | The plan's stages / the layers. |
| `d` | The tray's done items shown / folded. |
| `+` `-` | Wider / narrower nodes. |
| `zh` `zl` `zH` `zL` | Scroll sideways. |

- **Scrolling.** The window does not wrap. With `'sidescroll'` 1, `'sidescrolloff'` 8 and its own `'virtualedit'` set to all, it follows the cursor a column at a time and keeps the column on short rows.
- **Hub updates.** The graph is drawn again only when something it shows changed. A cursor that was on its node follows it through a new layout; a cursor the human moved elsewhere stays.

## The status rules

The tracker stores no status yet, so each item's T-88 status is derived on every render (`M.status` in `nvim/lua/cland/graph.lua`). The first rule that matches wins:

1. closed → done `●`
2. claimed by a Reviewer → review `◉`; claimed by QA → qa `◉`
3. the latest verdict of either kind is not clear → in progress `◐`. This is T-88's rule; `board.lua` puts a not-clear review in its review column instead.
4. the verdicts the merge gate needs are clear → ready `◕`. The gate needs a clear review, plus a clear QA when the item's stage in its epic's plan runs QA per item. With no plan, the gate in `hub/src/hub/merge.ts` reads the `qa-required` label instead.
5. the latest review is clear and QA is still to come → qa
6. claimed by any other session (an Implementer) → in progress
7. labelled `qa` → qa; labelled `review` → review
8. assigned → planned `◔`
9. otherwise → backlog `○`

Questions and specs have no status in T-88. The graph shows them as done when closed, in progress when claimed or assigned (the wayfinder's "in work"), and backlog otherwise. Blocked is not a status: `◌` marks an open item with an open blocker. As in the items panel, a blocker the tracker does not know counts as open.

## Measured

On the live hub, with a window 200 columns wide and nodes 30 wide:

| Parent | Laid out | Layers | Edges drawn | Dummies | Crossings drawn | Size |
| --- | --- | --- | --- | --- | --- | --- |
| T-19 (49 children) | 22, and 27 in the tray | 10 | 32 of 36 | 17 | 4 | 371 × 22 |
| T-81 (20 children) | 20 | 6 | 25 of 35 | 31 | 6 | 231 × 28 |
| T-20 (16 children) | 14, and 2 done folded | 4 | 15 of 20 | 6 | 1 | 151 × 21 |

Costs on the live hub at a load average of 2, medians of 20 renders:

| Parent | Layout | Draw | Buffer write | `redraw!` |
| --- | --- | --- | --- | --- |
| T-19 | 2.6 ms | 3.1 ms | 0.15 ms | 0.7 ms |
| T-81 | 2.7 ms | 2.9 ms | 0.13 ms | 0.8 ms |
| T-20 | 1.5 ms | 1.8 ms | 0.09 ms | 0.7 ms |

- Layout covers the labels, layers, order and rows; draw covers the tracks, lines, nodes, tray and text.
- At a load average of 13, while other sessions' test suites ran, the same renders cost about twice as much.
- A cursor move redraws only the focus highlight: at most 0.05 ms.
- A render is skipped when nothing the graph shows has changed, which it checks against a signature.

What fits on screen:

- At 200 columns without panels, about five layers of T-19 are visible.
- At 120 columns with the sessions panel the workbench opens with, the centre is 85 columns: two and a half layers.

Checks:

- No `┼` and no false merge (two unrelated edges sharing a segment) in T-19, T-20, T-81 or T-200, reduced or not.
- The same over 301 random graphs and 300 more with random stages: 392,872 cells, with cycles, self-loops and up to 28 tracks in a channel.
- `qa/cases/GRAPH-001.lua` passes on the stub hub, over a snapshot of T-19, T-20 and T-81 plus the synthetic epic T-200 with a plan. It covers every status rule, the stage grouping, the keys, Enter and `␣␣`, `gi`, `gt`, `gs`, `␣b` and two task events, and dumps screens at 160, 120 and 200 columns. Run it with `node hub/bin/cland.ts --headless --qa qa/cases/GRAPH-001.lua --out <dir>`.
- The shell tests still pass, 60 of 60.

## Stand-ins

- **The status** is derived from claims, verdicts, labels, the assignee and the plan, not read from T-88's field, which does not exist yet.
- **`◕` for ready.** The design's glyph set has none.
- **verified/total.** A `verified:` mark is counted where T-93's format exists. Until the hub writes marks, a ticked box stands in. On today's data that reads 0/3 almost everywhere, because the v0 items never ticked their boxes.
- **The parent cycle** goes through the open epics, then the open maps, standing in for the current release of T-87. T-19 is the only open epic today, so `p` goes from T-19 to T-81.
- **The plan.** A small parser reads the spec's example shape (stages with a name, a `qa: { scope, when }` line and lanes as flow lists of ids) until the hub parses plans with `task.plan`. Per-item QA overrides are not read. The only plan exists on the synthetic T-200.
- **The key `␣G`** is my choice; the palette is not covered.
- **The tray's folding of done items** follows the background layer of spec v0.1 §3.5.

## For the decision

- **What a node shows.** The status glyph, the id and the stage carry most of it. With five layers on a 200-column screen, the title gets about 20 columns: enough to recognise an item, not to read it, so the winbar carries the whole node. The second line matters only for the few items in work.
- **What the graph shows.**
  - T-19's DAG is all done and reads as history: what followed what in v0.
  - T-81 reads as a plan: T-101 waits on everything, and a frontier of unblocked items stands left of it.
  - Grouped by stages, the synthetic T-200 shows what the plan view T-100 will need: lanes, QA policy, and edges against the plan.
- **What it does not show.** It is wide: T-19 is 371 columns, so it always scrolls. And it says nothing about the 27 children of T-19 that have no edges; the tray does.
- **Board or graph.** My observation, not a decision: the graph shows order and parallelism, which the board cannot. It joins the board (or the vertical board of T-99) rather than replacing `␣b`, which is what this branch does.

### human · 2026-10-09T21:39:23.419Z

The second iteration follows the human's reaction, "the graph is better vertical".

- **Commit** `0490b89` on `prototype/graph`, pushed to `origin` only and never merged.
- **Layout.** Top to bottom is now the default. The first iteration's left-to-right layout is one key away (`o`).

## Try it on the live hub

From the main worktree, with the hub running:

```sh
git worktree add --detach /tmp/cland-graph-2 prototype/graph && /tmp/cland-graph-2/nvim/bin/cland-nvim .
```

Then `␣G`. If the first iteration's `/tmp/cland-graph` still exists, `git -C /tmp/cland-graph switch --detach prototype/graph` updates it instead. Remove either with `git worktree remove <path>`.

## The vertical layout

- **Layers top to bottom.** A node's layer is one past its furthest blocker. The items of a layer stand side by side and can run in parallel. A gutter on the left numbers the layers.
- **Edges go down.** Every edge has its own track in the rows under its layer. A source's tracks lie one under the other, and the sources are ordered for the fewest crossings.
  - Tracks that do not overlap then share a row. Two tracks that do not overlap never cross whichever lies higher, so this only shortens the channels: T-19 went from 72 to 64 rows at 118 columns, with the same crossings.
  - A crossing is a vertical drawn over a broken horizontal. Lines join only where a track ends or parts from its source's line, so `┼` never appears.
  - A line leaves a node from under its glyph, through the first cell of the node's second line.
- **Kept from the first iteration:**
  - the tray for edgeless items, with the done ones folded (`d`);
  - the stage grouping (`s`), with the bands labelled S1, S2 and the stage names and QA policies in the footer;
  - the status glyphs and marks; `gi`, `gt`, `gs`, Enter; `p`/`P`; and the live-update cursor.
- **Glyphs.** They are now those of spec §3.11: ◉ green for ready, ◉ amber for review and qa, ○ for planned as for backlog.

## Keys

| Key | Top to bottom |
| --- | --- |
| `j` `k` | The next / previous layer, at the nearest column; from the last layer into the tray and back. |
| `h` `l` | Along the layer. |
| `^` `$` | The layer's ends. |
| `gg` `G` | The first / last layer. |
| `o` | Left to right (the first iteration's layout and keys), and back. |
| `+` `-` | The narrowest a node may get before a layer wraps (20 by default). |
| `↵` `gi` `gt` `gs` `p` `P` `r` `s` `d` | As before. |

The view scrolls down like any buffer, and sideways only where a row is still wider than the window. A sideways scroll left over from a wider window goes away.

## Wide rows

- **Node width.** It is fitted to the window: the widest node, from 36 columns down to 20, at which every layer fits one row.
- **Wrapping.** A layer too wide even at 20 goes on under itself on rows marked `↳` in the gutter. Its nodes are cut, in order, into rows of their own, keeping room for the lines that pass through. The lines into the later rows pass the earlier ones as straight verticals.
- **Width when wrapping.** The nodes then take the widest width that needs no more rows than 20 would. Every row holds at least one node.

T-19's widest layer is layer 9, with six nodes:

| Window | Layer 9 | Nodes | Whole graph |
| --- | --- | --- | --- |
| 120 columns, with the sessions panel the workbench opens with (centre 85) | 2 + 2 + 2, under two `↳` | 21 wide | 3 rows wrapped in all |
| 120 columns alone | 3 + 3, under one `↳` | 24 wide | 1 row wrapped, 84 lines |
| 200 columns, with the sessions panel | 6 in one row | 20 wide | nothing wrapped |
| 200 columns alone | 6 in one row | 29 wide | nothing wrapped, 63 lines |

T-81 is the other epic checked. Its first layer has ten roots, so it wraps even at 200 columns: 7 bands, one under `↳`, nodes 33 wide. At 120 columns it has 9 bands, three under `↳`, nodes 20 wide.

## Costs

Measured on the live hub at a load average of about 6.5, medians of 20 renders:

| Parent, window | Layout | Draw | Buffer write | `redraw!` |
| --- | --- | --- | --- | --- |
| T-19, 200 | 2.8 ms | 4.2 ms | 0.29 ms | 0.80 ms |
| T-19, 120 | 5.8 ms | 4.3 ms | 0.36 ms | 0.77 ms |
| T-81, 200 | 5.1 ms | 4.7 ms | 0.43 ms | 0.75 ms |
| T-81, 120 | 5.7 ms | 6.0 ms | 0.74 ms | 0.76 ms |
| T-20, 200 | 1.5 ms | 2.0 ms | 0.17 ms | 0.72 ms |
| T-20, 120 | 3.9 ms | 3.3 ms | 0.34 ms | 0.74 ms |

- Layout covers the labels, layers, order, fitting, wrapping and places. Wrapping costs one more layout pass.
- A cursor move redraws only the focus highlight: at most 0.13 ms.
- A render runs only when something the graph shows has changed.

## Checks

- **The QA case.** `qa/cases/GRAPH-001.lua` passes on the stub hub, rewritten for the vertical layout. It checks:
  - T-19's layers and wrapping at 160, 120 and 200 columns, with and without the sessions panel, and no sideways scroll;
  - every key above, Enter and `␣␣`, `gi`, `gt`, `gs` and `␣b`;
  - the sampler's statuses and the spec's glyphs;
  - the stage grouping, with the lane gap;
  - `o` to left to right and back;
  - two task events;
  - T-20 with `r`, and `+`.
- **The drawing.** No false merge, no line through a label, and no `┼`:
  - over 900 random top-to-bottom layouts (free, packed and staged, 942,223 cells);
  - over 335 composes of T-19, T-20, T-81 and T-200 from 40 to 238 columns.
  - Below 55 columns, a single node with the lines passing beside it can be wider than the window, so the view scrolls sideways there.
- **Tests.** The shell tests pass (60 of 60), and so do the shipped QA cases.

### human · 2026-10-09T21:48:07.922Z

Resolution (2026-10-09). The human tried the prototype on prototype/graph (e34618f, 476a0fd, 847d4ff; the vertical layout in 0490b89) on the v0 epic: with many crossing edges it reads badly, so the graph stays in v0.1 as an experimental extra view (␣G, :Cland graph), the board stays as it is on ␣b, and legibility is revisited in the next version. The vertical layout is the default, o turns it sideways; ready is green ◉ as the spec says.

Also decided in the same round: a Reviewer or QA takes a verifier hold beside the Implementer's claim instead of a claim; the hold sets review or qa; the merge gate refuses a verdict only from the Implementer's claim holder (spec §3.2 amended, GLOSSARY Claim).

Recorded in docs/spec/v0.1.md §3.15 and §3.2.

### human · 2026-10-09T21:48:19.213Z

Resolved: see the resolution comment; spec v0.1 §3.15; §3.2 amended
