---
id: T-563
kind: task
title: A broken spend ledger can suppress a sharded close run's parent receipt after every shard has reported
state: open
status: backlog
size: S
labels:
  - hub
  - tech-debt
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-16T02:49:50.553Z
updated: 2026-10-16T02:49:50.553Z
---

## Summary
Found aside by impl-562 while fixing T-562 (2026-10-16). In hub/src/hub/suites.ts, `#collectShards` assembles the parent receipt of a sharded close run only after `releaseShardReservations` succeeds. If the shared spend ledger is broken, the parent report is suppressed even though every shard has reported and freed its scheduler reservation. T-562 fixes the same pattern for ordinary task runs: an accounting failure defers to the executor sweep instead of suppressing the terminal report. This item applies that to sharded runs.

## Acceptance criteria
- [ ] C1. A sharded close run whose shards have all reported posts its merged parent receipt even when spend settlement or reservation release fails; the failed accounting is retried by the executor sweep and logged.
- [ ] C2. A test runs a two-shard close with a failing spend ledger and shows the parent receipt posted, both reservations freed and the accounting retry recorded.
