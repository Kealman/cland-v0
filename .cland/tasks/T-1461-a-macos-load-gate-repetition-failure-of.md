---
id: T-1461
kind: task
title: A macOS load-gate repetition failure of a test green in recent covers gets one automatic rerun
state: closed
status: done
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
  - T-1460
topic: topic-1250
branch: t/T-1461-a-macos-load-gate-repetition-failure-of
created: 2026-10-30T05:44:58.258Z
updated: 2026-10-30T20:47:45.872Z
closed: 2026-10-30T20:47:45.872Z
---

## Summary

In v0.3.0, macOS local covers went red 20 times in 34 runs, against 5 in 28 on Linux, costing about 10.9 h (retro A-14149). When a test that passed in recent covers fails only in a macOS load-gate repetition, the cover reruns that identity once automatically; the finding is still filed under the flaky-rerun rule. Retro v0.3.0 change 1.

## Acceptance criteria

- [x] C1. A cover whose only failure is one load-gate repetition of a previously green identity reruns it once and records both receipts.
  - verified: rev-26 [reviewer] · run rev-20261030-1461-evidence-1 · 2026-10-30T20:26:35.251Z · commit e6ed2e096b31f63423824474af335dcf91edd3ee
  - done: impl-1461 · 2026-10-30T20:39:07.020Z
  - verified: rev-26 [reviewer] · run rev-20261030-1461-source-3 · 2026-10-30T20:41:34.423Z · commit 8b9f66d851eac04d40e7b1d0fa7658fae63c7cfd

## Comments

### impl-1461 · 2026-10-30T19:08:19.450Z

Contract consumer inventory before edits: SuiteSelection is produced by hub suites admission; carried by verification plan, executor manifests/local worker, tierSuiteSelection and shard spreads; read by run-suite/load-gate, CLI dry-run/describeSelection, cache sameSuiteSelection, web/nvim wire views and persisted suite summaries/full records. Add optional loadGateRerun context only; old selection shapes remain valid. Load-gate result is consumed only by run-suite and durations runner fixtures; additive report fields do not change failed status. Logs consumed by suite report/loadProofIdentities/retainedLoadProofs, duration parser, provenance and stage proofs; use new prefix so no rerun counts as original green. Searches include docs, skills, QA, hub/web/nvim tests across tiers. Confirmed Coordinator policy and runner seams; report-only, last five completed covers within seven days.

### rev-26 · 2026-10-30T19:18:36.311Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1461-source-1
commit: 84629ad11f8c6879d9ca41b2b28838005f63da06
scope: full
findings: [{"severity":"high","text":"M2: loadRerunGreens stores an unbounded identity list at the job top level, which suite-history.ts's compact projection does not omit. Every retained archive can therefore reload full identity payloads at startup, violating the bounded-history contract; keep the checkpoint inside an already omitted full-record field and prove bounded summaries plus at-most-five full hydrations.","file":"hub/src/hub/suites.ts","line":540},{"severity":"high","text":"M3: the new native rerun receipt serializes raw results/diagnostics before the shared redactor, so failed retries can persist environment values or command/argv tails. Redact the complete receipt before emission and retain a failing-retry redaction control.","file":"hub/test/load-gate.ts","line":169},{"severity":"medium","text":"M1: the new guide has the wrong owning H1 and no index membership; changed SUITE_USAGE lacks its frozen commands.json migration. The native control's documented 7/6 counts also contradict its 6/5 repetition-only counter. Correct owning metadata/fixture/count prose and retain complete unchanged-guard red/green receipts.","file":"docs/agents/tests/hub-test-load-gate-rerun.test.ts.md","line":1},{"severity":"medium","text":"M4: an admission-only retry continues before its native receipt is emitted; its final summary drops the observed exit/signal and setup diagnostic. C1's second receipt must explicitly record an incomplete retry with native facts and bounded redacted diagnostics.","file":"hub/test/load-gate.ts","line":148}]
finding_counts: {"high":2,"medium":2,"low":0}

Read-only full Standards/Spec source review: not clear for M1–M4 in attached source1 artifact. Coordinator's report-only/executed-prefix decisions retained; original cover remains red and later phases unexecuted. No Reviewer test execution or current-head runtime verification. Lead's working-tree fixes are pending a separate exact pushed-head review.

Criteria: C1 failed (Admission-blocked retry omits native exit/signal/setup evidence; remaining source findings also need correction before verification.).

### rev-26 · 2026-10-30T19:22:33.554Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1461-source-2
commit: e6ed2e096b31f63423824474af335dcf91edd3ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14637: M1–M4 closed in exact replacement source. Standards/Spec have no remaining findings. Checkpoint uses omitted selection payload, full native retry receipt redacts before bounding, and admission-blocked retry records native incomplete evidence. Coordinator report-only executed-prefix policy retained. C1 runtime remains unverified; targeted local summaries are not configured/full/Linux/browser receipts. Preserve original Darwin command/output evidence for final audit.

### rev-26 · 2026-10-30T20:26:35.251Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1461-evidence-1
commit: e6ed2e096b31f63423824474af335dcf91edd3ee
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14672: C1 verified using original A-14671 Linux all plus preserved original Darwin native fixture excerpts A-14639 and pinned assertions. Darwin controlled rerun retains both receipts/red status; Linux paths exclude retry. 5899 ordinary passes/8 reasoned skips plus170 load passes;6966progress IDs paired. T0/T1/T2/T3/Web0,T4unexecuted. Report-only executed-prefix disposition retained; no live Darwin cover or enforcement proof. Timing/lint/missing baselines stay report-only; no new workload or old-head relabelling.

Criteria: C1 verified.

### rev-26 · 2026-10-30T20:41:34.423Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1461-source-3
commit: 8b9f66d851eac04d40e7b1d0fa7658fae63c7cfd
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14684: merge delta clear; C1 carried under Coordinator conflict waiver 90ab2308. Both additive imports/skill sections retained; cover checkpoint/history lookup preserves imported isolated recovery/admission/evidence guards without behavior interaction. A-14681 search independently matches 34 files plus required union36; raw counters579/579,0adverse,36native closes0/null; typecheck/lint0 (123report-only/0refusals, known T-1484 probe explicitly incomplete). Prior full Linux05f17263/A-14671 remains at e6ed2e096, with final A-14672 and original Darwin fixtures A-14639; no merged-head full-suite/browser/live-Darwin-cover claim. Report-only/original-red/executed-tail limits retained. No new workload; periodic dev/release re-cover per disposition.

Criteria: C1 verified.

### coord · 2026-10-30T20:47:45.872Z

Merged 1316431d79c965eb4ebdfaa6080647d1de2e7ee9 onto dev.
