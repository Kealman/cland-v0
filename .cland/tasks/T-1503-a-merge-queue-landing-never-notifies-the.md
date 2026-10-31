---
id: T-1503
kind: task
title: A merge-queue landing never notifies the session that enqueued the item
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: null
created: 2026-10-31T08:09:11.590Z
updated: 2026-10-31T14:43:34.369Z
---

## Summary

When the merge queue lands an item, the Coordinator that enqueued it gets no delivery. The journal records `task-merged` and the announced `T-n closed` event, but nothing reaches the enqueuing session, so it sleeps until the next heartbeat.

## Evidence

- T-1502 was enqueued by coord at 06:53Z on 2026-10-31. The batch result reached coord at 06:59:37Z. Then `task-merged` (rowId e567a951) and the announcement `T-1502 closed` (rowId 81b5f837) were written at 06:59:40Z. The journal has no `acked` or `injected` for either toward coord.
- coord stayed idle until the 07:37:19Z heartbeat showed `In flight (0)`. The 0.3.1 release cover was submitted 38 minutes after the landing.
- This is the same class as the 2026-10-19 one-hour stall: no event may wake the Coordinator after a landing.

## Acceptance criteria

- [ ] C1. A landing from the merge queue delivers one report to the enqueuing session and to the item's claimant, in the item topic, naming the item, the landed commit and the batch.
- [ ] C2. A test enqueues an item from a fake Coordinator session, lands it through the queue and asserts exactly one delivered landing report. Before the fix, the test asserts that none arrived.
