---
id: T-864
kind: task
title: Hub start dropped all six merge queue entries as 'branch head changed or deleted' although no head had changed
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-577
branch: t/T-864-hub-start-dropped-all-six-merge-queue
created: 2026-10-19T10:23:43.638Z
updated: 2026-10-19T10:24:17.352Z
---

## Summary

At hub start (restart #18, 2026-10-19 10:19:21Z, first new hub pid 2351) the merge queue dropped all six entries with "branch head changed or deleted": T-665 bbfaafe8, T-833 1e595402, T-836 77a5c646, T-837 6c3d7ad8, T-848 4f6c6775, T-853 6ccfc55a. None of those heads had changed; the Coordinator confirmed each on origin afterwards and re-enqueued them.

## Problem

`MergeQueue.reconcile` (hub/src/hub/merge-queue.ts ~37–49) runs with `refreshed = true` when `branchTips` returned a map. It then treats a branch missing from that map (`tips.get(entry.branch) ?? null`) as deleted. The drop fired about 7 s into a tracker-storage stall during the startup ready check. So an incomplete or empty tip read is likely the cause: a map that lacks branches still counts as an authoritative refresh.

## Acceptance criteria

- [ ] C1. A refresh whose tip read is incomplete or fails drops no entry. An entry is dropped as deleted only when an authoritative read shows its branch absent, and as changed only when the read names a different head. A component test feeds the queue a partial or failed tip read at startup and keeps every entry.
- [ ] C2. A real deletion and a real head change still drop their entry with the same reasons (existing tests stay green).
