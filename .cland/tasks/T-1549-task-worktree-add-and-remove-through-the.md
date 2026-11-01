---
id: T-1549
kind: task
title: Task worktree add and remove through the Host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1543
topic: null
branch: null
created: 2026-10-31T23:47:42.044Z
updated: 2026-11-01T07:09:54.700Z
---

## Summary

`ensureTaskWorktree` and `removeTaskWorktree` keep their policy, lock and path checks in the territory module, but add and remove the worktree through a Host's worktreeAdd and worktreeRemove. Those operations also make the root `node_modules` link and the stale-install warning.

Hot files: `hub/src/territory.ts`, `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [ ] C1. `ensureTaskWorktree` and `removeTaskWorktree` take a Host, `local` by default, and call its worktreeAdd and worktreeRemove for the `git worktree add` and `remove` steps (test).
- [ ] C2. The `node_modules` link and the stale-install warning come from worktreeAdd, and `TaskWorktrees` no longer calls `symlink` itself.
- [ ] C3. With a recording Host, a claim, an item launch and a prune make one worktreeAdd per created worktree and one worktreeRemove per pruned one, each under the territory lock (test).
- [ ] C4. The task-worktrees, task-worktrees-lifecycle, worktree-cli and territory-lock test files pass with no test edited.
