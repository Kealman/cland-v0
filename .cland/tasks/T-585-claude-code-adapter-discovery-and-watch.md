---
id: T-585
kind: task
title: claude-code-adapter "discovery and watch share the default 30-second schedule" counts 2 calls instead of 1 on a loaded droplet
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T08:50:52.161Z
updated: 2026-10-16T08:50:52.161Z
---

## Summary
Integrated cover 0000625b at dev 3a3b4633 (droplet, 2026-10-16 08:49Z) failed hub/test/claude-code-adapter.test.ts:353, "Claude discovery and watch share the default 30-second schedule, and stop works before the next pid arrives": "launch discovery and watch use one call", actual 2. The case passed 3/3 alone on dev on a quiet Mac. Under load the shared schedule apparently fires a second discovery before the watch takes over: either a timer-ordering race in the adapter or a test that counts calls across a boundary load can shift.

## Acceptance criteria
- [ ] C1. Find whether a real double discovery happens under load (a product issue: fix the adapter so they share one call) or the test counts across a timing boundary (a test issue), fix the cause, and record it on this item.
- [ ] C2. claude-code-adapter.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
