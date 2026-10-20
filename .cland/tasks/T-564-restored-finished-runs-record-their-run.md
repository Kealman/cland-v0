---
id: T-564
kind: task
title: Restored finished runs record their run time up to recovery, inflating runMs and queue ETAs
state: closed
status: done
size: XS
labels:
  - hub
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-16T02:56:19.121Z
updated: 2026-10-20T10:11:12.596Z
closed: 2026-10-20T10:11:12.596Z
---

## Summary
Found in T-562's source review (A-3624, 2026-10-16, low). When the hub restores a successful run at startup, it keeps the durable `finished` time. But `#recordTiming` in hub/src/hub/suites.ts falls back to the recovery time when the live status receipt is missing. The recorded runMs then includes the downtime, which inflates the queue's median/p90 and ETAs.

## Acceptance criteria
- [ ] C1. A run restored at startup records runMs from its durable start and finished times, never from the recovery time.
- [ ] C2. A test restores a finished run after a simulated restart delay and shows its recorded runMs equal to finished minus start.

## Comments

### coord · 2026-10-20T10:11:12.596Z

Closed as covered by T-618 (landed 0a9c89ea). A restored finished run now records runMs from its durable start and finished times, not from the recovery time (C1). A delayed-restart T1 regression proves runMs equals finished minus start (C2). The reviewer assessed this coverage at T-618's clear source verdict. Evidence: A-7269.
