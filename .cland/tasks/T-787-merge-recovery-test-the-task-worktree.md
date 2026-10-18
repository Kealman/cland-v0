---
id: T-787
kind: task
title: "merge-recovery test: the task worktree still exists after the retried rejected-push merge (Linux, line 325)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-503
topic: null
branch: t/T-787-merge-recovery-test-the-task-worktree
created: 2026-10-18T08:30:15.199Z
updated: 2026-10-18T08:59:31.609Z
---

## Summary

`hub/test/merge-recovery.test.ts`, "a rejected push with failed rollback remains landed and retry restores the root tree before publication completes", failed in integrated cover c232753a (A-5092) at dev a08e40ec on Linux. At line 325 `existsSync(work.path)` was still true after the final retry merge returned. T-503 fixed this exact race at line 50 (the retry reports success before deferred session cleanup removes the worktree) by waiting with `eventually`. This test's last assertion never got the same wait.

## Acceptance criteria

- [ ] C1. The final worktree assertion of the rejected-push test waits on an observed removal with the existing eventually helper, as T-503 did at line 50. Every other assertion stays, and the commit records the race.
- [ ] C2. No other `existsSync(work.path)` false assertion right after a merge retry in merge-recovery.test.ts is left without the wait.
