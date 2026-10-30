---
id: T-1457
kind: task
title: test:tiers refuses a duration allowance owned by a task-kind item
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1233
branch: t/T-1457-test-tiers-refuses-a-duration-allowance
created: 2026-10-30T05:44:57.517Z
updated: 2026-10-30T10:19:10.203Z
---

## Summary

A duration allowance owned by a task closes with it and strands the allowance; `test:tiers` should refuse a task-kind owner and name the key. Not yet implemented (315af806 only re-owned entries). Sources: T-707, T-761. Rule batch 4 C5 (A-14151).

## Acceptance criteria

- [ ] C1. An allowance whose owner is a task is refused by test:tiers with its identity and owner.
