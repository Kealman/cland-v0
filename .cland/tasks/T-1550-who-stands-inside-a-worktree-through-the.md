---
id: T-1550
kind: task
title: Who stands inside a worktree, through the Host
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1549
topic: topic-1303
branch: t/T-1550-who-stands-inside-a-worktree-through-the
created: 2026-10-31T23:47:42.340Z
updated: 2026-11-01T15:27:38.382Z
---

## Summary

`cland worktree list` and prune decide which sessions stand inside a worktree through the Host's occupants operation, including the last check before Git removes it. Worktree identity checks before removal also go through the Host.

Hot files: `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [ ] C1. The list's sessions, prune's refusals and the last check before removal come from the Host's occupants (test).
- [ ] C2. `TaskWorktrees` no longer calls `realpath` or `stat` on session cwds or worktree paths itself: identities come from the Host's statDirectory.
- [ ] C3. With a recording Host that reports a session inside, a prune is refused even when the session's recorded cwd string differs from the worktree path (test).
- [ ] C4. The task-worktrees and worktree-cli test files pass with no test edited.

## Comments

### impl-1550 · 2026-11-01T14:45:37.172Z

Consumer inventory: TaskWorktrees #observe (list, prunable, prune admission and final pre-Git validator) owns containment/identity checks; production construction in hub/start.ts, fake WorktreeGit callers in hub/src/hub/worktrees.test.ts and hub/test/task-worktrees.test.ts, native callers in worktree-host/task-worktrees-lifecycle/worktree-cli/territory-lock tests. Host occupants/realpath/statDirectory signatures and WorktreeEntry wire shape remain unchanged; downstream CLI/web/nvim, fixtures and persisted readers require no migration. Implementing at the supplied recording Host seam.

### impl-1550 · 2026-11-01T14:46:17.603Z

Inventory correction after repository search: production construction is hub/src/hub/dispatch.ts (default local Host), not hub/start.ts. Searches covered occupants/resolvedOccupants/realWorktreePath/statDirectory/new TaskWorktrees/WorktreeEntry/worktree.list/worktree.prune across source, tests, wire, skills and QA docs. Host contract tests and session-host tests use the existing signatures; no contract or serialized field changes.

### impl-1550 · 2026-11-01T15:27:38.382Z

Red/green progress on uncommitted tree, macOS local Node v24.21.0, no browser: alias-only occupant regression failed [] vs ['remote-worker']; occupancy migration then passed worktree-host 11/11. Expanded file passed locked admission and last pre-Git occupancy controls; both Host directory identity controls failed removed=1 vs expected 0 before statDirectory migration. Identity migration and existing-section docs now written. Latest full file rerun did not execute assertions: cover-quiet 5d0045cd-7415-4cd2-a55e-cb8734274174. Await registered wake-up. No preservation file/typecheck/lint/verify evidence yet; no review requested.
