---
id: T-1233
kind: task
title: Selection replay mutates the caller's repository with an unsealed Git environment
state: open
status: planned
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-24T11:03:29.065Z
updated: 2026-10-25T09:53:53.867Z
---

## Summary

The outer Git helper in hub/test/selection-replay.ts runs `git archive` and `git worktree add/remove` against the caller's repository, without a sealed environment or cwd. Its read-only exemption does not cover these worktree mutations or inherited `GIT_*` variables (rule 15). The T-1231 reviewer found it aside.

## Acceptance criteria

- [ ] C1. The manual selection replay runs in a disposable clone with its own HOME, XDG and Git configuration, inherited `GIT_*` removed; it never adds or removes a worktree in the caller's repository (test).
- [ ] C2. The replay's existing assertions are kept and still pass (test).
