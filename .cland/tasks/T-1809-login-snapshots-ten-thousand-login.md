---
id: T-1809
kind: task
title: login-snapshots ten-thousand-login budget case slowed by T-1784's capacity index and triggers
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1784
topic: null
branch: null
created: 2026-11-11T02:13:21.099Z
updated: 2026-11-11T02:13:21.099Z
---

## Summary

`hub/test/login-snapshots.test.ts::one login save has bounded scheduling work across ten thousand retained logins` went over its 5 s hard limit on the periodic dev T3 run 20d0d38d at 9ae466067 (5.425 s on Linux, log A-18558; the previous green aca1a4ffb measured 2.141 s, A-18540). Local macOS timing bisects the slowdown to T-1784 (e14c3bf6d): 0.74 s at aca1a4ffb, 1.21 s at e14c3bf6d, unchanged after. The assertions on one save's bounded work still pass; the extra time is the fixture's 10,000 inserts and transitions, which now maintain the partial `login_capacity_launch` index and the `pending_bindings` triggers.

## What to build

Make the case's setup cost proportionate again, without weakening what it proves about one save. Measure where the time goes first (seeding vs the two positive-control `list()` decodes vs the traced save), then either seed the retained history through a cheaper path that still produces real index and trigger state, or show that per-write maintenance is the cost and record it in docs/hub/logins.md. Remove the temporary duration allowance coord adds for this key once the case is back under budget.

## Acceptance criteria

- [ ] C1. The case's per-phase timing (seed, positive controls, traced save) at the fix head is recorded in an item comment, with the macOS before/after figures above as baseline.
- [ ] C2. The case runs under 2 s on macOS and its allowance entry is removed from hub/test/durations.json, or the comment explains why the per-write cost is inherent and the allowance is re-sized from measured samples.
- [ ] C3. The case's bounds on decoded rows, query count and indexed plans for one save are unchanged.
