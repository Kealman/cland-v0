---
id: T-1548
kind: task
title: Codex sandbox roots from the Host's realpath
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1546
topic: null
branch: null
created: 2026-10-31T23:47:41.861Z
updated: 2026-10-31T23:47:45.395Z
---

## Summary

`threadPolicy` and the worktree git-dir lookup compute every path handed to Codex through the session's Host: the writable roots, their `.git` directories, the cwd's own git directory, and the network allow-list's socket directories. On the `local` host the profile is byte-identical to today's.

Hot files: `hub/src/adapters/codex.ts`

## Acceptance criteria

- [ ] C1. `threadPolicy` takes the session's Host and resolves the writable roots, the cwd, the project's `.cland` directory and the temp directories through its realpath (test).
- [ ] C2. The `.git` directory checks use the Host's statDirectory, and a linked worktree's `.git` file is read through its readFile (test).
- [ ] C3. On the `local` host the thread policy and `-c` overrides are byte-identical to today's for a writable root, a linked worktree inside it, a symlinked root and `network = local` (test).
- [ ] C4. A test with a Host whose realpath maps paths into another tree shows every sandbox path taken from that Host (test).
- [ ] C5. `codex.ts` no longer imports `realpath` or `stat`.
