---
id: T-197
kind: task
title: QA brief T-107 M8 omitted the fresh review before the post-change merge
state: closed
status: done
labels:
  - qa-found
  - needs-triage
assignee: null
parent: E-107
blocked_by: []
topic: null
branch: null
created: 2026-10-10T16:48:59.669Z
updated: 2026-10-10T16:50:33.221Z
closed: 2026-10-10T16:50:33.302Z
---

Found by qa-15 in T-107's demo (verdict qa-2026-10-10-15-107-d). M8 expected a merge to succeed right after a new commit made the review stale; the merge gate correctly refuses a stale review. The product is right; the brief was wrong. Fixed at e3b702e (M8 now posts a fresh review before the second merge). Close once the M8 rerun is clear.
