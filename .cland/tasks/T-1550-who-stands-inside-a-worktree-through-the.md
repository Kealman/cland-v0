---
id: T-1550
kind: task
title: Who stands inside a worktree, through the Host
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1549
topic: null
branch: null
created: 2026-10-31T23:47:42.340Z
updated: 2026-11-01T07:09:54.838Z
---

## Summary

`cland worktree list` and prune decide which sessions stand inside a worktree through the Host's occupants operation, including the last check before Git removes it. Worktree identity checks before removal also go through the Host.

Hot files: `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [ ] C1. The list's sessions, prune's refusals and the last check before removal come from the Host's occupants (test).
- [ ] C2. `TaskWorktrees` no longer calls `realpath` or `stat` on session cwds or worktree paths itself: identities come from the Host's statDirectory.
- [ ] C3. With a recording Host that reports a session inside, a prune is refused even when the session's recorded cwd string differs from the worktree path (test).
- [ ] C4. The task-worktrees and worktree-cli test files pass with no test edited.
