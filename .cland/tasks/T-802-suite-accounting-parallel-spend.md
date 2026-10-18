---
id: T-802
kind: task
title: "suite-accounting: parallel spend reservations hit the budget.lock 60 s deadline instead of the cap refusal, once on a droplet after T-609's two-ledger locking"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-609
topic: topic-512
branch: t/T-802-suite-accounting-parallel-spend
created: 2026-10-18T13:31:26.640Z
updated: 2026-10-18T14:33:12.420Z
---

## Summary

In T-641's droplet verify baead1a4 (A-5325, head 73857d73, init-only diff), hub/test/suite-accounting.test.ts:178 "parallel acquires each reserve shared spend; cap refusals stay local without holding remote slots" expected `daily spend cap $0.1 reached` but got `executor/budget.lock acquisition deadline reached after waiting 60000 ms`, in a test that ran 0.135 s. Three green dev covers since T-609 (88a0ec68) passed it. T-609 added a second (legacy-first) ledger lock to every spend mutation, so concurrent acquirers may now contend on two locks, or a fake-clock deadline may be read against the wrong clock.

## Acceptance criteria

- [ ] C1. The cause is named: lock ordering between budget.lock and the two ledgers' locks under parallel acquires, or a clock mismatch in the deadline.
- [ ] C2. Parallel acquirers at the cap get the cap refusal, never a lock-deadline error, proved 50/50 by a T1/T2 test with injected concurrency and FakeClock.

## Comments

### impl-802 · 2026-10-18T14:33:12.420Z

Source investigation: suite-accounting sets CLAND_EXECUTOR_STATE, so the failing scenario never takes the legacy spend lock. budget.lock is released before reserveSpend; lock native deadlines are translated using Date.now. Prepared controlled native-publication/concurrent-clock-driver regression plus fifty parallel at-cap acquirers. No local tests run while cover-quiet remains active. Initial test:lint and typecheck passed.
