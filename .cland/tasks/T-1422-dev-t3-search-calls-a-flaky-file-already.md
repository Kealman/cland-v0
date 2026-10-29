---
id: T-1422
kind: task
title: Dev T3 search calls a flaky file already-fixed on a green tip reached only through tracker commits
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T10:16:48.937Z
updated: 2026-10-29T15:59:35.714Z
---

## Summary

The periodic dev T3 culprit search marks a failing file "already-fixed" on one green rerun at the dev tip, even when every commit between the red head and the tip is tracker-only. On 2026-10-28 search a396c52c (A-13191) reported web/test/items.test.ts "already fixed on dev at a7e17ddc". a7e17ddc only changes .cland/tasks, and the failure is T-1419's load flake (red twice at 95e764b1, green at 0988520d and a7e17ddc, 29–56 s each run).

## Acceptance criteria

- [ ] C1. The search reports "already-fixed" only when a commit after the red head changes a non-tracker file; a green tip reached only through tracker-only commits is reported as an unconfirmed flake that names the red and green runs.

## Notes

Evidence: A-13191, A-13192 (red rerun at 95e764b1), A-13198 (green at 0988520d), A-13199 (green at a7e17ddc). Related: T-1419.
