---
id: T-759
kind: task
title: "processStartedAsync's ps probe (doctor/report.ts → hub/lock.ts) is reachable from T2 tests: claude-code-schedule and tracker-levels"
state: open
status: backlog
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:05:24.636Z
updated: 2026-10-18T05:43:31.144Z
---

## Summary

Found by impl-750 on 2026-10-17 at 22:04Z, under T-750's enforced tripwire. claude-code-schedule.test.ts mocks child_process.execFile and claims to start no native processes. However, its known-PID adapter resume calls processStartedAsync → doctor.run → spawn(ps), so an enforce pass trips and stalls. Raw runs pass 5/5, with a median of 1.33 s.

## What to build

Inject the process-start fact into the adapter resume path that this test exercises, as T-750 and T-751 do for their files. Production keeps the native reader. Keep every assertion.

## Acceptance criteria

- [ ] C1. claude-code-schedule.test.ts and tracker-levels.test.ts each pass 5/5 under the enforced runtime tripwire with no child_process trip, and a droplet run's trip report lists neither, with their assertions unchanged.

## Comments

### coord · 2026-10-18T05:43:27.786Z

Second case (coord, 2026-10-18 05:43Z): T-772's droplet run f3c91a4b (A-4997) shows the same report-only T2 child_process.spawn trip in tracker-levels.test.ts, "reserved or malformed configured levels produce a notice and keep the default ladder", through doctor/report.ts → hub/lock.ts processStartedAsync. The Mac run with the tripwire enforced was clean, so the trip is environment-dependent. Fix the root: inject the process-start fact at the lock and doctor seam for fixtures, the way T-751 did for the droplet and spend locks, so no T2 test reaches it. C1 covers both files.
