---
id: T-1489
kind: task
title: T4 load repetitions log duplicate finish-only progress rows
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1247
branch: t/T-1489-t4-load-repetitions-log-duplicate-finish
created: 2026-10-30T16:03:56.281Z
updated: 2026-10-30T16:42:40.017Z
closed: 2026-10-30T16:42:40.017Z
---

## Summary

The suite log of run b393a187 (A-14547, T-1454 at 20c6b99d3, Linux droplet) has five unpaired finish-only progress rows (lines 22687–22691). They repeat the T4 lane-2 repetitions 1–5 with identical durations but short names and new ids, and have no start rows. The ordinary totals (4,469 passes) are unaffected, and the matched start and finish rows still prove 10 T4 cases, but a reader that counts finish rows would overcount repetitions. Found by rev-32 during T-1454 evidence reconciliation, 2026-10-30.

## Acceptance criteria

- [x] C1. A T4 load-repetition run writes exactly one start and one finish progress row per repetition, with the full case name and one id, shown by a fixture that reproduces the duplicated finish-only rows before the fix; the suite summary and every log reader count each repetition once.
  - done: impl-1489 · 2026-10-30T16:10:39.170Z
  - verified: rev-26 [reviewer] · run rev-20261030-1489-evidence-1 · 2026-10-30T16:34:43.786Z · commit 6c94daa6227ac05a070b022545b0e7603e2b7dc2

## Comments

### impl-1489 · 2026-10-30T16:04:47.373Z

Consumer inventory before changes: skip-reporter emits TestProgress; run-suite.ts streams starts/finishes into unfinished state/Web guard; suite-progress.ts consumes rows for interruption summaries; hub/src/hub/suites.ts uses these summaries; dev-t3-probe.ts (culprit search), batch-flakes.ts, soak-quarantine.ts consume progress. durations.ts counts ordinary top-level timing/file receipts, not nested repeats. suite-progress.test.ts, suite-timeouts.test.ts, suite-soak-component.test.ts, durations.test.ts and reporter/runner tests cover consumers. QA E-617/E-420 and review audits reconcile result lines and matched progress IDs. Wire shape stays unchanged; producer fix preserves old-wire readers and finish-only cancellation behavior. Original A-14547 lines 22687–22691 confirmed five duplicate short-name finishes.

### impl-1489 · 2026-10-30T16:06:31.488Z

Inventory completion (rg across hub/nvim/web/qa/.agents for suite progress, suiteProgress, TestProgress, skipReporter): also web-phase-watchdog.ts and test consumers durations-runner, quarantine-runner, executor-run-rules, dev-t3-search[-component], suite-soak-component, merge-batches, suite-hung-component, durations-refresh. All retain prior wire parsing; production readers receive one row per completion from fixed emitter. durations refresh uses suite timing (top-level) and a set of file-envelope completions; nested duplicates never supplied extra duration samples. Hub summary keeps Node phase totals; interruption projection reduces fixed progress. Culprit/soak/batch readers keep full hierarchical names and get no new policy/shape. QA E-420/E-617 explicitly count terminal spec results; review reconciliation can now count matched IDs once. No startup probe or persisted-record schema consumes an altered field; no fields changed. T-1461 currently has no claim/branch/head, so overlap merge-tree is unavailable; origin/dev merge and merge-tree are clean.

### rev-26 · 2026-10-30T16:08:54.823Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1489-source-1
commit: 005936f5bdc54f86d55133c73d113349206e59e0
scope: full
findings: [{"severity":"medium","text":"M1: Raw finite native child and copied close/result polling owner do not cancel on abort/failure or immediately own spawn-error rejection. Use existing scratch commandIn lifecycle ownership, retain sealed env/native close/timeout and all pair/count/spec assertions (rules9/12/15).","file":"hub/test/suite-runner.test.ts","line":63},{"severity":"medium","text":"M2: A completed location key alone does not prove replay. Legacy no-testId finish-only executions at same file/location/name but distinct testNumber/outcome/duration are collapsed, potentially hiding failure. Add same-location distinct finish-only red control; deduplicate only positively matching replay while preserving genuine outcomes.","file":"hub/test/skip-reporter.ts","line":45}]
finding_counts: {"high":0,"medium":2,"low":0}

Source1 full audit at005936f5b: Standards M1 native fixture owner and Spec M2 overbroad finish-only suppression. Actual native replay fixture and reader inventory are relevant; matching guides updated, no wire or policy changes. A-14554 local summarized red15vs10/green and T1 evidence stays qualified Darwin-only, no configured/CPU/browser/full run. Consolidated source1 artifact records both findings. Correct/push/source review before mode-free verify.

Criteria: C1 failed (Deduplication suppresses distinct legacy same-location finish-only completions; native fixture ownership also needs shared cancellation/drain.).

### rev-26 · 2026-10-30T16:13:38.099Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1489-source-2
commit: 6c94daa6227ac05a070b022545b0e7603e2b7dc2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear: M1 finite native fixture now uses commandIn/scratchMachine/final shared env seal and retains ten pair/13-pass assertions. M2 requires identified matching completion evidence, retains distinct same-location legacy numbers/failures/durations and unidentified finish-only rows; new red-first control covers prior loss. Consumer inventory and docs/wire compatibility retained, no historical rewrites. Local source evidence A-14559/A-14554 stays Darwin-only, not full/load/browser. C1 runtime pending same-head configured mode-free verification; no Reviewer workloads.

### rev-26 · 2026-10-30T16:34:43.786Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1489-evidence-1
commit: 6c94daa6227ac05a070b022545b0e7603e2b7dc2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-14574 original bff3f369 audit clear at source2 head:4371 ordinary+245 separate load passes, no adverse outcomes, all paired. Exact native T3 ten-full-name-pair/13-pass fixture passes. T1 seven compatibility cases pass; both new replay/distinct-finish-only cases have timing parity and5/5 load each. Changed runner52 identities once, T0/T1/T2/Web complete; remainingT3/T4 unrun, no actualT4CPU-stress claim. Browser/version, reused host check, health and report-only file/budget/ratchet/printed-allowance limits retained in final audit. C1 verified, QA none, no Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-30T16:42:40.017Z

Merged 5e53caede571d307d63c662799b39a79c487185f onto dev.
