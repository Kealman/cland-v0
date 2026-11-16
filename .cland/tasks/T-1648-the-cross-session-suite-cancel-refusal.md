---
id: T-1648
kind: task
title: The cross-session suite-cancel refusal test sometimes finds its worker already gone
state: closed
status: done
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-03T01:29:18.151Z
updated: 2026-11-16T07:28:02.987Z
closed: 2026-11-16T07:28:02.987Z
---

## Summary

Periodic dev T3 75e7f4e4 at 3536669d (A-16079, Linux droplet) failed `hub/test/suite-cancel.test.ts` "suite cancel refuses another session's run while the human can cancel it by id" at the `pidAlive(job.pid!) === true` assertion (`false !== true`), right after the reviewer's refused cancel. The hub's failing-file rerun e8d3a711 at 20c4f951 passed 8/8 (A-16092), and it passed 3/3 locally on macOS. None of the merges in that range touches suite cancel. The worker is `node -e "setTimeout(()=>{},30000)"`, and the job pid may be a wrapper or runner process that exits or gets replaced under load, so its liveness doesn't reliably show that the refused cancel left the run untouched.

## What to build

Assert the refusal through the suite's own state: the run is still active, there's no result, and the worker's identity, from the hub's process record with its birth time, is unchanged. Don't rely on liveness of a pid that may not be the long-lived worker. If the pid is the right one, wait for the worker's ready signal before the refused cancel.

## Acceptance criteria

- [ ] C1. The test passes 20/20 on Linux under a load gate at 10 (test).
- [ ] C2. A refused cancel that did stop the run still fails the test (test).

## Comments

### coord · 2026-11-03T01:29:30.513Z

Hub dev-t3 search for 75e7f4e4 classified this as "already-fixed (already fixed on dev at 20c4f9511)". T-1541 (5a0ce079, landed between the red head 3536669d and 20c4f951) edited `hub/test/suite-cancel.test.ts`, so it may have removed the cause. Triage: close as fixed by T-1541 if this identity stays green across the next three periodic dev T3 runs. Otherwise keep the fix described above.

### coord · 2026-11-16T07:28:02.987Z

Merged into T-1689 (R-1880 triage A-19813, approved by the human 2026-11-16 07:25Z): same test and assertion (`suite-cancel.test.ts:131–141`). It recurred after T-1541, so T-1541 didn't fix it.
