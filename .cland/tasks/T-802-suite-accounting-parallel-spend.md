---
id: T-802
kind: task
title: "suite-accounting: parallel spend reservations hit the budget.lock 60 s deadline instead of the cap refusal, once on a droplet after T-609's two-ledger locking"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-512
branch: t/T-802-suite-accounting-parallel-spend
created: 2026-10-18T13:31:26.640Z
updated: 2026-10-18T14:45:33.875Z
---

## Summary

In T-641's droplet verify baead1a4 (A-5325, head 73857d73, init-only diff), hub/test/suite-accounting.test.ts:178 "parallel acquires each reserve shared spend; cap refusals stay local without holding remote slots" expected `daily spend cap $0.1 reached` but got `executor/budget.lock acquisition deadline reached after waiting 60000 ms`, in a test that ran 0.135 s. Three green dev covers since T-609 (88a0ec68) passed it. T-609 added a second (legacy-first) ledger lock to every spend mutation, so concurrent acquirers may now contend on two locks, or a fake-clock deadline may be read against the wrong clock.

## Acceptance criteria

- [x] C1. The cause is named: lock ordering between budget.lock and the two ledgers' locks under parallel acquires, or a clock mismatch in the deadline.
  - done: impl-802 · 2026-10-18T14:43:37.761Z
  - verified: rev-30 [reviewer] · run rev-20261018-802-source · 2026-10-18T14:45:33.875Z · commit ebe4d0f877dfe6a854805e35db2cb9153438ca98
- [x] C2. Parallel acquirers at the cap get the cap refusal, never a lock-deadline error, proved 50/50 by a T1/T2 test with injected concurrency and FakeClock.
  - done: impl-802 · 2026-10-18T14:43:38.734Z

## Comments

### impl-802 · 2026-10-18T14:33:12.420Z

Source investigation: suite-accounting sets CLAND_EXECUTOR_STATE, so the failing scenario never takes the legacy spend lock. budget.lock is released before reserveSpend; lock native deadlines are translated using Date.now. Prepared controlled native-publication/concurrent-clock-driver regression plus fifty parallel at-cap acquirers. No local tests run while cover-quiet remains active. Initial test:lint and typecheck passed.

### impl-802 · 2026-10-18T14:43:57.560Z

Implemented and pushed ebe4d0f8. Exact red reproduced budget.lock acquisition deadline after 60000ms; fixed fixture tracking native acquisition work versus clock waits and serializing clock drivers. Green: 50/50 exact cap refusals, clock 10/10, accounting 10/10, spend 10/10, admission-lock 4/4; lint/typecheck pass. Evidence A-5360. Full source review requested from reviewer role; mode-free droplet verify follows clear verdict at same head.

### rev-30 · 2026-10-18T14:45:33.875Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-802-source
commit: ebe4d0f877dfe6a854805e35db2cb9153438ca98
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. C1 verified: accounting fixture disables legacy migration, budget.lock releases before reserveSpend, and native probe deadlines are translated; the reproduced failure is fake retry time outrunning native lease publication, compounded by overlapping drivers. Fixture-only ownership tracking pauses advancement until native work yields/completes and serializes run drivers. T1 publication/driver control and T2 fifty-real-acquirer cap control retain exact outcomes and cleanup; no production spend changes or new process. Standards/spec have no findings. A-5360 supplied red/green summary reviewed; local checks are reported, not Reviewer execution. Temporary 8s allowance is scoped, dated and owned by E-482 under primary approval 7261d97c. C2 remains pending the exact-head post-source mode-free droplet gate; no per-item QA.

Criteria: C1 verified.
