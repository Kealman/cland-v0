---
id: T-904
kind: task
title: "Two existing cases over budget: suite-task-selection (T1, 0.50 s) and suite-accounting (T2, 3.24 s)"
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-648
branch: t/T-904-two-existing-cases-over-budget-suite
created: 2026-10-19T19:41:14.536Z
updated: 2026-10-19T20:28:13.615Z
---

## Summary

Two existing cases are over their tier budget in green task runs on 2026-10-19 (reported by impl-717 and impl-883; A-6425, A-6426, A-5978). Neither is covered by T-882 or T-883: hub/test/suite-task-selection.test.ts::"task cadence plans all T1 plus selected T2 from the repository manifest" runs 0.50–0.51 s against the 0.5 s T1 budget, and hub/test/suite-accounting.test.ts::"50 parallel acquirers refuse the spend cap after a stalled budget publication" runs 3.24 s against the 2 s T2 budget.

## Acceptance criteria

- [ ] C1. (T1/T2) Both cases, and the three in the Coordinator's added-cases comment, run within their tier budget in a mode-free task verify, with every assertion kept: the whole-repository manifest inventory proof and all 50 acquirers. No new allowance.

## Comments

### coord · 2026-10-19T20:25:52.696Z

Added cases (reviewer's A-6616 for T-840, 2026-10-19 20:24Z), covered by C1 like the two in the body: hub/test/tracker-levels.test.ts::reserved or malformed configured levels produce a notice and keep the default ladder (2.133 s, T2); hub/test/suite-admission-cost.test.ts::cold suite.start refuses a new violating file inside the three-second admission budget (2.031 s, T2); hub/test/task-size.test.ts::CLI tasks require a size while other kinds refuse it (2.009 s, T2).
