---
id: T-1074
kind: task
title: Scope, selection and messages to the Coordinator in the Items area
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: topic-831
branch: t/T-1074-scope-selection-and-messages-to-the
created: 2026-10-21T17:32:16.621Z
updated: 2026-10-22T04:23:45.788Z
---

## Summary

Scoping, selection, the messages to the Coordinator and item ids as links in the Items area.

## Parent

E-416 (§3.4, v0.1.2 §3.8; tracer step 3).

## What to build

`s` scopes to a node with breadcrumbs and a back stack, and `␣␣` goes back. `x` toggles a row into the selection, Shift with `j` or `k` extends it, and Esc clears it. `m` opens the card's one-line quick message to General, with the item's context. `M`, or the switch beside the field, sends to the item's topic and creates it when missing. `m` on a selection sends one message to General with one line per item. `gi`, `gt` and `gs` jump, and an item id in any text opens the item with its ancestors unfolded.

## Acceptance criteria

- [x] C1. Three selected rows and `m` deliver one message to General naming the three items by display id, as a fake Coordinator receives it (Web test with the fake harness).
  - done: impl-1074 · 2026-10-22T04:23:18.625Z
- [x] C2. `M` on an item without a topic creates its topic and sends there (Web test).
  - done: impl-1074 · 2026-10-22T04:23:18.695Z
- [x] C3. `s`, the breadcrumbs, `␣␣` and item-id links behave as described (Web test).
  - done: impl-1074 · 2026-10-22T04:23:18.865Z

## Comments

### impl-1074 · 2026-10-22T04:13:33.188Z

C1 test-first public browser seam reached red with [] instead of the three expected selected ids (trace A-8890). Shared Items state extracted at 59b7d6ca for parallel T-1075; selection and General quick message implemented. Targeted fixture delivery setup being completed; no source review or suite receipt yet.

### impl-1074 · 2026-10-22T04:23:34.144Z

Implemented and pushed 2a4093c1 (tree ae430f1b); origin/dev merge already current. C1–C3 marked done and source review requested from Reviewer. Exact-head macOS arm64 root check exit0 A-8895, Web actions3/3 A-8896; rendering A-8897. Lint report-only132 findings/59 files,0 refusals. No queued verification or Linux receipt yet. Stage QA remains after-stage.
