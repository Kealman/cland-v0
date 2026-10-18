---
id: T-790
kind: task
title: Integrated batch covers on dev shard across two droplets, like stage close runs
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-499
branch: t/T-790-integrated-batch-covers-on-dev-shard
created: 2026-10-18T09:20:05.013Z
updated: 2026-10-18T09:25:34.793Z
---

## Summary

The Coordinator's ordinary integrated `cland verify all` on dev runs on one slot, about 25 min, and dev merges wait for it. Only `--occasion stage|epic|release` runs shard across `[verification] shards` droplets. Letting batch covers shard the same way roughly halves cover wall time (the hub machine shard is about 1250–1500 s of a 1500–1800 s run) and doubles merge throughput at nearly the same cost (human, General 2026-10-18 09:18Z: speed up the bottlenecks now).

## What to build

An integrated `verify all` on clean root dev, by the Coordinator, uses the same sharded path as close runs: largest-first balancing by durations.json, Neovim on the lightest shard, the whole group's cost reserved against the daily cap, and the same one-slot fallback with its warn notice. It stays an ordinary batch cover: no stage provenance and no change to stage, epic or release gates. Task runs keep one slot.

## Acceptance criteria

- [x] C1. A T2 test shows a Coordinator `verify all` on clean dev reserving two remote slots and producing one merged result with per-shard machine, duration and cost, without stage provenance.
  - done: impl-790 · 2026-10-18T09:24:19.865Z
- [x] C2. Fewer than two free slots or an insufficient cap runs it whole on one slot with the existing warn notice; a task head or a non-Coordinator request still uses one slot.
  - done: impl-790 · 2026-10-18T09:24:26.463Z
- [x] C3. docs/agents/tests.md and the Coordinator clause say batch covers shard.
  - done: impl-790 · 2026-10-18T09:24:30.850Z
  - verified: rev-30 [reviewer] · run rev-20261018-790-source · 2026-10-18T09:25:34.793Z · commit 723de8d2d6febe0237aa87961e2dee165d584844

## Comments

### impl-790 · 2026-10-18T09:24:33.787Z

Implemented at 723de8d2. Reuses close-run shard planning for clean Coordinator root dev batch requests with fresh origin/dev proof; keeps occasion unset and existing provenance gates. Targeted T2/T1 regressions and existing remote contract file pass, along with lint and typecheck. Evidence posted in item topic.

### rev-30 · 2026-10-18T09:25:34.793Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-790-source
commit: 723de8d2d6febe0237aa87961e2dee165d584844
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5115. Clean fetched root-dev Coordinator all requests reuse existing shard planner/accounting/fallback/collector; task and non-Coordinator isolation remains enforced by dispatcher integration identity plus branch/root guards. Unset occasion omitted from merged log, no stage provenance fabricated; gates unchanged. T2 batch reservation/merged-result, cap/slot fallback and single-slot controls reviewed; real batch/cache expectations intentionally updated. C3 docs/clause verified. C1/C2 await exact-head droplet evidence; A-5112 reported red/green/static checks retained. No reviewer execution or throughput claim.

Criteria: C3 verified.
