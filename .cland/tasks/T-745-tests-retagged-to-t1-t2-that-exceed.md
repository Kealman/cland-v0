---
id: T-745
kind: task
title: Tests retagged to T1/T2 that exceed their new tier budgets before the budgets turn hard
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T17:06:00.092Z
updated: 2026-10-17T21:48:43.072Z
---

## Summary

After T-690's retags, run 60db9eb8 (A-4639) reports tier-budget overruns in report mode. Budgets turn hard one week after tiers.json landed (D53), so these will fail runs then:
- inbox-workload.test.ts, T2: 37.6 s against the 30 s file budget, plus two tests at 4.9 s and 2.6 s against 2 s;
- tracker-container-source.test.ts, T1: 5.3 s against 0.5 s;
- roles-snapshot.test.ts, T2: 3.3 s against 2 s;
- suite-tiers.test.ts, T1: 0.74 s against 0.5 s;
- merge-policy.test.ts, T2: 2.15 s against 2 s.

## What to build

For each file, either speed the test up to its tier's budget (keeping its assertions), or move it to the tier its cost belongs to and say why. An allowance is a last resort: owner E-677, 7-day expiry, and a reason with platform and measurement. List every tier-budget line from the latest green integrated cover in the review request, so none is missed.

## Acceptance criteria

- [ ] C1. The latest integrated cover shows no "would fail" tier-budget line for T1 or T2 files, or each remaining one has an owned allowance with a reason.
