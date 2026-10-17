---
id: T-703
kind: task
title: Name reservation, tracker readiness, task migration, inbox load and the ask chain run in T1 and T2 with shared fixtures
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
  - T-685
  - T-686
  - T-687
topic: null
branch: null
created: 2026-10-16T19:59:37.302Z
updated: 2026-10-17T21:48:43.015Z
---

## Summary

Tracker and hub rules dominate these files, at the cost of fixture rebuilds, oversized seeds and spawned hubs (report-slice2 #9, report-slice1 #3 and #7, report-slice4 anti-pattern A):

| File | Seconds | Note |
|---|---:|---|
| `name-reservation.test.ts` | 54.3 | 63 tests; ≥12 permutations, each rebuilding the ~0.7 s `pendingAlias` fixture |
| `tracker-ready.test.ts` | 53.5 | mocks `String.prototype.replace` for a timing triple; sleeps 1100 ms past a backoff |
| `task-migrate.test.ts` | 42.1 | 11 hub starts and 44 CLI calls for a file transform |
| `inbox-workload.test.ts` | 40.0 | seeds 2000 items and 3000 messages one create at a time |
| `ask-chain.test.ts` | 39.0 | 32 spoke spawns; fake Claude Leads only for a session id |
| `ask-attribution.test.ts` | 5.8 | the same fixture as `ask-chain` |

## What to build

- **name-reservation.** Each permutation family is one test with `t.test` subcases over a fixture built once.
- **tracker-ready.** The retry and timing cases run on an injected clock with no builtin mocked; the crash-at restarts stay T3 with a header.
- **task-migrate.** Fixtures come from `preparedProject` and the migration module is called directly. Two real-hub tests stay: resolving old ids after a real restart, and an older task branch landing after migration.
- **inbox-workload.** The query-budget invariants run at 300 items seeded by one store transaction; the 2000-item run moves to T4.
- **ask-chain** takes in `ask-attribution`; Leads are fake-adapter sessions, and restarts are `projectHub` stop and serve.

## Acceptance criteria

- [ ] C1. The six files' manifest seconds fall from 234.7 s (A-3877) to 120 s or less on the merge path (T1–T3), with the large-seed run in T4.
- [ ] C2. Their `startDaemon` call sites fall from 19 to 3 or less and `spawnSpoke` sites from 61 to 12 or less.
- [ ] C3. No test in the six files mocks a builtin prototype, proved by a source check, and the moved rules pass the tier lint as T1 or T2.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-685, T-686, T-687.
