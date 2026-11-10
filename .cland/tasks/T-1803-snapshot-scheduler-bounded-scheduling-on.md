---
id: T-1803
kind: task
title: "Snapshot scheduler: bounded scheduling on login changes and no snapshot of a pending binding"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
regression_of: T-1781
found_by: review
topic: null
branch: null
created: 2026-11-10T10:12:35.258Z
updated: 2026-11-10T10:12:54.573Z
---

## Summary

Two gaps in T-1781's snapshot scheduler, closed together once T-1778's binding phase is on dev. `LoginSnapshots.schedule()` calls `logins.list()` on every `LoginRecords.onChange`, so each login save (including T-1778's pending and settled binding writes on the launch path) decodes all retained logins: an unbounded hot path under rule 23. And the scheduler doesn't yet refuse to snapshot a login whose binding is `pending` (T-1778's fence), which T-1781 deferred until T-1778 landed.

## Context

- **Source path.** `logins.save` → listener → `schedule` → `logins.list` (login-snapshots.ts, about lines 176–192). Found by impl-1778 in the T-1778 integration review, 2026-11-10; no runtime failure claimed.
- **Coordinator decision.** The pending refusal moved out of T-1781 to this item (answer dc7b29a3).

## Acceptance criteria

- [ ] C1. A login change schedules work for that login only. With a synthetic corpus of 10,000 retained logins, one save decodes at most a bounded number of rows, shown by decode-count and query-work controls (test).
- [ ] C2. A login whose binding phase is `pending` is never frozen or snapshotted. The scheduler records a deferred reason, and an absent phase reads as settled (test).
- [ ] C3. Existing snapshot, rate-retry, release-fence and recovery tests pass unchanged (test).
