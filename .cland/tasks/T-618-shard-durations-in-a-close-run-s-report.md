---
id: T-618
kind: task
title: Shard durations in a close run's report use different completion boundaries per shard
state: open
status: in progress
size: S
labels:
  - needs-triage
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-711
branch: t/T-618-shard-durations-in-a-close-run-s-report
created: 2026-10-16T15:53:52.122Z
updated: 2026-10-20T09:42:32.160Z
---

## Summary

Found by impl-520 during T-520's C1 breakdown (A-3935). In close run 1bebcda2, shard-1's completedAt is the remote finish (18:09:10Z, 892.947 s), and shard-2's is the host collection (18:05:44.785Z, 687.732 s). Both are printed as `shard duration`, so about 13.8 s of collection is counted for shard-2 only, and per-shard comparisons are ambiguous.

## Acceptance criteria

- [ ] C1. Every shard's reported duration uses the same boundary (remote finish), with collection reported as its own line per shard, proved by a test on a fake two-shard run.
- [ ] C2. The merged report's overall wall still spans admission through collection, and the docs name each boundary.

## Comments

### impl-618 · 2026-10-20T09:42:32.160Z

A-7125 triage confirmed both T-618 and T-564 are live at the same timing line. Working on durable finish-based execution timing plus separately labelled per-shard collection and admission-through-collection parent wall. Regression seams: Suites public status/queue after simulated restart (T1) and fake two-shard merged report (T2), as required by the items.
