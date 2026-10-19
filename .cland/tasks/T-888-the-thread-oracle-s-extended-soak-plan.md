---
id: T-888
kind: task
title: The thread oracle's extended soak plan needs a budget-correct placement
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: impl-882
parent: C-216
blocked_by: []
topic: topic-625
branch: t/T-888-the-thread-oracle-s-extended-soak-plan
created: 2026-10-19T16:36:08.592Z
updated: 2026-10-19T18:35:15.961Z
---

## Summary

Under CLAND_TEST_SOAK=1, threadSeedPlan expands nvim/test/thread.test.ts "generated live appends, ask evictions and delivery changes equal a full render" from 2x12 to 4x25 renders. That extended plan took 2.325 s on the Mac after T-882 (ordinary T2: 0.741 s), and it is still covered by a legacy allowance. Found aside by impl-882 on 2026-10-19.

## Acceptance criteria

- [ ] C1. The extended soak plan of that case either runs within its tier budget, or moves to a T4 soak case with the T4 header. The legacy allowance for the identity is retired, and the ordinary T2 plan is unchanged.
