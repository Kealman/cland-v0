---
id: T-159
kind: task
title: "The graph layout: a pure Lua module for cycles, reduction, layers, dummy
  vertices, ordering, tracks and the tray, on a display-column canvas, vertical
  and sideways"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-116
blocked_by: []
topic: topic-66
branch: t/T-159-the-graph-layout-a-pure-lua-module-for
created: 2026-10-10T07:49:36.464Z
updated: 2026-10-10T08:45:36.103Z
closed: 2026-10-10T08:45:36.112Z
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

### impl-159 · 2026-10-10T08:33:08.579Z

Addressed review rev-67-159-1 / A-504 in pushed commit 5a382e019f87eae99ab21439c07d811acca718a1. Added an offset/tab/wide/combining-byte-map regression that failed before the fix (expected used7, got13); normalize C0/C1 controls to one space at width/fit/canvas entry, retaining combining marks and Unicode joiners. The exact review probe now emits '   ab Z', used4, claimed7, actual7, Z at byte6. All 12 Lua cases and typecheck pass. Also shared source-block construction and farthest-target ordering between vertical and sideways routing, addressing the low duplication note. Regenerated T-19 demo matches A-495 byte for byte. Locked test:nvim rerun is queued behind pid27640.

### impl-159 · 2026-10-10T08:41:35.666Z

Review fixes fully verified at pushed head 5a382e019f87eae99ab21439c07d811acca718a1. Typecheck and 12/12 pure Lua cases passed; locked test:nvim passed 213/213 with zero failures or skips (152.90s running, 333.00s lock wait). C0/C1 control normalization fixes both geometry and byte mapping; offset/tab/wide/combining regression and exact reviewer probe pass. Shared source-block construction addresses the low duplication note. T-19 demo remains byte-identical to A-495. Verification artifact A-508: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-508-t-159-review-fixes-control-normalization-and-shared-routing-verified.md. Worktree clean; returning to review.

### rev-67 · 2026-10-10T08:45:14.296Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-159-2
commit: 5a382e019f87eae99ab21439c07d811acca718a1

Clear: high0/medium0/low0. Standards and Spec independently clear.

A504 medium is resolved: width/fit/canvas normalize C0/C1 controls to one space before measurement/emission. Exact native ab\tZ at column3 now emits '   ab Z', used4, claimed/actual total7 and correct Z byte6. Root and independent chunk probes preserve wide/combining glyphs, byte maps and highlight ranges. The new controls case pins all65 controls, offsets and sideways geometry.

A504 low duplication is resolved through shared source_blocks. Independent pinned comparison of184 renders confirms old/new text, edge ownership and geometry exactly equal, with zero ambiguous joins. Required cycles/reduction/layers/dummies/order/tracks/tray/both-orientation/purity behavior and prototype checks carry forward. Frozen T19 demo/runner unchanged; A508 reports A495 byte-identical. Full-base diff check passes.

A508 and Coordinator report typecheck,12/12 pure Lua cases and test:nvim213/213 passing with no skips. Reviewer did not repeat a suite or edit files. Full-item evidence: A-509, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-509-t-159-full-item-review-at-5a382e0-clear.md

### coord · 2026-10-10T08:45:36.103Z

Merged 24d722365418a800350f9fcf5bfbeb9e463ceef0 onto dev.
