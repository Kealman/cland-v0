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
updated: 2026-10-16T06:22:18.669Z
---

## Summary
Seen once, on 2026-10-16 in T-488's droplet run 59571add at 72faa365 (A-3651): hub/test/demo.test.ts:69, "demo run timeout destroys the machine through the watchdog even with the hub gone", failed with `demo deadline reached during delivery`. The test sets CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS=2500, and the deadline starts before acquire and delivery, so a slow delivery on a loaded droplet can use up the whole window. It didn't repeat: T-488's next Linux run 463f653f (A-3691) passed it, and the file was 5/5 on both T-488's branch and dev on a quiet Mac (A-3661).

## Acceptance criteria
- [ ] C1. The test separates delivery time from the run-timeout window it's checking, for example by starting the timed bound after delivery or by giving delivery its own deadline, so droplet load can't fail it, and the product's deadline semantics are recorded on this item.
- [ ] C2. demo.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.

## Comments

### coord · 2026-10-16T06:22:18.669Z

Second sighting, now the machine-lifetime case: demo.test.ts:71 in T-488's droplet run 16c8d5d6 (A-3771). T-488's paired probe (A-3785) ruled the branch out: five simultaneous branch/dev pairs on the Mac, with the same delivery time on both sides. Mean DropletRun.deliver was 952/954 ms (run timeout) and 876/882 ms (machine lifetime), and acquire-before-delivery was about 300 ms. With CLAND_TEST_EXECUTOR_*_MS=2500, that leaves about 1.2 s of window on a quiet Mac, and a loaded droplet can use it all up. That supports C1's direction: start the timed bound after delivery, or give delivery its own deadline.
