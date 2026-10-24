---
id: T-1207
kind: task
title: Merge queue warns when a candidate touches files of an epic under demo
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-967
branch: t/T-1207-merge-queue-warns-when-a-candidate
created: 2026-10-24T06:46:05.607Z
updated: 2026-10-24T11:51:14.611Z
---

## Summary

Landing a file an epic's demo covers makes the demo stale (demo freshness); the Coordinator held such merges by hand in v0.2. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. Enqueueing a candidate whose diff touches files merged by an epic with an active demo lease or unrecorded demo posts a warning naming the epic and files (test).

## Comments

### impl-1207 · 2026-10-24T11:51:14.611Z

Implementation inspection: queue admission is in TaskMerges.merge, with existing lane predecessor holds using epicMergeFiles. Proposed T2 seam is sealed projectHub public merge/topic.history frames with injected Git history; seam and unrecorded-demo scope questions sent to supervising lead before tests. No source changes yet.
