---
id: T-2042
kind: task
title: One-day median of sharded covers and batches at or under 20 min (split from T-1896 C3; after T-1896 lands and the hub restarts)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by:
  - T-1896
topic: null
branch: null
created: 2026-11-20T20:54:26.471Z
updated: 2026-11-20T20:54:28.309Z
---

## Summary

The post-landing measurement for T-1896 (batch sharding), split from its C3 on 2026-11-20. One day of green covers and batches can only be measured after T-1896 lands and the hub restarts with it, so it can't be a pre-merge criterion.

Kind: measurement. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1896's original C3.

## Acceptance criteria

- [ ] C1. With T-1896's chosen shard count, green covers and batches have a median of 20 min or less over one day (evidence).
