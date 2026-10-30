---
id: T-1459
kind: task
title: Turn Git auto-maintenance off in the repository configuration
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:57.843Z
updated: 2026-10-30T05:44:57.843Z
---

## Summary

Set `gc.auto=0` and `maintenance.auto=false` in the live repo and territory config instead of per-command `--no-auto-maintenance` or `-c gc.auto=0`. Sources: T-1211, T-1030, T-1217. Rule batch 4 C7 (A-14151).

## Acceptance criteria

- [ ] C1. cland init/update writes both keys, doctor reports them, and a plain `git fetch` in a worktree starts no maintenance.
