---
id: T-78
kind: task
title: Merge, worktree and release checks still read items through the tracker's synchronous view
state: open
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-37
branch: t/T-78-merge-worktree-and-release-checks-still
created: 2026-10-09T18:46:27.376Z
updated: 2026-10-09T20:54:04.528Z
---

## Parent

Part of T-19. Found by impl-77 on 2026-10-09 at 18:46Z while working on T-77. T-77 makes tracker mutations, launch, `task.view` and serving-time watcher reads asynchronous. These read-only checks were left out by the Coordinator's decision, because converting them changes the territory module's check-callback contracts.

## What happened

The merge gate, worktree handling and release paths read item files through the tracker's synchronous view while the hub serves. They are rare operations, but each read blocks the event loop for every connected session (A-96, class A).

## What to build

- Move these checks to the tracker's async view (`viewAsync`, from T-77). Change the territory module's check callbacks to async without altering their ordering under the territory lock. That covers the merge gate's verdict reads, worktree claim and cleanup, and the release notes.
- Extend the native-boundary guard to the merge, release and worktree request paths.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from the merge, release or worktree request paths, which the guard proves.
- [ ] The merge gate's refusals and recoveries (T-59, T-74) behave unchanged, which their existing tests prove.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S to M. Start after T-77 merges, because it builds on `viewAsync`.

## Comments

### impl-78 · 2026-10-09T20:47:04.193Z

Beginning async territory check conversion on dev base 72daf36. Will preserve checks within territory lock, document post-await re-reads, extend native boundary request coverage with planted statSync probes, and retain merge recovery assertions.

### impl-78 · 2026-10-09T20:54:04.528Z

Async worktree and merge requests pass the native boundary guard. Added real-request merge refusal/landing/retry and release preview/publication/sync coverage; planted statSync on worktree, merge and release request paths is rejected. Deferred filesystem probes prove a pending not-clear verdict is seen before merge decision, and a .cland/worktrees parent swapped to a symlink is refused before creation (no outside files or task branch). Existing hub worktree tests pass unchanged; existing merge/recovery tests running.
