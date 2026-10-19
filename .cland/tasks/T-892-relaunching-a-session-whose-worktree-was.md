---
id: T-892
kind: task
title: Relaunching a session whose worktree was removed reports 'spawn codex ENOENT'
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T19:08:57.886Z
updated: 2026-10-19T19:08:57.886Z
---

## Summary

After T-882 landed at 19:02:41Z (2026-10-19), impl-882 was released and its worktree .cland/worktrees/T-882 was removed. `cland session resume impl-882 --relaunch` then failed with "codex --version: spawn codex ENOENT". The adapter's version probe runs execFile(codex, --version) with the session's recorded cwd, and Node reports a missing cwd as ENOENT on the binary. That sent the Coordinator after a PATH problem that wasn't there (the stand-in diagnosed it from the serving pid).

## Acceptance criteria

- [ ] C1. (T1) The harness version probe checks the cwd first and reports "session cwd <path> no longer exists" instead of a spawn ENOENT, and resume --relaunch of a session whose recorded worktree is gone refuses with that reason and suggests a fresh launch for its open item, if any.
