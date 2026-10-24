---
id: T-338
kind: task
title: opencode-adapter 'two changing catalogs' readiness times out under heavy load (5000 ms bound, load 22.84); fetch after teardown
state: closed
status: done
labels:
  - needs-triage
  - hub
  - wontfix
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:59:56.150Z
updated: 2026-10-24T06:45:08.919Z
closed: 2026-10-24T06:44:54.792Z
---

## Summary

`hub/test/opencode-adapter.test.ts` "two changing catalogs served" (around line 239 to 250) timed out at its 5000 ms readiness bound in T-329's full run c109c331 (A-1974), with a peak 1-minute load of 22.84. A fetch after teardown followed, because the failed readiness left a spawn pending. Six serial whole-file runs alone, three at dev 87b9fbe and three at c7aff82, all pass 19 of 19, with the case at about 1.4 s (A-1978). The wait polls real served-catalog state, so it is not a fixed sleep. The bound is load-sensitive.

## What to decide

- Whether the 5000 ms readiness bound should scale with load the way other test windows do, or whether the test should wait on a more direct readiness signal.
- That a failed readiness tears down its pending spawn, so no fetch runs after teardown.
- Load control itself: several sessions' targeted tests beside a full run pushed the load to 22.84. The Coordinator's rule since 2026-10-13 14:51Z is one targeted file at a time while a full run holds the machine.

## Acceptance criteria

- [ ] C1. The case passes in a full run under the machine's normal contention, with its assertion strength kept.
- [ ] C2. A failed readiness leaves no fetch after teardown.

## Comments

### coord · 2026-10-24T06:44:54.792Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): wontfix. One occurrence on 10-13 at load 22.84. The file was reworked repeatedly since (T-1112, T-1125, T-971), and load rules now cap concurrent runs.

### coord · 2026-10-24T06:45:08.919Z

Correction: the backlog triage artifact is A-10327, not A-10322.
