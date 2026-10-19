---
id: T-893
kind: task
title: The periodic dev run covers T2 too, so post-merge T2 interactions surface within two hours
state: open
status: backlog
size: S
labels:
  - v0.1.4
assignee: null
parent: C-326
blocked_by:
  - T-887
topic: null
branch: null
created: 2026-10-19T19:09:07.564Z
updated: 2026-10-19T19:09:07.564Z
---

## Summary

Merge batches run T1 only (D67) and earlier ran T1+T3, so T2 tests never run on dev after a merge. On 2026-10-19 T-666 and T-793 each passed their own task run, but together they broke hub/test/verify-tool.test.ts (T2) on dev, and the break surfaced only in T-887's later task run (T-891). The periodic dev run from T-886 should cover T2 as well as T3, so such interactions surface within two hours and are attributed by T-887's search.

## Acceptance criteria

- [ ] C1. (T1) The periodic dev run (`dev_t3_every`) plans T2 and T3, and a red T2 file in it feeds the same culprit search and Bug filing as a red T3 file (fake-runner test).
- [ ] C2. (T0) docs/agents/tests.md says that T2 runs after merge only in the periodic dev run, the soak and close occasions.
