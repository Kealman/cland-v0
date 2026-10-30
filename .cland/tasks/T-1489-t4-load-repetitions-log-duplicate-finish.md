---
id: T-1489
kind: task
title: T4 load repetitions log duplicate finish-only progress rows
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1247
branch: t/T-1489-t4-load-repetitions-log-duplicate-finish
created: 2026-10-30T16:03:56.281Z
updated: 2026-10-30T16:04:47.373Z
---

## Summary

The suite log of run b393a187 (A-14547, T-1454 at 20c6b99d3, Linux droplet) has five unpaired finish-only progress rows (lines 22687–22691). They repeat the T4 lane-2 repetitions 1–5 with identical durations but short names and new ids, and have no start rows. The ordinary totals (4,469 passes) are unaffected, and the matched start and finish rows still prove 10 T4 cases, but a reader that counts finish rows would overcount repetitions. Found by rev-32 during T-1454 evidence reconciliation, 2026-10-30.

## Acceptance criteria

- [ ] C1. A T4 load-repetition run writes exactly one start and one finish progress row per repetition, with the full case name and one id, shown by a fixture that reproduces the duplicated finish-only rows before the fix; the suite summary and every log reader count each repetition once.

## Comments

### impl-1489 · 2026-10-30T16:04:47.373Z

Consumer inventory before changes: skip-reporter emits TestProgress; run-suite.ts streams starts/finishes into unfinished state/Web guard; suite-progress.ts consumes rows for interruption summaries; hub/src/hub/suites.ts uses these summaries; dev-t3-probe.ts (culprit search), batch-flakes.ts, soak-quarantine.ts consume progress. durations.ts counts ordinary top-level timing/file receipts, not nested repeats. suite-progress.test.ts, suite-timeouts.test.ts, suite-soak-component.test.ts, durations.test.ts and reporter/runner tests cover consumers. QA E-617/E-420 and review audits reconcile result lines and matched progress IDs. Wire shape stays unchanged; producer fix preserves old-wire readers and finish-only cancellation behavior. Original A-14547 lines 22687–22691 confirmed five duplicate short-name finishes.
