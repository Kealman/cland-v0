---
id: T-790
kind: task
title: Integrated batch covers on dev shard across two droplets, like stage close runs
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: t/T-790-integrated-batch-covers-on-dev-shard
created: 2026-10-18T09:20:05.013Z
updated: 2026-10-18T09:20:18.603Z
---

## Summary

The Coordinator's ordinary integrated `cland verify all` on dev runs on one slot, about 25 min, and dev merges wait for it. Only `--occasion stage|epic|release` runs shard across `[verification] shards` droplets. Letting batch covers shard the same way roughly halves cover wall time (the hub machine shard is about 1250–1500 s of a 1500–1800 s run) and doubles merge throughput at nearly the same cost (human, General 2026-10-18 09:18Z: speed up the bottlenecks now).

## What to build

An integrated `verify all` on clean root dev, by the Coordinator, uses the same sharded path as close runs: largest-first balancing by durations.json, Neovim on the lightest shard, the whole group's cost reserved against the daily cap, and the same one-slot fallback with its warn notice. It stays an ordinary batch cover: no stage provenance and no change to stage, epic or release gates. Task runs keep one slot.

## Acceptance criteria

- [ ] C1. A T2 test shows a Coordinator `verify all` on clean dev reserving two remote slots and producing one merged result with per-shard machine, duration and cost, without stage provenance.
- [ ] C2. Fewer than two free slots or an insufficient cap runs it whole on one slot with the existing warn notice; a task head or a non-Coordinator request still uses one slot.
- [ ] C3. docs/agents/tests.md and the Coordinator clause say batch covers shard.
