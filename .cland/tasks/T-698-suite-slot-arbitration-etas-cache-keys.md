---
id: T-698
kind: task
title: Suite slot arbitration, ETAs, cache keys and cover classification are tested on Suites directly, with two real-fixture proofs kept
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-697
topic: null
branch: null
created: 2026-10-16T19:59:36.616Z
updated: 2026-10-17T06:43:05.504Z
---

## Summary

Slot arbitration and ETA maths are `Suites` scheduler state, but most cases spin up three or four worktrees, spokes, CLI submissions and fake droplets to read a queue snapshot (memo §2.2 win 2; report-slice2 #1, report-slice1 #10, report-slice4 honourable mentions). The right shape already sits in `suite-remote-budget.test.ts` ("fallback notice and log occur once across 20 ticks and restart": `new Suites(store, …)` with mocked timers in 0.1 s). The files:

- `suite-remote-budget.test.ts` (143.9 s) and `config-reload-remote.test.ts` (11.1 s, the same fixture).
- `suite-scheduling.test.ts` (36.3 s): budget 1 and 2 differ by one log line.
- `suite-queue.test.ts` (29.1 s): window-20 median and p90 over 20 cache hits.
- `suite-cache.test.ts` (36.7 s): key, mode separation, dirty bypass, expiry, supersede.
- `suite-cover.test.ts` (17.6 s): five fixture tests re-run a CLI and a worker to parse a canned log.

## What to build

These rules run as T1 tests on `Suites` with a fake executor (T-697) and a `FakeClock`: slot arbitration, remote-budget fallback, ETA from local and remote history, priority order, budget 1 and 2, cache key and eligibility, supersede, wait and run metrics, cover classification. `config-reload-remote.test.ts` merges into the budget file. Two real-fixture proofs stay T3 with headers: "finished remote runs free both budget slots" and "an unconfirmed release posts its receipt". Cache reuse across a real run stays in `suite-cache-recovery.test.ts`.

## Acceptance criteria

- [ ] C1. The six files' manifest seconds fall from 274.7 s (A-3877) to 120 s or less.
- [ ] C2. The scheduling, ETA, cache and cover rules sit in T1 files that pass the tier lint, and the kept T3 tests each name their process behaviour.
- [ ] C3. Fake droplets started by these files fall from the count recorded before (from the fake provider's request log) to 4 or less.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Comments

### coord · 2026-10-17T06:43:05.504Z

Coordinator correction from T-697: CLAND_TEST_DROPLET_MACHINE_MS is a readiness timeout in waitForMachine, not a fixed delay before the machine is ready. Lowering it from 2000 to 200 doesn't save 1.8 s per droplet by itself, so this ticket's speedup comes from the fixture and process work it removes (one fixture per test, in-process provider and scripted machine from T-697). Measure and report it that way. A case that needs real readiness timing keeps an explicit override, as T-697 did for the demo watchdog.
