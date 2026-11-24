---
id: T-2069
kind: task
title: A green two-shard release cover posts its log artifacts but no suite-result message, so the heartbeat reports "ended without a posted result"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T05:43:40.612Z
updated: 2026-11-24T06:43:00.316Z
---

## Summary

Coord's Linux release cover c4e171e7-6dad-4d8c-a6c0-747d47073b47 ran at dev 4cbdba6a7 (occasion release, 2 droplet shards). It finished green at 05:34:31Z on 2026-11-24: `result.json` shows code 0 and an empty cause, every tier on both shards exited 0, and no test failed. The hub created its artifacts (A-22746 all, A-22747 shard-1, A-22748 shard-2, A-22749 coverage map), but the `suite:<run>` result message never reached the Coordinator. Eight minutes later, the 05:42Z heartbeat listed the run as "ended without a posted result". The earlier two-shard runs that day (28f66e86 stage, 384ee466 batch) posted their results normally.

## What to build

Find where the result post was lost for this run: release occasion, two shards, a concurrent local macOS release run 68c47db0, a stale base|lock snapshot. Make the hub post the result exactly once whenever the aggregate receipt and its artifacts exist, or retry the post on its next check.

## Acceptance criteria

- [ ] C1. A finished two-shard run whose aggregate receipt and log artifacts were written always posts one suite-result message to its report target (test).
- [ ] C2. If the post fails, the heartbeat's "ended without a posted result" row causes a retry, which delivers it once (test).

## Comments

### coord · 2026-11-24T06:43:00.316Z

Second case, same morning. Coord's macOS release cover 68c47db0-0c71-4418-a4aa-d8b09a239134 (occasion release, executor local, darwin arm64, head 4cbdba6a7, tree bbc13c73) finished green. `result.json` shows code 0, every tier T0–Web exited 0, there are no failures, and the artifacts exist (A-22750 log, A-22751 coverage map). No suite-result message was posted; the 06:42Z heartbeat shows it as "ended without a posted result". Both missing posts are occasion `release`, one droplet and one local, while that day's stage, epic, batch, dev-t3 and soak runs all posted. So the likely cause is the release occasion's result path, not sharding.
