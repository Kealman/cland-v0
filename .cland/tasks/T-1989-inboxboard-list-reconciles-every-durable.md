---
id: T-1989
kind: task
title: InboxBoard.list reconciles every durable inbox wait per call, so a large wait set keeps inbox work unbounded after T-1975
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-19T00:48:37.285Z
updated: 2026-11-19T00:48:37.285Z
---

## Summary

Found by impl-1975 during T-1975 (2026-11-19). T-1975 bounds the retained-message candidate window of `inbox.list`. `InboxBoard.list` still walks every durable `inbox_waits` row and reconciles each with `store.message` and the candidates on every call. Age-hidden waits are intentionally retained for later read and reply departure semantics, so a large wait set keeps per-call work proportional to all waits, independent of the page returned.

## What to build

Index the wait reconciliation so a page reads only the waits it can show plus a bounded overhead, keeping hidden waits durable for read and reply departure. Keep reply shape, ordering and unread counts unchanged.

## Acceptance criteria

- [ ] C1. With 50,000 durable waits (most age-hidden), an inbox page reconciles at most the waits it returns plus a bounded overhead, counted through a seam (test).
- [ ] C2. Read and reply departure for hidden waits behaves exactly as before on a recorded fixture, and every consumer of inbox waits is listed (rule 20).
