---
id: T-569
kind: task
title: 'demo run-timeout watchdog test: "demo deadline reached during delivery" under a 2500 ms run timeout on a loaded droplet'
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
created: 2026-10-16T04:18:06.312Z
updated: 2026-10-16T04:18:06.312Z
---

## Summary
Seen once, on 2026-10-16 in T-488's droplet run 59571add at 72faa365 (A-3651): hub/test/demo.test.ts:69, "demo run timeout destroys the machine through the watchdog even with the hub gone", failed with `demo deadline reached during delivery`. The test sets CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS=2500, and the deadline starts before acquire and delivery, so a slow delivery on a loaded droplet can use up the whole window. It didn't repeat: T-488's next Linux run 463f653f (A-3691) passed it, and the file was 5/5 on both T-488's branch and dev on a quiet Mac (A-3661).

## Acceptance criteria
- [ ] C1. The test separates delivery time from the run-timeout window it's checking, for example by starting the timed bound after delivery or by giving delivery its own deadline, so droplet load can't fail it, and the product's deadline semantics are recorded on this item.
- [ ] C2. demo.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.
