---
id: T-715
kind: task
title: The hub runs a nightly T1–T4 soak on a droplet within the daily spend cap and records the coverage map from it
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-714
topic: topic-522
branch: t/T-715-the-hub-runs-a-nightly-t1-t4-soak-on-a
created: 2026-10-16T19:59:44.178Z
updated: 2026-10-18T16:22:01.591Z
---

## Summary

Decision 7: a nightly T4 soak within the daily spend cap (~$0.15–0.25 a day, memo §6.7). The soak also has to carry what the batch no longer does. Coverage maps today come only from clean integrated full `dev` runs, and `coverage_max_age` is two days. Once covers retire (T-713, T-718) and batches run T1 and T3 only, T2 coverage would age out and every task run would fall back to all of T2.

## What to build

- **When.** `[verification] soak = "<HH:MM>"` (UTC; empty disables it, and this repository sets `"03:00"`). At that time the hub submits one run of the clean `dev` head with the new occasion `soak`, at the Coordinator's priority on the droplet executor, when `dev`'s candidate tree differs from the last soak's.
- **The run** plans T1–T4 with `CLAND_TEST_SOAK=1` and the load gate for identities new since the last soak, then records and publishes the coverage map as integrated full runs do.
- **Spend.** Before acquiring, the hub reserves the run's cost in the shared spend ledger. When the cap would be exceeded, it skips that night and posts one notice naming the cap.
- **The result** goes to the Coordinator in General. A red soak posts a quarantine proposal (T-712's form) for each test that failed with no code change since its last green, and never blocks a merge or a batch.

## Acceptance criteria

- [ ] C1. With a `FakeClock` past the configured time and `dev` changed, the hub submits exactly one soak run, and none when the tree is unchanged, proved by a scheduling test.
- [ ] C2. A soak whose reservation would exceed the daily cap is skipped with one notice naming the cap, proved by a test with the spend ledger.
- [ ] C3. A green soak records a coverage map that task selection reads, proved by a selection test.
- [ ] C4. A red soak posts a quarantine proposal per failing test and leaves the merge queue running, proved by a test.
