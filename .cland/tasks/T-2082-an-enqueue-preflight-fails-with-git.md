---
id: T-2082
kind: task
title: An enqueue preflight fails with "Git writer recovery required … another territory operation holds the lock" whenever it overlaps a merge-queue landing, instead of waiting for the lock
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T11:10:48.351Z
updated: 2026-11-24T11:10:48.351Z
---

## Summary

On 2026-11-24, two `cland merge T-n` enqueues failed during their preflight's Git reads, while the hub (pid 64841, #101) held the territory lock to land a batch:
- T-1914 at about 10:40Z: "merge-git: closed-item wording read failed: git show c01804e9…:site/src/content/docs/docs/quickstart.md".
- T-2018 at about 11:10Z: "merge-git: git show 45655614e…:hub/test/login-capacity.test.ts".

Both ended "Git writer recovery required: .cland/run/git-command-owners; recovery reservation: another territory operation holds the lock (pid 64841); territory writes fenced". A manual retry after the landing succeeded (T-1914 queued at position 5). The preflight's reads are read-only `git show`, but they go through the writer fence and refuse, rather than waiting for the landing's lock or using a read-only path.

## What to build

Make the enqueue preflight's read-only Git operations either wait, within a bound, for a concurrent territory operation to finish, or read without the writer recovery fence. Keep refusing for real writer-recovery states.

## Acceptance criteria

- [ ] C1. An enqueue whose preflight overlaps a landing holding the territory lock completes after the landing, within a bound, rather than failing (test with a fake held lock).
- [ ] C2. A genuine recovery-required state (an orphaned owner record) still refuses with its current message (test).
