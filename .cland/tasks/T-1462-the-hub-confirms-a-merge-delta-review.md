---
id: T-1462
kind: task
title: The hub confirms a merge-delta review when the dev merge is conflict-free and disjoint
state: open
status: in progress
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1456
topic: topic-1242
branch: t/T-1462-the-hub-confirms-a-merge-delta-review
created: 2026-10-30T05:44:58.381Z
updated: 2026-10-30T12:38:18.892Z
---

## Summary

v0.3.0 had 64 merge-delta re-reviews on 41 tasks, caused only by dev moving under the branch (retro A-14149). When merge-tree is conflict-free and the branch's files are disjoint from the dev movement, the hub records the delta as confirmed; a Reviewer reviews only overlapping files. Retro v0.3.0 change 2.

## Acceptance criteria

- [ ] C1. A conflict-free dev merge produces a durable hub-recorded delta assessment (disjoint or overlapping, with rename endpoints, deletions and the dependency rule it applied), shown on the item; in this rollout the assessment is report-only and the Reviewer's merge-delta verdict is still required (rule 27).
