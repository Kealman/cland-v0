---
id: T-1217
kind: task
title: Merge-queue candidates and verification snapshots accumulate unreachable Git objects until auto-gc gives up
state: open
status: planned
size: S
labels:
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: null
branch: null
created: 2026-10-24T09:05:03.711Z
updated: 2026-10-25T09:53:57.814Z
---

## Summary

On 2026-10-24 every Git command in the root and in task worktrees started printing "The last gc run reported … run 'git prune'" and "There are too many unreachable loose objects". The repository holds 10,546 loose objects (about 150 MB). The merge queue builds each batch candidate with `git commit-tree` and verification bundles snapshot trees, which leaves unreachable commits behind; the Coordinator's preflight checks add a few more. Auto-gc then refuses to run until .git/gc.log is removed. Nothing fails, but the warning reaches every session's output and the loose objects keep growing.

## Acceptance criteria

- [ ] C1. cland's own Git maintenance (for example after a landing, or on hub start when idle) prunes unreachable objects older than a safe age that no live batch, verification or lease can still reference, without touching objects a running batch uses (test with a scratch repository).
- [ ] C2. A stale gc.log no longer blocks auto-gc indefinitely; the hub reports the condition once in doctor output instead of in every Git command (test).
