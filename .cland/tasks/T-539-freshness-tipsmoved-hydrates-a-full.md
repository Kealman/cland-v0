---
id: T-539
kind: task
title: "Freshness #tipsMoved hydrates a full Tracker.list to find freshness-dependent items"
state: open
status: backlog
size: S
labels:
  - hub
  - tech-debt
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:17:45.123Z
updated: 2026-10-15T21:17:45.123Z
---

## Summary
Found by impl-469 on T-469 (2026-10-15 21:17Z, A-3372). On each tip move, `Freshness.#tipsMoved` hydrates a full `Tracker.list`. A planned-stage landing then runs close to the test's 10,000-query budget: 9,795 queries for 3 stage checks. Eight `Worktrees` safety full lists add to it. The proposal is to select freshness-dependent ids in `TrackerIndex` and keep `#announce` and `#scheduleReady` as they are, replacing the full hydration. Related: T-538, `#hydrate`'s own-id lookups.

## Acceptance criteria
- [ ] C1. `#tipsMoved` selects only freshness-dependent item ids through the index instead of hydrating a full `Tracker.list`, and its announcements and ready scheduling are unchanged.
- [ ] C2. The planned-stage per-item case's query count falls measurably (before and after recorded), and every freshness, ready and merge-gate test passes.
