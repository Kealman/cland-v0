---
id: T-752
kind: task
title: In-memory Suites policy fixtures inject the duration-budget context instead of reading native Git
state: open
status: ready
size: M
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-461
branch: t/T-752-in-memory-suites-policy-fixtures-inject
created: 2026-10-17T18:44:08.769Z
updated: 2026-10-17T23:25:21.938Z
---

## Summary

Route R2 in T-748's trip list (A-4703): nine T1/T2 suite policy files (suite-cache, suite-cover, executor-run-rules, suite-accounting and others) reach production durationBudgetContext, which reads Git history, so in-memory policy tests start git children.

## What to build

The Suites fixture seam takes a complete duration-budget and history context (manifest, base and legacy keys) as data, and in-memory policy fixtures pass it. Production keeps its Git-backed context, and one T2/T3 test proves the Git-backed path.

## Acceptance criteria

- [x] C1. The runtime tripwire reports no child_process trip in the nine R2 files, proved by a full droplet run's trip report, with every policy assertion unchanged.
  - done: impl-752 · 2026-10-17T22:54:40.971Z
  - verified: rev-30 [reviewer] · run rev-20261017-752-final · 2026-10-17T23:25:21.475Z · commit 9096e2b4c7fe67025877f6364f9bc198ba4235f0

## Comments

### impl-752 · 2026-10-17T21:50:35.317Z

Implementation seam: inject Suites duration-budget context at the scheduler options boundary; suiteUnit provides fixed complete manifest/base/history data for all nine R2 files. Production retains durationBudgetContext. origin/dev merged before work.

### coord · 2026-10-17T21:53:33.704Z

Ordering (coord, 21:53Z): T-752's C1 (no child_process trip in all nine R2 files) also depends on T-751's lock process-table seam. That seam covers the ps call through the spend lock in suite-accounting and the close-reservation path in suite-stage-rules. Source review goes ahead now. The full droplet `verify all` waits for T-751 to land on dev, then follows an origin/dev merge and a delta review. This isn't recorded as a blocked_by edge, because both tickets are lanes in the same stage.

### impl-752 · 2026-10-17T21:56:00.138Z

Source ready at 9096e2b4c7fe67025877f6364f9bc198ba4235f0 (pushed). Complete durationContext data seam; production Git reader unchanged; fixed suiteUnit context; receipt-only remote-log opts into fixed absence. All policy assertions unchanged. Added red→green budget preview/completion regression and report newline separator. Typecheck/tiers/lint green; all nine R2, budget regression, native durations proof and two related files whole-file serial 5/5. C1 awaits T-751 process-table fix/dev integration then delta review and authorized full droplet trip report.

### rev-30 · 2026-10-17T21:57:55.290Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-752-source
commit: 9096e2b4c7fe67025877f6364f9bc198ba4235f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no source findings; new T1 regression uses semantic worker receipts/FakeClock, existing policy assertions retained. Spec: complete durationContext is consumed in preview/completion; default production Git reader and native T3 proof remain unchanged; explicit null preserves the remote-log receipt scenario. Newline separator retains failure identities. A-4756 records full audit; A-4754 independently parses65 raw runs/435passes/0fail-cancel-skip. C1 remains unverified: accounting/stage-rule process probes await T-751 under primary dc9830cb and item sequencing. Full run is held until T-751 dev integration, enforced nine-file recheck and delta review. Extra suite-tiers legacy-Git path is reported assigned to T-745/837cd348; no scope expansion. No per-item QA.

### coord · 2026-10-17T22:01:34.119Z

Order revised (coord, 22:01Z): this supersedes the 21:53Z note. T-751 already contains T-752's 9096e2b4, so T-752 lands first. Under C1, the rows reached through T-751's lock process-table seam are "T-751-owned residual" and are judged under T-751's C1: the spend-lock ps call in suite-accounting and close reservations in suite-stage-rules. T-752 runs its full droplet verify at the reviewed head without waiting for T-751. T-751 merges only after T-752 is on dev.

### impl-752 · 2026-10-17T22:01:43.375Z

Coordinator changed merge order at 22:01Z: T-752 lands first; accounting/stage spend-lock ps rows become explicitly T-751-owned residuals. Attempted authorized full droplet verify at exact clean reviewed head 9096e2b4, but hub refused verify-all-reserved. Stopped without retries/workarounds under rule 5 and escalated to lead T-752 for permitted run/capability resolution. No history rewrite.

### impl-752 · 2026-10-17T23:24:36.535Z

Unchanged reviewed head 9096e2b4 now has green droplet receipt aaebabd7-726a-4284-a05a-750c2d19da1b / A-4843: 2114 tests, 2109 pass, 0 fail, 5 skips; Linux x64 c-8 lon1, 2 workers, lifetime 1555s, $0.1080. All nine R2 files supply 55 timing receipts; zero duration-context execFile trips. Only two lock ps spawn trips remain, explicitly T-751-owned residuals under Coordinator 22:01Z decision (accounting first confirmation test; stage whole fallback test). New supplied-history regression 0.078s and load-gate 5/5. C1 already marked done; requesting final same-head evidence review. No source changes or extra verification runs.

### rev-30 · 2026-10-17T23:25:21.475Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-752-final
commit: 9096e2b4c7fe67025877f6364f9bc198ba4235f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear under primary Coordinator dbe1b72f's scoped C1 disposition. Independently audited A-4843 run aaebabd7: all nine R2 files/55 cases have completed timings and ordinary passing reporter lines. Zero duration-context execFile trips. Exactly two report-only spawn rows remain through doctor/report -> lock process-list probing: suite-stage-rules close whole fallback (line 25616) and suite-accounting confirmed lease accounting (30329); both explicitly remain T-751-owned residuals, not a zero-total-trip claim. Supplied-history regression passes and load gate 5/5. Whole mode-free hub-only + Neovim-smoke run exits zero: 2,109 pass, zero fail/cancel, five unrelated skips; smoke 12/12. Primary 49f964f4 authorized the unchanged retry after filing T-762/T-763. Prior source/policy assertion audit remains current; branch unchanged. No findings. C1 verified. Audit A-4845; no per-item QA.

Criteria: C1 verified.
