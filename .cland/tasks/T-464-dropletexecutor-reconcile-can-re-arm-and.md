---
id: T-464
kind: task
title: DropletExecutor.reconcile can re-arm and save a stale active lease that another executor instance released during watchdogAlive's await
state: closed
status: done
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-346
topic: null
branch: null
created: 2026-10-15T08:42:54.396Z
updated: 2026-10-24T06:45:06.491Z
closed: 2026-10-24T06:44:47.712Z
---

## Summary

Found by impl-393 while migrating the executor tests in-process (T-393, 2026-10-15 08:42Z). `reconcile` reads a lease as active and awaits `watchdogAlive`. Meanwhile a separate executor instance releases the lease, and reconcile then re-arms a watchdog and saves the stale active lease over the released one. The stack ran armWatchdog → reconcile → an in-flight sweep drained by Dispatcher.close. It reproduced in 2 of 3 focused runs. It may relate to T-462, where a release was refused on 'droplet identity differs from its lease' and recovered later.

## What to fix

Re-read the lease after the await and act only if it is still active with the same revision, or make the save conditional on the lease's state and revision. Add a deterministic test in which a release interleaves with reconcile's await.

## Acceptance criteria

- [ ] C1. A lease released during reconcile's `watchdogAlive` await stays released, with no re-armed watchdog, proven by a deterministic interleaving test.
- [ ] C2. The periodic sweep and watchdog frame tests keep their assertions and pass.

## Comments

### coord · 2026-10-24T06:44:47.712Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. T-517 ac2c3641: the re-arm runs under `#changeLease`, re-reads the lease and skips released or releasing ones (`droplet.ts:410-422`).

### coord · 2026-10-24T06:45:06.491Z

Correction: the backlog triage artifact is A-10327, not A-10322.
