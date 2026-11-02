---
id: T-1593
kind: task
title: The host agent's file, command and worktree operations
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1588
topic: null
branch: null
created: 2026-11-02T03:33:53.695Z
updated: 2026-11-02T03:33:53.695Z
---

## Summary

The agent answers the Host's file and command operations on its host. These are run (a short command with output and a timeout), statDirectory with device and inode, realpath, fileType, readFile (bounded size), listFolder, writeFile with a mode, makeDirectory, removePath, freePort on loopback, occupants, and worktreeAdd and worktreeRemove in a given root with the root `node_modules` link.

Hot files: `hub/src/host/agent/` (`files.ts`, `worktrees.ts`, the op table), `hub/test/host-agent-files.test.ts` (new)

## Acceptance criteria

- [ ] C1. run returns exit code, stdout and stderr and kills the command at its timeout, and statDirectory, realpath, fileType, readFile and listFolder give the same answers as the `local` host for the same fixtures (test).
- [ ] C2. readFile refuses a directory, a missing path and a file over the size cap, and transfers exact bytes (test).
- [ ] C3. writeFile, makeDirectory and removePath act only on the given path with the given mode, and removePath never follows a symlink out of it (test).
- [ ] C4. In a scratch repository worktreeAdd adds a worktree on the given branch with the root `node_modules` link and today's stale-install warning, and worktreeRemove removes it and refuses one with changes (test).
- [ ] C5. occupants answers by real paths, including through a symlinked alias, as the `local` host does (test).

## Notes

Shared files: the agent protocol module (ops)
