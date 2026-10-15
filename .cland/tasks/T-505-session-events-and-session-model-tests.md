---
id: T-505
kind: task
title: "session-events and session-model tests: 5000 ms frame waits after a launch miss on a loaded droplet"
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
created: 2026-10-15T15:16:05.074Z
updated: 2026-10-15T15:16:05.074Z
---

## Problem

Two 5000 ms frame waits after a launch failed on Linux in T-495's droplet verify d6e75622 (A-3101):
- `hub/test/session-events.test.ts:84`, the process-rows case, where no frame matched within 5000 ms after the launch/model/role/rename flow;
- `hub/test/session-model.test.ts:146`, 'live resume journals its own launch model', also no frame within 5000 ms.
Both wait on a hub frame after a fake-session launch. A 4-worker c-8 under load can take longer than 5 s to deliver it.

## Acceptance criteria

- [ ] C1. Each wait is anchored to an observed launch completion, such as the session's ready or idle, before the 5000 ms frame window starts. Alternatively, the window is aligned with the product deadline it covers, citing its source line. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. Both files pass 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
