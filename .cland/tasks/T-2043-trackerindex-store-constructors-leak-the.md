---
id: T-2043
kind: task
title: TrackerIndex/Store constructors leak the opened DatabaseSync handle when schema initialization throws
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-20T22:22:25.145Z
updated: 2026-11-20T22:22:25.145Z
---

## Summary

The production TrackerIndex and Store constructors can throw during schema initialization after `DatabaseSync` has opened the database, before `serveProject` holds a constructed owner. `database.ts` closes the handle only when its own initial busy_timeout fails, and `serveProject`'s Tracker-construction catch closes logs and the lock but never sees the unreturned handle, so it leaks open. Reported by impl-1901 on 2026-11-20 from static reading of hub/src/hub/store.ts, hub/src/tracker/index-db.ts and serveProject. T-1901's test fixture captures these handles through an injected openDatabase; the production path is unchanged. No live database was inspected and no failure probe was run.

## Acceptance criteria

- [ ] C1. A schema-initialization failure inside the TrackerIndex or Store constructor closes the opened DatabaseSync handle before the error propagates, shown red first with an injected failing schema step (test).
