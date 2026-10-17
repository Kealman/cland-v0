---
id: T-703
kind: task
title: Name reservation, tracker readiness, task migration, inbox load and the ask chain run in T1 and T2 with shared fixtures
state: open
status: review
size: M
criterion_seq: 5
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
topic: topic-466
branch: t/T-703-name-reservation-tracker-readiness-task
created: 2026-10-16T19:59:37.302Z
updated: 2026-10-17T22:19:14.925Z
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

- [x] C1. The six files' manifest seconds fall from 234.7 s (A-3877) to 120 s or less on the merge path (T1–T3), with the large-seed run in T4.
  - done: impl-703 · 2026-10-17T22:12:59.436Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
- [x] C2. Their `startDaemon` call sites fall from 19 to 3 or less and `spawnSpoke` sites from 61 to 12 or less.
  - done: impl-703 · 2026-10-17T22:05:21.412Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
- [x] C3. No test in the six files mocks a builtin prototype, proved by a source check, and the moved rules pass the tier lint as T1 or T2.
  - done: impl-703 · 2026-10-17T22:05:23.051Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-703 · 2026-10-17T22:04:51.834Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.925Z · commit 81d65861baa96fc019453da9a506184231310fb3
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-685, T-686, T-687.

## Comments

### impl-703 · 2026-10-17T21:58:47.285Z

Implementation progress: ask-chain absorbs attribution (13 tests, 3.7 s); reservation peers now in-process and 12 permutations share four fixtures; inbox query invariants use 300-message transactions and a 300-item fixture, sharing the assertion body with a new 2000-item/3000-message T4 run. Readiness component rules split from native crash/Git coverage. SQLite faults/tracing now use fixture-owned openers; readiness retry scheduling and parse timing have injected seams. origin/dev remains current. Whole-file repetition and assertion audit next.

### impl-703 · 2026-10-17T22:13:40.694Z

Implementation committed as 00852eaf, then required origin/dev merged and pushed as e1d7275e5b2147721dd4a0e20b91f8b64cda5018. A-4784 contains the 35 final-source qualifying Mac receipts and 884-assertion audit; A-4786 records the corrected, green duration manifest validation. C1–C4 are done. C5 Mac 5/5 is complete for all seven test files (including successors/T4); droplet proof remains pending source review. The merge added T-755 executor-health work, without changing task test source. Rechecking checks and one full serial pass of all seven files on the merged head before requesting review.

### rev-30 · 2026-10-17T22:19:14.925Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-703-source
commit: 81d65861baa96fc019453da9a506184231310fb3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 81d65861. Standards: no findings. Spec: no findings. A-4798 records production-default/seam review and complete 884-assertion audit. Independently recomputed Mac merge-path sum 62.074011005 s (<120); large-seed carrier T4. Three startDaemon sites, zero spawnSpoke, no builtin prototype mocks; four component files qualify T2. A-4784 raw 35 accepted whole-file runs: 605 pass, no failures/cancellations/skips, hashes match head; post-merge seven further passes A-4791. C1–C4 verified. C5 remains unverified pending exact-head droplet evidence; normal mode-free verify may proceed without source changes. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
