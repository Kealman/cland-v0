---
id: T-159
kind: task
title: "The graph layout: a pure Lua module for cycles, reduction, layers, dummy vertices, ordering, tracks and the tray, on a display-column canvas, vertical and sideways"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by: []
topic: topic-66
branch: t/T-159-the-graph-layout-a-pure-lua-module-for
created: 2026-10-10T07:49:36.464Z
updated: 2026-10-10T08:29:43.945Z
---

## Parent

T-116 (The task graph), slice 1 of 5. Map T-98 (decided 2026-10-09), research T-86.

## What to build

A pure Lua layout module for the task graph, rebuilt from the prototype's `graph_layout.lua` (`prototype/graph`, head 0490b89) with unit tests of its own. Given a container's children and their `blocked_by` edges, it:
- leaves cycles out and names them;
- hides edges implied by a longer path, and keeps them available for `r`;
- puts each node in a layer one past its furthest blocker;
- passes long edges through dummy vertices;
- orders layers by barycentre sweeps and swaps;
- gives each edge its own track between two columns, drawing a crossing as `│` over a broken `─`, never `┼`;
- puts children with no edge to a sibling in a tray.

It renders to a text canvas whose cells are display columns, top to bottom by default, with a sideways orientation. No buffer, no hub and no keys in this slice.

## Acceptance criteria

- [ ] Unit tests cover cycles named and left out, transitive reduction, layers, dummy vertices, ordering, tracks and the tray.
- [ ] The canvas never draws `┼`; a crossing is `│` over a broken `─`.
- [ ] Both orientations (vertical by default, sideways) render from one layout.
- [ ] Demo: T-19's 22 items and 36 edges laid out headless, with the crossing count in the footer, recorded as an artifact.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

None (can start immediately).

## Comments

### impl-159 · 2026-10-10T07:50:09.125Z

Implementation started from dev 5b21963. Reading the prototype layout and research; keeping this slice confined to a pure graph module, its unit tests, and the T-19 headless demo.

### impl-159 · 2026-10-10T07:56:33.511Z

Pure module and 11 unit cases are implemented. Unicode widths are supplied by the caller; wide characters map both cells to their first byte, combining marks stay with their base, and clipping/trimmed highlight ranges stay within emitted lines. Typecheck and isolated cases pass. Demo A-495: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-495-t-159-t-19-headless-layout-vertical-and-sideways.md; T-19 has 22 linked items/36 edges, 4 hidden, 10 layers, 4 canvas crossings in both orientations and no ambiguous joins. Locked test:nvim is waiting for the active suite.

### impl-159 · 2026-10-10T08:22:13.103Z

Final head 37e8756e06ad6cf09f0ecf4c22bb4ce988bf85ce is committed and pushed to local origin; worktree clean. npm run typecheck passed on Node v24.21.0. Locked npm run test:nvim passed: 212/212 tests, no skips or failures (159.47s running, 1491.83s waiting for the package lock). The 11 pure Lua cases cover cycles/self-loops, reduction/reveal, longest-path layers/dummies, sweeps/swaps, positions, distinct tracks/crossings, sibling tray/outside edges, Unicode display/byte columns, both orientations, dense graphs and T-19. Public entry points: from_items(children, opts) builds the graph/tray; render(layout, opts) returns a canvas and geometry, defaulting to vertical. Labels and Unicode measurement are caller callbacks; low-level rows/draw/draw_v/canvas remain available for the view. Reproducible demo runner: nvim/test/graph-layout-demo.lua. Demo A-495 remains valid: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-495-t-159-t-19-headless-layout-vertical-and-sideways.md.

### rev-67 · 2026-10-10T08:29:43.945Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-159-1
commit: 37e8756e06ad6cf09f0ecf4c22bb4ce988bf85ce

Medium — nvim/lua/cland/graph_layout.lua:703 (call :744): tab width is calculated with only the preceding glyph, omitting the actual canvas column, then emitted verbatim. Native cv:put(0,3,{{"ab\tZ","label"}}) reports used10/total13 but emits a 9-display-column line; bytecol[0][8] points to the tab byte instead of Z. Interior tabs are valid tracker title text (tracker.ts:941/1143 only trim). Normalize tabs at the canvas boundary or expand with current-column-aware measurement, and pin offset/tab-stop byte maps. Violates T159's display-column canvas requirement; independently reproduced by Spec and root.

Low — possible Duplicated Code, nvim/lua/cland/graph_layout.lua:892 and :978: both orientations repeat source-block construction and farthest-target sorting; a shared position-map helper would prevent future ordering fixes diverging. Fowler judgement, not a documented violation or blocker.

High0/medium1/low1. Standards: no blockers, one low heuristic. Spec: one medium. Cycle reporting, reduction/reveal, furthest-blocker layers, dummies, ordering, own tracks/no ambiguous joins, tray, both orientations and purity match the ticket/prototype. All 11 cases and T19 demo A495 checked; independent native DAG probe checked368 renders with no ambiguous joins/┼. Diff check passes. Typecheck/test:nvim212/212 are reported by Implementer/Coordinator; Reviewer did not repeat a suite or edit files.

Evidence/probe: A-504, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-504-t-159-review-at-37e8756-tabbed-canvas-display-columns.md
