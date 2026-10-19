---
id: T-882
kind: task
title: Six T2 cases run 3–14 s against the 2 s T2 budget
state: open
status: backlog
size: M
labels:
  - needs-triage
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T15:38:55.994Z
updated: 2026-10-19T15:38:55.994Z
---

## Summary

T-879's same-head receipt (A-6161, audited in A-6167) shows six T2 cases at 3 s or more against the 2 s T2 budget. The legacy gate only reports them today, but they would fail once T2 budgets enforce, and they are the slowest T2 tail. Found aside by rev-31 on 2026-10-19 while reviewing T-879.

## Cases

- nvim/test/thread.test.ts::generated live appends, ask evictions and delivery changes equal a full render 13.964 s > 2 s (T2)
- hub/test/crew.test.ts::non-table crew values are refused and cannot replace the last good staffing 6.085 s > 2 s (T2)
- nvim/test/inbox-sections.test.ts::waiting ages advance on the local clock with no inbox request or hub frame 5.606 s > 2 s (T2)
- hub/test/task-prefixes.test.ts::task publication lookup work stays bounded with two thousand unrelated items 4.351 s > 2 s (T2)
- hub/test/crew.test.ts::crew CLI and protocol validate changes, reload hand edits, and retain the last good policy with a notice 4.056 s > 2 s (T2)
- hub/test/hygiene.test.ts::a socket that misses two heartbeats is closed and the spoke reconnects with a fresh hello 3.076 s > 2 s (T2)

## Acceptance criteria

- [ ] C1. Each listed case runs within the 2 s T2 budget on the Mac and in a mode-free task verify, or moves to T3 under the tier-move rule with its assertions kept; the receipt shows no report-only budget line for any of them.
