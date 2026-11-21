---
id: T-2049
kind: task
title: A QA verdict's task.comment reply counts its own fresh criterion marks as stale while the item read and demo freshness say current
state: open
status: backlog
size: S
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-21T07:44:31.768Z
updated: 2026-11-21T07:44:31.768Z
---

## Summary

On 2026-11-21, qa-1880 recorded four evidence-only epic DoD verdicts (E-1882, E-1884, E-1885, E-1886) with `task.comment`, at commit 792d643d8. Dev was ahead by tracker and qa/briefs commits only. Each reply's `criteriaCounts` said `verified: 0, stale: 2` for the C1 and C2 marks just written. At the same time, `cland demo status <epic> --commit 792d643d8 --json` said `freshness.current: true`. Seconds later, coord's `task.close` readback of the same epics showed `verified: 2, stale: 0` with `current: true` on each mark, and all four closed. So the verdict-write reply judges mark freshness differently from the item read and from the demo freshness rule, and QA is told its marks are stale when they aren't.

## What to build

Make the reply to a verdict or criterion write compute mark freshness by the same rule as `task.view` and demo freshness. A dev move that touches only `.cland/tasks/` and `qa/briefs/` doesn't stale an epic's marks.

## Acceptance criteria

- [ ] C1. A QA verdict written at a commit behind dev by tracker- and brief-only commits returns `criteriaCounts` with its marks verified and not stale, matching `task.view` (test, red before).
- [ ] C2. A later commit that touches a file changed by the epic's task merges still makes the marks stale in both the reply and `task.view` (test).

Evidence: E-1882's comments and A-22380 to A-22383; qa-1880's aside in topic-1544 (2026-11-21 07:44Z). Found by QA.
