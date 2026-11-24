---
id: T-2086
kind: task
title: evidence-publish.test.ts "an implementer publishes a scanned Markdown dot-file from its worktree" exceeded its fixed 5,000 ms case deadline at load 5.9
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T12:10:04.453Z
updated: 2026-11-24T12:10:04.453Z
---

## Summary

Reported by impl-1966 on 2026-11-24 at about 12:09Z, macOS arm64, Node 24.21.0. In a focused run of hub/test/evidence-publish.test.ts at a 1-minute load of 5.89, the existing, unchanged case "an implementer publishes a scanned Markdown dot-file from its worktree" failed with "evidence case body: deadline exceeded after 5000 ms" (20 of 21 passed). The immediate rerun at load 5.59 passed 21 of 21, and a run on the same source before passed 21 of 21. The case body uses a fixed 5,000 ms deadline rather than the shared load-scaled bound (compare T-2046).

## What to build

Move this case's body deadline onto the shared load-scaled helper, as T-2046 did for other fixed waits, while keeping a named bound for the operation it asserts.

## Acceptance criteria

- [ ] C1. The case's deadline scales with load through the shared helper, and the file passes 10/10 at a controlled 1-minute load of about 8 (test plus loaded batch).
