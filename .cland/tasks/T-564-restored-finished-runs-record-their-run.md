---
id: T-564
kind: task
title: Restored finished runs record their run time up to recovery, inflating runMs and queue ETAs
state: open
status: backlog
size: XS
labels:
  - hub
  - tech-debt
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-16T02:56:19.121Z
updated: 2026-10-16T02:56:19.121Z
---

## Summary
Found in T-562's source review (A-3624, 2026-10-16, low). When the hub restores a successful run at startup, it keeps the durable `finished` time. But `#recordTiming` in hub/src/hub/suites.ts falls back to the recovery time when the live status receipt is missing. The recorded runMs then includes the downtime, which inflates the queue's median/p90 and ETAs.

## Acceptance criteria
- [ ] C1. A run restored at startup records runMs from its durable start and finished times, never from the recovery time.
- [ ] C2. A test restores a finished run after a simulated restart delay and shows its recorded runMs equal to finished minus start.
