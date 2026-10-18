---
id: T-674
kind: task
title: suite-timeouts 'verify reports unverified fast-exit pipe cleanup once…' fails under load; fix it and lift its quarantine
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-531
branch: t/T-674-suite-timeouts-verify-reports-unverified
created: 2026-10-16T19:04:11.816Z
updated: 2026-10-18T19:43:58.402Z
---

## Summary

hub/test/suite-timeouts.test.ts "verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor" fails under load. It failed on four runs: b708b845 (A-4021), 6ee9b87c (A-4041), and the two Mac census runs at a8ddbb8c (A-4056 and A-4088's repeat), each time as the only failure in its phase. It went into hub/test/quarantine.json on 2026-10-16 with this item as owner, and the entry expires within seven days.

## What to build

Find whether the case waits on wall-clock time, on a process boundary or on a racing cleanup under load, and fix the cause so it passes on a loaded machine. Keep its assertions' meaning. Prefer an event the case can observe, or an injected clock, over a longer timeout. Remove the quarantine entry in the same change.

## Acceptance criteria

- [ ] C1. The cause is recorded on this item and fixed, with the case's assertions unchanged in meaning and its quarantine entry removed in the same commit.
- [ ] C2. suite-timeouts.test.ts passes 10/10 serially as a whole file on the Mac at load above 10, and in the task's droplet verify.

## Comments

### coord · 2026-10-17T01:50:58.943Z

Coordinator: the quarantine entry for this test reported 'cleared' (20 consecutive green) in integrated cover 3626645c (A-4271). It's removed from hub/test/quarantine.json in the batch after T-635, T-681 and T-659. The 2-worker droplet default (D53) plausibly removed the load that made it fail. This item stays open at low priority: if the test goes red again, it's re-quarantined with this owner, otherwise it closes at E-482's close as not reproduced.

### coord · 2026-10-18T19:40:29.027Z

Recurred 2026-10-18 19:36Z in the E-678 stage-1 macOS run 949a9b43 at c7417944 (local, 2 workers, peak 1-min load 11.59; A-5548, line 47918). "one cleanup warning: not within 15000 ms" at suite-timeouts.test.ts:175, test 21.0 s. It was the run's only failure (2301/2302).

### impl-674 · 2026-10-18T19:43:58.402Z

Draft diagnosis before runtime validation: the fixture's parent yields in async writeFile after spawning the detached pipe holder. A later worker ownership snapshot can capture the child while ancestry remains intact, making cleanup complete and leaving no incomplete-warning to report. Drafted a pre-child ps snapshot barrier that returns only after the parent OS PID is gone, plus an explicit parent-gone/pipe-holder-alive observation before the existing worker receipt wait. Every original assertion is retained. quarantine.json is already empty from the earlier integrated clearing; it remains empty. Validation waits for the Coordinator's Mac all-clear; 20 quiet serial whole-file runs, then an authorized exclusive >10-load proof, host lint/typecheck, source review and exact-head droplet verify.
