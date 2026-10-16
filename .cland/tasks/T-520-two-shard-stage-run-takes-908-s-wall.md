---
id: T-520
kind: task
title: Two-shard stage run takes 908 s wall against T-395's 600 s target
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-578
blocked_by:
  - T-519
regression_of: T-395
topic: topic-377
branch: t/T-520-two-shard-stage-run-takes-908-s-wall
created: 2026-10-15T18:12:19.748Z
updated: 2026-10-16T15:51:27.983Z
---

## Summary

E-387's first real two-shard stage run, 1bebcda2 at 9bc15ce8, took 907.85 s overall from admission through collection. T-395's C6 target is 600 s or less. The hub machine phase on shard-2 took 571.57 s, while shard-1 took 892.95 s in total, so the shards are unbalanced and the overhead outside the tests (create, bundle, typecheck, collect) is large. This ticket finds where the 908 s goes and closes the gap.

## Acceptance criteria

- [ ] C1. A breakdown per shard, from run 1bebcda2's logs and lease receipts, of droplet create, bundle transfer, install or snapshot, typecheck, the hub phase, the Neovim phase and collection, posted on the item.
- [ ] C2. Changes taken from that breakdown, such as shard balancing by recorded durations, parallel create, or skipping the remote typecheck when the host gate passed. A repeat `--occasion stage` run lands at 600 s or less wall, or the item records why 600 s isn't reachable and the human sets a new target.

## Comments

### impl-520 · 2026-10-16T15:51:27.983Z

Before editing, replayed A-3230: 907.85s wall against 600s (307.85s over), hub machine 781.41s/571.57s; Neovim was assigned to shard-2 and never reached because its hub phase failed. Current durations source A-3877/f6045f83 produces hub estimates 2436.975652/2436.975487 test-seconds, then appends 406.734554 Neovim test-seconds, leaving combined estimates 2436.975652/2843.710041. Coordinator confirmed the balanceCloseShards public plan seam and post-merge Coordinator-owned --occasion stage comparison (decisions 8af4e401, 1aab3506). Added regression first: two equal 20-second hub partitions plus 20-second indivisible Neovim incorrectly planned [40,20] rather than [30,30].
