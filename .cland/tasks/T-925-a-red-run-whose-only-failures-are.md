---
id: T-925
kind: task
title: A red run whose only failures are enforce-mode budget lines reports cause test-failure with no tests (periodic A-6900)
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-915
found_by: cover
topic: topic-677
branch: t/T-925-a-red-run-whose-only-failures-are
created: 2026-10-20T01:24:30.644Z
updated: 2026-10-20T01:27:26.183Z
---

## Summary

The periodic dev T3 run e8f0c390 at 0f8cb85b (A-6900) went red with cover cause "test-failure" but an empty failing-tests list. Its only failures were two enforce-mode `duration budget:` lines (T2 tests at 2.06 s and 2.39 s against 2 s); all 1091 tests passed. So the culprit search reported "inconclusive; no failing files identified", and the run looks like a mystery failure.

## What to build

Classify a red run whose only failures are budget lines with its own cause, for example `budget`. List the over-budget identities in place of failing tests, and have the culprit search say "budget only: <identities>" rather than inconclusive. Test failures keep today's behaviour.

## Acceptance criteria

- [x] C1. A T2 test: a run log with only `duration budget:` failures yields cause `budget` with the identities listed, and the periodic culprit search message names them.
  - done: impl-925 · 2026-10-20T01:27:11.433Z
- [x] C2. A run with a real test failure and a budget line is still classified test-failure, with the test listed.
  - done: impl-925 · 2026-10-20T01:27:12.024Z
- [ ] C3. A mode-free verify at the reviewed head is green.

## Comments

### impl-925 · 2026-10-20T01:25:25.388Z

Diagnosis: tier-labelled enforce-mode duration lines are not matched by existing cover parser. Implementing at existing cover/periodic result/report seams; required T2 projectHub regression will exercise real emitted log formats and periodic culprit notice, plus mixed real test failure.
