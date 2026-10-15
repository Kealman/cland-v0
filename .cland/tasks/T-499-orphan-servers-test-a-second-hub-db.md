---
id: T-499
kind: task
title: "orphan-servers test: a second hub.db connection hits SQLITE_BUSY against the live hub (Linux, under load)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T14:07:24.615Z
updated: 2026-10-15T14:07:24.615Z
---

## Problem

`hub/test/orphan-servers.test.ts:346`, the OpenCode unverifiable-live-server case, writes hub.db through a second connection while the hub holds it, and hit SQLITE_BUSY on Linux in T-456's droplet verify 9d3032d2 (A-3050). T-456 doesn't touch the file. The E-423 stage-1 cover ab5bddd4 had the same file green.

## Acceptance criteria

- [ ] C1. The case seeds its row either before the hub opens the database, or through the hub's own write path or a busy_timeout connection, so it can't race the hub's writer. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. orphan-servers.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
