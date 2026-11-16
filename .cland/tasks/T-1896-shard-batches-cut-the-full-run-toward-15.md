---
id: T-1896
kind: task
title: Shard batches; cut the full run toward 15 min
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:46.101Z
updated: 2026-11-16T07:29:46.101Z
---

## Summary

`suites.ts:1006` excludes batches, soak and dev-t3 from sharding. A green batch takes 37 min median and a cover 38 min. Sharding costs about +2–3 min of setup per shard and little money (§4.5). impl #2.

Kind: product + config. Triage ticket H-8 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

cost: more droplets per run under the $14/day cap (human's cap). The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. A batch run shards across `verification.shards` machines and lands only when all shards are green (test).
- [ ] C2. An artifact gives the per-phase wall time and the 20 slowest files of five covers and five batches, and the shard count that reaches 15 min or less (evidence).
- [ ] C3. With that shard count, green covers and batches have a median of 20 min or less over one day (evidence).

## Dependencies

none; suites.ts
