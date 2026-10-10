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
updated: 2026-10-10T07:56:33.511Z
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
