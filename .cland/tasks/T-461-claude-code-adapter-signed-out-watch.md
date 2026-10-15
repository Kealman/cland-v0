---
id: T-461
kind: task
title: claude-code-adapter signed-out watch test sees one extra CLI call under load (3 against 2)
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T08:06:05.572Z
updated: 2026-10-15T08:06:05.572Z
---

## Summary

`hub/test/claude-code-adapter.test.ts:389` (the signed-out watch) counted 3 CLI calls where it expects 2, in T-455's gate 8052e04c (A-2746), 2026-10-15 07:58Z. The whole file passed 5/5 alone at a0ec44ea (A-2754). Under load, a schedule tick lands before the latch is observed. The test should count calls after the latch is in effect, or bound the count by the observed schedule.

## Acceptance criteria

- [ ] C1. The count is taken against the observed latch, not wall time, and the file passes 5/5 beside a local full run.
