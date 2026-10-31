---
id: T-1529
kind: task
title: Merge-delta assessment covers merges whose conflict resolution is docs/help only (T-1462 redesign)
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-31T17:22:39.945Z
updated: 2026-10-31T17:22:39.945Z
---

## Summary

T-1462 assesses only conflict-free dev merges into a reviewed branch. Under rule 11, implementers merge dev after review only on a conflict, so in production the assessment never fires. T-1486's census (A-15012) found 14 conflicted two-parent heads, 2 one-parent corrections and 0 assessment opportunities. Assess merges whose conflict resolution touches only docs or help files instead, report-only first (rule 27).

## What to build

Compare the committed merge with its conflicted auto-merge. Admit the merge as docs/help-only only when every file that differs between the two lies in an explicit docs/help scope. Keep T-1462's conservative dependency facts. Record the assessment as today's report-only comment, with the Reviewer's merge-delta verdict still required.

## Acceptance criteria

- [ ] C1. A replay of the 14 conflicted heads in A-15012 records an assessment for each resolution that is docs/help-only, and none for code resolutions. Native receipts are included for T-1503 8054bba9 and T-1504 c3d85e32.
- [ ] C2. A positive and a negative fixture: a docs-only resolution is assessed, and a resolution touching code or tests is not. The existing conflict-free path keeps passing.
