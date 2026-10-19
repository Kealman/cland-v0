---
id: T-894
kind: task
title: The merge-batch report still says 'tiers T1, T3' when the batch runs T1 only
state: open
status: backlog
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T19:12:39.490Z
updated: 2026-10-19T19:12:39.490Z
---

## Summary

Since T-886 and restart #20, merge batches run T1 only (batch 1311a8f8 ran 475 T1 tests in 106 s). But the hub's batch report line still says "tiers T1, T3" ("batch 1311a8f8 …; tiers T1, T3; wall 137596 ms"). The label is derived from the old fixed tier list, not the batch's configured `batch_tiers`.

## Acceptance criteria

- [ ] C1. (T1) The batch report line names the tiers the batch actually planned from `[merge] batch_tiers`: "tiers T1" with ["T1"], and "tiers T1, T3" with the default.
