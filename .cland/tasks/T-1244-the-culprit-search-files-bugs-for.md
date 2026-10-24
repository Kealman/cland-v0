---
id: T-1244
kind: task
title: The culprit search files bugs for regressions dev has already fixed
state: open
status: backlog
size: S
labels:
  - bug
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T13:14:28.519Z
updated: 2026-10-24T13:14:28.519Z
---

## Summary

The periodic dev T3 culprit search for run 1de62ca6 (red at 23066929) filed four bugs, T-1240 to T-1243, at 13:14Z on 2026-10-24. All four regressions were already fixed on dev by then: T-1226, T-1227, T-1228 and a fix before 95662413, and green stage covers at 95662413 proved it. The search never checks whether the failing file passes at the current dev tip before it files. A day of active landings makes this the normal case, so the tracker fills with duplicates the Coordinator closes by hand.

## Acceptance criteria

- [ ] C1. Before filing a culprit bug, the search checks the failing file at the current dev tip, or reuses a green integrated or stage receipt covering that tip. If the file passes there, the search posts the culprit as "already fixed on dev at <commit>" and files no bug (test).
- [ ] C2. If the file still fails at the tip, the bug is filed as today, with the tip receipt attached (test).
