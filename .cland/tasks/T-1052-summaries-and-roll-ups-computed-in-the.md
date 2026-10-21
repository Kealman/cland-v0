---
id: T-1052
kind: task
title: Summaries and roll-ups computed in the hub, equal to the Lua's
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-805
branch: t/T-1052-summaries-and-roll-ups-computed-in-the
created: 2026-10-21T14:04:14.472Z
updated: 2026-10-21T14:35:39.353Z
---

## Summary

Move the summary rule and the container roll-ups from Lua into the hub, guarded by a differential test against the Lua on a copy of the live tracker. This is E-413's first tracer bullet and the one E-416 reads without an edge, so it lands first.

## Parent

E-413 (§3.3 "The explorer's roll-ups and the summary rule"; tracer step 1).

## What to build

Each item summary in the snapshot and the deltas carries the summary text with its provenance line, by the v0.1.2 §3.9 rule that `nvim/lua/cland/explorer_summary.lua` implements. A container additionally carries done/total, the status breakdown, the derived status, glyph and layer, the stage in work, its tasks' claims and holds, the latest verdict of its subtree naming the item, and the last activity naming its source. Every item carries `blocked`; every container carries `next`. Roll-ups are recomputed only for the changed item's ancestors, and a delta carries only the items whose fields changed. The fields are projections and are never written into item files (ADR 0002). The Lua rules define the results; the Q-405 port on `prototype/web-shell` (`web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts`) is a reference only.

## Acceptance criteria

- [x] C1. A differential test runs the hub's summary rule and roll-ups and the Lua's (`explorer_summary.lua` and the Lua roll-ups, through headless Neovim) over every body of a copy of the live tracker and reports zero differences (test).
  - done: impl-1052 · 2026-10-21T14:35:08.279Z
- [x] C2. A frame client reads an item's summary with its provenance, a container's roll-ups, `blocked` and `next` from the snapshot, with no `task.view` (test).
  - done: impl-1052 · 2026-10-21T14:35:08.299Z
- [x] C3. A change to one task produces a delta that carries only that task and its ancestors whose fields changed, and the recomputation touches only that chain (test).
  - done: impl-1052 · 2026-10-21T14:35:08.320Z
- [x] C4. On a thousand-item fixture, recomputing after one task change stays under a measured bound recorded in the test, and the startup reply budgets of T-1038 still hold (test).
  - done: impl-1052 · 2026-10-21T14:35:08.349Z
- [x] C5. `hub/README.md` describes the new summary fields, their provenance and the incremental rule.
  - done: impl-1052 · 2026-10-21T14:35:08.381Z

## Comments

### impl-1052 · 2026-10-21T14:31:49.829Z

Implemented the Lua-guarded cached summary/roll-up projection and bounded closed-summary by-id reads under the Coordinator's 2026-10-21 decision. Local Darwin arm64 targeted evidence on the working tree: C1 compared 1,051 copied tracker bodies, zero differences; items snapshot 822,111 bytes within 1 MiB. C3 frame mutations send only changed task/ancestors, with unchanged ancestor rows omitted. C4 1,000-row fixture recomputed only the three-row chain in 0.259 ms against 100 ms; existing eight startup reply guards pass. Root npm run check passes (test lint report mode, zero refusals). Source review and mode-free verification remain pending.
