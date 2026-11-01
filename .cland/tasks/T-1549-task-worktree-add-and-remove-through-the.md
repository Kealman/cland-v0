---
id: T-1549
kind: task
title: Task worktree add and remove through the Host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1543
topic: topic-1298
branch: t/T-1549-task-worktree-add-and-remove-through-the
created: 2026-10-31T23:47:42.044Z
updated: 2026-11-01T07:17:56.835Z
---

## Summary

`ensureTaskWorktree` and `removeTaskWorktree` keep their policy, lock and path checks in the territory module, but add and remove the worktree through a Host's worktreeAdd and worktreeRemove. Those operations also make the root `node_modules` link and the stale-install warning.

Hot files: `hub/src/territory.ts`, `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [ ] C1. `ensureTaskWorktree` and `removeTaskWorktree` take a Host, `local` by default, and call its worktreeAdd and worktreeRemove for the `git worktree add` and `remove` steps (test).
- [ ] C2. The `node_modules` link and the stale-install warning come from worktreeAdd, and `TaskWorktrees` no longer calls `symlink` itself.
- [ ] C3. With a recording Host, a claim, an item launch and a prune make one worktreeAdd per created worktree and one worktreeRemove per pruned one, each under the territory lock (test).
- [ ] C4. The task-worktrees, task-worktrees-lifecycle, worktree-cli and territory-lock test files pass with no test edited.

## Comments

### impl-1549 · 2026-11-01T07:11:45.223Z

Consumer inventory before optional internal Host plumbing: territory ensure/remove callers are TaskWorktrees (claim, item launch, prune, merged cleanup), hub/src/hub/worktrees.test.ts and hub/test/tracker-native-boundary.test.ts. TaskWorktrees consumers: dispatcher, task-worktrees.test.ts (legacy injected WorktreeGit fake), session-async-processes.test.ts, launch-admission.test.ts. Host worktreeAdd/remove consumers: local implementation and reusable host-contract.ts. Searches included field/function names across hub/nvim/web/shared, skills, docs and QA; no wire/persisted shape changes. Optional trailing Host parameter preserves callers; existing Host options must stay compatible. Rollback Git worktree creation/removal paths also require review; detached restoration cannot use current branch-only Host interface unchanged.

### impl-1549 · 2026-11-01T07:15:23.953Z

Coordinator decision applied: legacy injected WorktreeGit overrides now adapt into Host operations in hub/src/host/legacy-worktree-git.ts; TaskWorktrees has no install-helper call. Internal Host.worktreeAdd adds optional reuseOnly (install-only) and detached (rollback restoration); existing callers retain branch-only behavior and reusable previous-shape contract remains unedited. All native add/remove paths, including confinement/CAS recovery, use supplied Host under territory lock. Local red-first receipt: worktree-host.test.ts initially failed with warning undefined, missing node_modules, and ignored recording Host; now 3/3 pass. Native C4 files remain unedited.

### impl-1549 · 2026-11-01T07:16:23.024Z

Applied Coordinator decision: legacy injected WorktreeGit compatibility lives in host/legacy-worktree-git.ts; TaskWorktrees calls no install helper. Added optional reuseOnly/detached Host add options; existing branch-only Host contract unchanged. Unedited C4 local macOS runs passed: task-worktrees 19 tests, task-worktrees-lifecycle 3, worktree-cli 4, territory-lock 20. New recording Host tests passed 3/3; typecheck passed. test:lint is still running. No full suite run locally.

### impl-1549 · 2026-11-01T07:17:56.835Z

Coordinator quiet-machine decision 15292553 supersedes the earlier local test evidence: all loaded-run receipts are diagnostic only, not passing evidence. Heavy commands stopped; worktree-host run interrupted at file cleanup (3 assertions completed, file cancelled), test:lint interrupted (exit 130). Will rerun all required targeted checks and typecheck/test:lint sequentially only after Coordinator posts local runs resume. Source implementation is committed; criteria/review remain pending fresh receipts.
