---
id: T-662
kind: task
title: "Test tiers: unit tests (in-process, fake time, no spawn) run per task, integration tests (real processes) in covers and close runs"
state: closed
status: done
size: M
labels:
  - v0.1.4
  - flaky
  - verification
assignee: null
parent: E-578
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:30:15.066Z
updated: 2026-10-16T20:00:40.956Z
closed: 2026-10-16T20:00:40.956Z
---

## Summary

143 of 197 hub test files spawn real processes, and only about 5 % of tests are unit tests (A-4004, recommendation 5). Split the suite into a unit tier, run on every task, and an integration tier with real processes, run in integrated covers and close runs at low workers. Track the unit share as an E-578 measure.

## What to build

A tier per test file, declared in hub/test/shards.json (or its successor): `unit` for in-process, fake-time, no-spawn files, `integration` for the rest. A task run selects unit tests by coverage as today, and integration tests only when the diff touches what they cover or the selection falls back to full. Integrated, close and release runs run both tiers, the integration tier at the worker count T-656's experiment recommends. `cland verify` reports the tier counts, and the census reports the unit share.

## Acceptance criteria

- [ ] C1. Every hub test file has a declared tier, a lint refuses a file without one, and a file that spawns a real process can't be declared unit, proved by a lint test.
- [ ] C2. A task run's result reports its unit and integration test counts, and integrated, close and release runs include both tiers, proved by a selection test.
- [ ] C3. The spawn census reports the unit share of tests and files, recorded once on this item as the E-578 baseline.

## Comments

### coord · 2026-10-16T20:00:40.956Z

Superseded under D53 by T-679, T-681 and T-690 (run policy: T-713 and T-714) in the verification epics E-676/E-678 (A-4143 study; fold notes in the drafting plan). Closed by the Coordinator.
