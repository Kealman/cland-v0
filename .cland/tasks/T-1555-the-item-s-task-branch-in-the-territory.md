---
id: T-1555
kind: task
title: The item's task branch in the territory before its worktree
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1550
  - T-1553
topic: null
branch: null
created: 2026-10-31T23:47:43.466Z
updated: 2026-10-31T23:47:48.083Z
---

## Summary

An item launch creates its task branch `t/<id>-<slug>` in the territory from the territory's task base (`dev`), under the territory lock. The launch's Host then adds the worktree from that branch. On the `local` host the root branch, its tip and the worktree are the same as today.

Hot files: `hub/src/territory.ts`, `hub/src/hub/worktrees.ts`, `hub/src/host/local.ts` (worktreeAdd from a territory branch)

## Acceptance criteria

- [ ] C1. A first item launch creates `refs/heads/t/<id>-<slug>` in the territory at the task base's tip, under the territory lock, before the Host's worktreeAdd is called (test).
- [ ] C2. With a recording Host as the launch's host, the territory ref already exists when worktreeAdd is called (test).
- [ ] C3. On the `local` host the root's task branch, its tip and the worktree path are as today, and so is the `task-worktree` journal record (test).
- [ ] C4. A launch whose task branch already exists in the territory adds the worktree at the territory's tip (test).
- [ ] C5. A worktree add that fails after the territory ref was made leaves no territory branch behind (test).
- [ ] C6. The task-worktrees, task-worktrees-lifecycle, territory-cli and worktree-cli test files pass with no test edited.
