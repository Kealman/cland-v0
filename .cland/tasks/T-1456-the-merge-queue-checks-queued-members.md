---
id: T-1456
kind: task
title: The merge queue checks queued members against each other at enqueue
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:57.388Z
updated: 2026-10-30T10:16:24.194Z
---

## Summary

At enqueue, the queue runs merge-tree against already queued heads, and a drop notice names the conflicting member instead of saying "rebase on dev". Source: coord 2026-10-24 (T-1018 vs T-542). Rule batch 4 C4 (A-14151).

## Acceptance criteria

- [ ] C1. Enqueueing a branch that conflicts with a queued member is refused at once, naming that member and the files.
