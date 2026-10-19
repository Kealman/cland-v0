---
id: T-904
kind: task
title: "Two existing cases over budget: suite-task-selection (T1, 0.50 s) and suite-accounting (T2, 3.24 s)"
state: open
status: backlog
size: S
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T19:41:14.536Z
updated: 2026-10-19T19:41:14.536Z
---

## Summary

Two existing cases are over their tier budget in green task runs on 2026-10-19 (reported by impl-717 and impl-883; A-6425, A-6426, A-5978). Neither is covered by T-882 or T-883: hub/test/suite-task-selection.test.ts::"task cadence plans all T1 plus selected T2 from the repository manifest" runs 0.50–0.51 s against the 0.5 s T1 budget, and hub/test/suite-accounting.test.ts::"50 parallel acquirers refuse the spend cap after a stalled budget publication" runs 3.24 s against the 2 s T2 budget.

## Acceptance criteria

- [ ] C1. (T1/T2) Both cases run within their tier budget in a mode-free task verify, with every assertion kept: the whole-repository manifest inventory proof and all 50 acquirers. No new allowance.
