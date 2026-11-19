---
id: T-1975
kind: task
title: "inbox.list takes 17–19% of the hub's main thread on an idle hub (5% after restart #83)"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-18T12:37:47.082Z
updated: 2026-11-19T00:37:37.535Z
---

## Summary

From the profile behind T-1973 (2026-11-18, hub pid 52877, three 8 s profiles at 12:31–12:32Z). `inbox.list` (hub/src/hub/inbox.ts:335, via :713) took 17–19% inclusive of the main thread, with `inboxMessages` (store.ts:1948) at 9–11%, against 5% after restart #83. The inbox grows with every topic message, and each list call appears to read and decode more of it than the page it returns.

## What to build

Bound `inbox.list` work by the page it returns: indexed queries over the unread and recent window, and no full decode of retained history per call. Keep the reply shape and ordering unchanged.

## Acceptance criteria

- [ ] C1. With 100,000 retained messages, an inbox page decodes at most the rows it returns plus a bounded overhead, counted through a seam (test).
- [ ] C2. Inbox results (order, unread counts, cursors) are identical to the current implementation on a recorded fixture, and every inbox.list consumer is listed (rule 20).
