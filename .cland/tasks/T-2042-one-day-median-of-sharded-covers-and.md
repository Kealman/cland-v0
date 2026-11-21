---
id: T-2042
kind: task
title: One-day median of sharded covers and batches at or under 20 min (split from T-1896 C3; after T-1896 lands and the hub restarts)
state: open
status: review
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by:
  - T-1896
topic: topic-1708
branch: t/T-2042-one-day-median-of-sharded-covers-and
created: 2026-11-20T20:54:26.471Z
updated: 2026-11-21T18:17:30.431Z
---

## Summary

The post-landing measurement for T-1896 (batch sharding), split from its C3 on 2026-11-20. One day of green covers and batches can only be measured after T-1896 lands and the hub restarts with it, so it can't be a pre-merge criterion.

Kind: measurement. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1896's original C3.

## Acceptance criteria

- [ ] C1. With T-1896's chosen shard count, green covers and batches have a median of 20 min or less over one day (evidence).

## Comments

### impl-2042 · 2026-11-21T18:11:46.001Z

Published A-22537: partial UTC day 2026-11-21 00:00–18:10:04Z, 12 green two-shard runs. Median 29.94266 min (4 covers 44.36187; 8 batches 27.34392). Held non-green d98b2a8d excluded; sensitivity including its 78.42220-min wall gives 30.09532 min. Includes every run, exact timing receipts, phase breakdown, excluded inventory and extraction scripts. C1 remains unmarked by Coordinator decision; target missed. No source change or verify run. Evidence-only review requested.

### rev-40 · 2026-11-21T18:17:30.431Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2042-evidence
commit: fa8071dd73106857cf8da05ef9a599f3e3b3eb4c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Measurement correctness only: clear, no findings. Independent pinned journal scan matches all 51 parent results, exact UUID/batch joins and exclusions (23 unsharded, 15 non-green, 1 cached). All 12 timestamp/queue deltas and all 13 retained phase/tree/browser projections match. Median 29.9426583333 min (4 covers 44.361875; 8 batches 27.3439166667), minimum 23.1867333333; no green run meets 20 min. Held non-green becd21cf/d98b2a8d is correctly excluded, 78.42220 min wall; sensitivity only 30.0953166667 min. Explicit partial UTC day 00:00–18:10:04.059680Z, Linux x64 droplet / Node24.21.0 / Nvim0.12.5, two c-8 ams3 machines; executed tiers and Chrome Headless Shell1248/CfT156.0.8078.4 qualified per run. No new tests or verify run. C1 intentionally remains unchecked/unverified with no criterion mark, as Coordinator38e156e9 directed; target miss and human disposition are not cleared. Full audit A-22544, input A-22537.
