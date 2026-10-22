---
id: T-1105
kind: task
title: Normalize legacy id-less criteria through task.criterion
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-22T10:36:44.495Z
updated: 2026-10-22T10:36:44.495Z
---

## Summary

Items created before criterion ids existed show their criteria with `id: null` in `task.view` (with `criterion_seq` as the high-water mark), and `task.criterion` has no normalization-only operation: the first write to such an item assigns ids above the mark. T-1078's web criteria editor therefore shows id-less rows read-only until an ordinary add or a CLI criterion write persists ids (impl-1078, review A-9090 M2, 2026-10-22). A normalization action lets any client give an item's legacy criteria stable ids without changing their text or marks.

## Acceptance criteria

- [ ] C1. `task.criterion` (and the `cland task criterion` CLI) offers a normalize operation that assigns ids to every id-less criterion of an item in order, above `criterion_seq`, keeps text and marks unchanged, and is a no-op on an item whose criteria all have ids (test).
- [ ] C2. After normalization the web card's criteria become editable without an add (Web test), and hub/README.md and the CLI help describe the operation (doc).
