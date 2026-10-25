---
id: T-1154
kind: task
title: Droplet reservation waits ignore shutdown and can hold hub.stop for up to 60 s
state: open
status: in progress
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1066
branch: t/T-1154-droplet-reservation-waits-ignore
created: 2026-10-22T19:53:59.804Z
updated: 2026-10-25T19:20:13.962Z
---

## Summary

Found by T-1151's reviewer, outside that item's held-create boundary. `DropletExecutor.#reserve` (hub/src/executor/droplet/droplet.ts around line 66) awaits `acquireLockWithRetry` before it checks for shutdown, and lock.ts allows a 60 s wait; `reserveSpend` has a similar wait. A hub stop that arrives while a run waits on the reservation lock can therefore still be held past the bounded shutdown T-1151 adds. This predates T-1151.

## What to build

Reservation and spend-ledger waits become cancellation-aware. On stop they stop waiting. A lock acquired after the stop began is released safely and never detached while still owned. No reservation is left counted against the daily cap or remote budget.

## Acceptance criteria

- [ ] C1. A hub stop while a run waits on the reservation lock or the spend ledger exits within 3 s, and a lock acquired late is released and not left owned (test).
- [ ] C2. No spend reservation or remote slot stays counted after such a stop, as shown by the next hub's executor status (test).
- [ ] C3. Sharded close-run planning (reserveShardSpend and releaseShardSpend) honours the same shutdown cancellation: a hub stop during either wait exits within 3 s, and a shard reservation released late is still released durably, never left counted (test).

## Comments

### impl-1154 · 2026-10-25T19:16:18.854Z

Inspected inherited worktree: clean. A-11669 confirms droplet.ts #reserve and spend.ts locked still wait without shutdown cancellation. Planned tests use existing T2 scratch-files/public lock and projectHub fake-provider seams (no new process): held budget and primary/legacy ledger waits, late lock ownership, restart executor.status zero spend/slots. Consumer inventory before optional cancellation extension: acquireLockWithRetry production callers are DropletExecutor.#reserve and spend.locked (load, retireLegacySpend, reserveSpend, settleSpend, rememberProject, sweepProjects, reserveShardSpend, releaseShardSpend); direct tests executor-admission-lock.test.ts and territory-lock.test.ts. reserveSpend callers: DropletExecutor.#acquire, executor-spend.test.ts, T3 executor-safety.test.ts child script. Existing callers retain no-signal semantics; no wire/list/schema/refusal-class or persisted record change planned. Continuing full inventory of acquireLockAsync if cancellation must reach its guard.

### impl-1154 · 2026-10-25T19:16:55.507Z

Completed acquireLockAsync consumer search (whole repo, production/tests/docs): production territory.withTerritoryLockAsync, suite-lock stale/reaper and acquisition guards, spend.locked legacy migration, acquireLockWithRetry. Tests orphan-sweep-lock, territory-lock, executor-admission-lock, executor-spend and executor-lock-liveness. Documentation hub/README.md describes existing fail-fast territory contract; QA/skills/startup probes/persisted readers have no direct helper call. Optional AbortSignal is additive; omitted signal preserves every existing caller, lock format and error semantics. No wire-shape change; previous call-shape regressions remain in existing territory-lock/admission tests.
