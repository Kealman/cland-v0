---
id: T-683
kind: task
title: Per-tier duration budgets apply to every test, with expiring allowances and a T3 ratchet, report only
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
  - T-681
topic: null
branch: null
created: 2026-10-16T19:59:28.090Z
updated: 2026-10-16T20:00:51.653Z
---

## Summary

`durations.json` grandfathers the slow mass: 300 tests over the 5 s budget hold 51 % of all test time and never fail, while the cliff bites only new tests (report-strategy §2.5, memo §3.5). Decision 3: budgets per tier for every test, no grandfathering, a ratchet with expiring allowances; report-only for one week after `tiers.json` lands, then hard (E-678). This ticket builds the report-only half. It supersedes T-661: its relative 2× rule keeps the grandfathering decision 3 removes.

## What to build

- **Budgets per tier** in `durations.json` `budget`: T1 0.5 s per test / 10 s per file / 120 s wall, T2 2 s / 30 s / 480 s, T3 10 s / 120 s / 900 s, T4 none. Every test and file is checked against its tier's budget, known or new.
- **Allowances** gain `owner` (an open item id) and `expires` (a UTC date at most seven days after `added`, as quarantine entries do), beside the existing non-TODO `reason`. The manifest lint names expired, ownerless or closed-owner allowances.
- **The T3 ratchet.** A run projects the T3 total: the base manifest's T3 seconds, minus files and tests the head removed or moved out of T3, plus the observed seconds of T3 tests new at the head. Growth over the base needs an allowance keyed `T3` with owner and expiry. T1 and T2 may grow up to their tier walls.
- **Report only.** The result prints `budget (report only): would fail <key> <s> s > <budget> s (<tier>)` lines ranked by seconds over budget (cap 10, full list in the log) and `T3 ratchet (report only): <projected> s vs base <base> s`. Today's rule (a new test over 5 s or a new file over 60 s without an allowance fails) stays in force unchanged until E-678 switches enforcement on, so nothing gets looser this week.
- **Missing entries.** Test files absent from `durations.json` (today `suite-candidate.test.ts`, `suite-candidate-remote.test.ts`, `quarantine.test.ts`, `quarantine-runner.test.ts`, `init-machine.test.ts`) are named and budgeted by their observed time.

## Acceptance criteria

- [ ] C1. Each known and new test and file is checked against its tier's budget, and the result lists the would-fail lines ranked by seconds over budget, proved by a durations test with a planted manifest.
- [ ] C2. An allowance without a non-TODO reason, an open owner item or an expiry at most seven days after `added` is refused by the manifest lint by name, proved by lint tests.
- [ ] C3. A head adding a 3 s T3 test without an allowance shows a would-refuse T3 ratchet line with the projected and base totals, and one moving a file from T3 to T2 lowers the projection, proved by a durations test.
- [ ] C4. A new test over 5 s without an allowance still fails exactly as before, and no report-only line changes a run's exit, proved by the existing durations-runner cases plus one new case.
- [ ] C5. A test file absent from `durations.json` is named and budgeted by its observed seconds, proved by a test.
- [ ] C6. `docs/agents/tests.md` describes the tier budgets, allowance fields, the ratchet and the report-only week.
