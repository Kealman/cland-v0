---
id: T-569
kind: task
title: 'demo run-timeout watchdog test: "demo deadline reached during delivery" under a 2500 ms run timeout on a loaded droplet'
state: open
status: in progress
size: S
rank: 4442
labels:
  - bug
  - hub
  - flaky
  - v0.1.4
assignee: null
parent: E-482
blocked_by: []
topic: topic-402
branch: t/T-569-demo-run-timeout-watchdog-test-demo
created: 2026-10-16T04:18:06.312Z
updated: 2026-10-16T17:27:36.385Z
---

## Summary
Seen once, on 2026-10-16 in T-488's droplet run 59571add at 72faa365 (A-3651): hub/test/demo.test.ts:69, "demo run timeout destroys the machine through the watchdog even with the hub gone", failed with `demo deadline reached during delivery`. The test sets CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS=2500, and the deadline starts before acquire and delivery, so a slow delivery on a loaded droplet can use up the whole window. It didn't repeat: T-488's next Linux run 463f653f (A-3691) passed it, and the file was 5/5 on both T-488's branch and dev on a quiet Mac (A-3661).

## Acceptance criteria
- [ ] C1. The test separates delivery time from the run-timeout window it's checking, for example by starting the timed bound after delivery or by giving delivery its own deadline, so droplet load can't fail it, and the product's deadline semantics are recorded on this item.
- [ ] C2. demo.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.

## Comments

### coord · 2026-10-16T06:22:18.669Z

Second sighting, now the machine-lifetime case: demo.test.ts:71 in T-488's droplet run 16c8d5d6 (A-3771). T-488's paired probe (A-3785) ruled the branch out: five simultaneous branch/dev pairs on the Mac, with the same delivery time on both sides. Mean DropletRun.deliver was 952/954 ms (run timeout) and 876/882 ms (machine lifetime), and acquire-before-delivery was about 300 ms. With CLAND_TEST_EXECUTOR_*_MS=2500, that leaves about 1.2 s of window on a quiet Mac, and a loaded droplet can use it all up. That supports C1's direction: start the timed bound after delivery, or give delivery its own deadline.

### coord · 2026-10-16T16:37:57.471Z

Coordinator, 2026-10-16 16:37Z: shared-defect candidate from the hub. demo.test.ts:71 "demo run timeout destroys the machine through the watchdog even with the hub gone" ('machine command failed or exceeded its time bound') failed in T-476's run 9955455a (A-3851) and T-628's local run b708b845 (A-4021, peak load 26.9). That's two receipts on different runs, so it's the first entry for the quarantine manifest (T-657) once that lands, with this item as owner.
