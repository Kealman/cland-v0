---
id: T-699
kind: task
title: "executor-safety and executor-prepare: barriers instead of 16 s negatives, one fixture for the refusal and retry tables"
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-697
topic: null
branch: null
created: 2026-10-16T19:59:36.725Z
updated: 2026-10-16T20:00:52.435Z
---

## Summary

- `executor-safety.test.ts` (129.0 s): two tests each `await pause(16000)` to prove no `POST /v2/droplets` happened while a spend lock is held. The five-cause refusal loop builds five full remote fixtures (git, bare territory, snapshot seed) for one decision, and a pure config-validation test sits in this machine file (memo §2.2 win 7; report-slice4 #1).
- `executor-prepare.test.ts` (75.6 s): five transient builder-delete retries (409, 422, 503, timeout, key-503) are five prepares, and four hub restarts prove lease and snapshot durability that reopening the `Store` shows (report-slice2 #10).

## What to build

- **Barriers.** Each 16 s negative waits instead on an acquisition-attempt signal from the acquisition module or a counter on the fake provider: the attempt was made and is waiting, then no create happened.
- **One fixture per table.** The five refusal causes become one fixture plus a T1 table on the fallback-reason function, keeping the notice and journal proof once. The five retry causes become a table on the in-process provider (T-697).
- **Persistence in-process.** Durability is proven by closing and reopening the `Store`, or by `projectHub` stop and serve; one spawned-hub restart stays where the title names the restart.
- **Pure tests leave.** Config validation moves to a T1 file.

## Acceptance criteria

- [ ] C1. The two files' manifest seconds fall from 204.6 s (A-3877) to 110 s or less.
- [ ] C2. No `pause(16000)` or other numeric wait is left in `executor-safety.test.ts`, proved by the test lint.
- [ ] C3. Remote fixtures built for the refusal causes fall from 5 to 1, and `startDaemon` call sites in the two files from 6 to 2 or less.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
