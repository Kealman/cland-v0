---
id: T-1454
kind: task
title: Merge batches and task verifies widen test selection for sibling-merge interactions
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1456
  - T-1476
topic: null
branch: null
created: 2026-10-30T05:44:57.061Z
updated: 2026-10-30T10:18:29.707Z
---

## Summary

Merge batches add the T2 and Web files that import modules another landing changed since a member's verified head; task verifies add the test files of landings merged into the head, plus mapped guards (roles.test.ts for clause edits, area-slots for web areas). Sources: T-1432 (T-1403 × T-1406), T-1136 × T-1111, T-1348 × T-1347, T-945, T-1140. Rule batch 4 C2 (A-14151).

## Acceptance criteria

- [ ] C1. A batch whose members change an imported module of another member's tests runs those tests, shown by a fixture with two interacting branches.
