---
id: T-1207
kind: task
title: Merge queue warns when a candidate touches files of an epic under demo
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:05.607Z
updated: 2026-10-24T06:46:05.607Z
---

## Summary

Landing a file an epic's demo covers makes the demo stale (demo freshness); the Coordinator held such merges by hand in v0.2. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. Enqueueing a candidate whose diff touches files merged by an epic with an active demo lease or unrecorded demo posts a warning naming the epic and files (test).
