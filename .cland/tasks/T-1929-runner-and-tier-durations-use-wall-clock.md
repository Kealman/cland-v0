---
id: T-1929
kind: task
title: Runner and tier durations use wall-clock time, so a system clock correction mid-run distorts recorded durations
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1797
branch: t/T-1929-runner-and-tier-durations-use-wall-clock
created: 2026-11-17T02:20:03.376Z
updated: 2026-11-25T14:24:26.810Z
---

## Summary

Runner and tier wall-clock duration accounting uses wall-clock timestamps, so a system clock correction mid-run distorts recorded durations. In A-15180 a 4430.512 s forward wall-clock jump made a run's recorded duration 5023.49 s while Node measured 592.875 s (impl-1576, T-1576 topic-1578). Durations should use a monotonic elapsed clock.

## Acceptance criteria

- [ ] C1. Runner, tier and suite duration figures come from a monotonic elapsed clock; a fake wall-clock jump during a run leaves the recorded durations unchanged (test, red before the fix).
- [ ] C2. Timestamps shown to people (start and finish times) stay wall-clock, and the duration manifest and budget readers are unaffected or migrated (rule 20 consumer list in the item).

## Comments

### impl-1929 · 2026-11-25T14:24:26.810Z

Rule 20 consumer audit: searched duration producer strings (suite duration, shard duration, tier_seconds), verificationStepCommand/verificationStepResults, suite timing/timingReceipts and taskDurationReport across hub, web, nvim, docs, shipped skills and fixtures. Producers migrated: hub/test/run-suite.ts package suite/shard/lock/machine-wait/selected duration-check/Web phase durations; verification-plan.ts tier shell wrapper; hub/suites.ts host T0. Existing Node reporter duration_ms, load-gate performance.now and manifest/projected budgets already measure elapsed or project recorded samples. Readers unchanged: suiteSummary and suite-recovery, verificationStepResults and merge-batches (decimal grammar already supported, including old integer lines), suite-tier-report timingReceipts, suite-duration-budget, suite-durations, durations.ts refresh, spawn-census report, store/history, remote status/timing receipt readers and redaction. Frozen cli-usage commands.json and shipped help exports unchanged; no skill, QA brief, startup probe, wire field or persisted record schema changed. Retained fixtures with integer and decimal tier/suite lines remain supported. Coordinator scope decision in topic-1797: process-local execution producers only; cross-restart/machine sharded overall wall, queue wait/run metrics and billing remain wall intervals, now labelled in output/docs. Web and Neovim queue ages/ETAs consume unchanged runMs/waitMs timestamps; no execution duration calculation there. C2 timestamps (holder since, starts, finished/done and UTC remote runner start) remain wall time.
