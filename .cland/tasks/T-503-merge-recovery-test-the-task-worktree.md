---
id: T-503
kind: task
title: "merge-recovery test: the task worktree still exists right after a retried merge reports closed (Linux)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-310
branch: t/T-503-merge-recovery-test-the-task-worktree
created: 2026-10-15T15:03:40.855Z
updated: 2026-10-15T16:47:14.538Z
---

## Problem

`hub/test/merge-recovery.test.ts:49`, 'a close write failure reports merged follow-up failure; retry closes and prunes without a second commit', failed on Linux in T-467's droplet verify 3fb93e0b (A-3087). `existsSync(work.path)` was still true after the retry merge reported a successful close: either the worktree prune finishes after the CLI returns, or a process still holding the worktree delays its removal. It's T-395's split file; the assertion is unchanged from the old merge.test.ts.

## Acceptance criteria

- [ ] C1. Either the merge retry removes the worktree before it reports success, as a product fix with the reason recorded, or the test waits on an observed removal with the existing eventually helper. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. merge-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
