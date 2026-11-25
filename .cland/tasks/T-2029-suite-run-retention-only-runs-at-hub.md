---
id: T-2029
kind: task
title: Suite-run retention only runs at hub start and on suite launch, so an idle hub never sweeps its backlog
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-20T08:02:00.111Z
updated: 2026-11-25T13:02:26.755Z
---

## Summary

Suite-run retention (T-1957, T-1992) runs one pass at hub start (`dispatch.ts:594`) and afterwards only when a suite job launches (`suites.ts:1112`). Each pass handles a bounded number of pending indexed runs plus one 4,096-entry unindexed sweep, so an idle hub never sweeps, and a large backlog takes about one suite launch per 4,096 entries. After restart #91 on 2026-11-20, two passes ran and none followed for 14 minutes (cland-impl's observation).

## What to build

Give retention its own bounded schedule, for example a pass every few minutes while work remains and a slower idle cadence, in addition to the launch trigger. Keep the per-pass bounds and the single-pass-at-a-time guard. Report the backlog and progress in the heartbeat or doctor.

## Acceptance criteria

- [ ] C1. With no suite launches, retention still completes passes on its own schedule until the backlog is swept (test with a fake clock).
- [ ] C2. Passes never overlap, and the per-pass bounds are unchanged (test).

## Comments

### coord · 2026-11-24T11:03:59.196Z

Live observation on hub #101 (2514c3d9a), from cland-impl, 2026-11-24 10:04 to 11:02Z. Contrary to this item's premise, retention now runs a full live pass over all ~5,560 known runs on every landing or finished run. There were eight passes, at 10:04, 10:05, 10:07, 10:16, 10:26, 10:36, 10:52 and 10:57; each removed 0, kept all, and wrote about 1,000 lines. That's 7,979 suite-retention lines in an hour, and the 10:57 pass took 8,017 ms. It coincided with 5 s tracker stalls. The fix should also bound the pass: incremental work rather than a full sweep per event, and one summary line rather than a line per run. Recheck the "only at start and launch" claim at the current dev before implementing.
