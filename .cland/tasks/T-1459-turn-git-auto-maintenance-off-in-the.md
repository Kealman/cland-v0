---
id: T-1459
kind: task
title: Turn Git auto-maintenance off in the repository configuration
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1228
branch: t/T-1459-turn-git-auto-maintenance-off-in-the
created: 2026-10-30T05:44:57.843Z
updated: 2026-10-30T10:21:27.507Z
---

## Summary

Set `gc.auto=0` and `maintenance.auto=false` in the live repo and territory config instead of per-command `--no-auto-maintenance` or `-c gc.auto=0`. Sources: T-1211, T-1030, T-1217. Rule batch 4 C7 (A-14151).

## Acceptance criteria

- [x] C1. cland init/update writes both keys, doctor reports them, and a plain `git fetch` in a worktree starts no maintenance.
  - done: impl-1459 · 2026-10-30T10:21:00.907Z

## Comments

### impl-1459 · 2026-10-30T10:18:09.773Z

Consumer inventory (Rule 20): searched git-maintenance, gc.auto, maintenance.auto and checkGitMaintenance across production, all test tiers, docs and shipped skills. Shared writer consumers: background maintainProjectGit and init/provision (new). Doctor check consumed by doctor/checks.ts and git-maintenance tests; Check wire shape remains unchanged. Existing startup/CLI/recovery tests consume maintenance receipts, unchanged. Native territory/worktree Git inherits common local config. Docs: hub README Git object maintenance, docs/agents/git-maintenance.md, CLI INIT_USAGE/DOCTOR_USAGE and implement skill. No snapshot, frame, persisted receipt or permission contract changes.
