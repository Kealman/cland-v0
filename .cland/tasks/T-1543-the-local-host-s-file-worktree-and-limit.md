---
id: T-1543
kind: task
title: The local host's file, worktree and limit operations
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1542
topic: null
branch: null
created: 2026-10-31T23:47:40.588Z
updated: 2026-10-31T23:48:13.260Z
---

## Summary

Add the file operations to the Host: stat of a working directory with its identity, realpath, read a file's bytes and list a folder's files by path, `git worktree add` and `remove` with the root `node_modules` symlink, who stands inside a worktree, and the limit-poll operation. The `local` host implements each with today's code, the contract suite covers every member, and the account poller asks the local Host before an idle poll.

Hot files: `hub/src/host/host.ts`, `hub/src/host/local.ts`, `hub/test/host-contract.ts`, `hub/test/host-local-contract.test.ts`, `hub/src/accounts/poller.ts`

## Acceptance criteria

- [ ] C1. The `Host` interface gains statDirectory, realpath, readFile, listFolder, worktreeAdd, worktreeRemove, occupants and limitPolls, and the `local` host implements each.
- [ ] C2. statDirectory gives `sessionCwdRefusal`'s refusals for a missing path and for a file, and for a directory gives no refusal plus its device and inode (test).
- [ ] C3. realpath resolves a symlinked directory to its target and returns a missing path unchanged, as Codex's `real` helper does today (test).
- [ ] C4. readFile returns a file's exact bytes and refuses a directory or a missing path, and listFolder lists a folder's regular files as `folderFiles` does (test).
- [ ] C5. In a scratch repository worktreeAdd adds a worktree on the given branch, links the root `node_modules` into it when the root has one, and returns today's stale-install warning; worktreeRemove removes it and refuses a worktree with changes (test).
- [ ] C6. occupants returns the sessions whose real cwd is the worktree or lies under it, including through a symlinked alias, and none for a sibling path that shares the prefix (test).
- [ ] C7. limitPolls on the `local` host allows idle polls, the account poller checks it before each idle poll, and `account-poller.test.ts` and `account-poller-clock.test.ts` pass with no test edited.
- [ ] C8. A T1 test fails when a member of the `Host` interface has no case in the contract suite (test).
