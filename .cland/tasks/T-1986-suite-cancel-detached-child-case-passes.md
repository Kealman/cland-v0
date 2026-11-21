---
id: T-1986
kind: task
title: suite-cancel detached-child case passes 20/20 under a CPU burner at load ≥10 on macOS after T-1758's retained-capture fix (one report-wait timeout unexplained)
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1758
topic: topic-1700
branch: t/T-1986-suite-cancel-detached-child-case-passes
created: 2026-11-18T20:05:12.173Z
updated: 2026-11-21T08:35:19.496Z
---

## Summary

Split from T-1758 (C3) by the Coordinator under the review-loop cap. T-1758's product fix (retained native captures across incomplete cancel attempts, reparent and partial validation, with ESRCH-only absence) is at 500f78de4. Its first loaded C3 run failed with `cancelled result after complete tree cleanup: not within 21154.541015625 ms` (load 13.1→17.5, factor 1.41, no diagnostics enabled). A following same-head diagnostic round of 3 loaded attempts with a pass-through observer passed 3/3, so the cause of that one timeout is unknown. It is either the new incomplete-cancel safety holding for a live verified descendant, or a slow but finite cleanup under load.

## What to build

Reproduce the report-wait timeout with the opt-in diagnostics enabled, and name the cause from structured receipts (rule 39): which retained identity the cancel waited on, whether it was signalled, its native state over time and its parent. Then fix accordingly: a bounded product wait, a load-scaled setup budget for this wait, or a product fix if a verified descendant is never signalled. Assertions on ordering stay unchanged.

## Acceptance criteria

- [x] C1. The case passes 20/20 under a parallel CPU burner at load ≥ 10 on macOS, run alone otherwise (evidence, native slot).
  - done: impl-1986 · 2026-11-21T08:09:49.219Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-1986-evidence1 · 2026-11-21T08:11:18.727Z · commit 064ad53b2e0e65ccf85898bf97e6dc3518282d7c
  - verified: rev-40 [reviewer] · run rev-40-20261121-1986-final · 2026-11-21T08:35:19.340Z · commit 064ad53b2e0e65ccf85898bf97e6dc3518282d7c
- [x] C2. If any run fails, its diagnostic receipts name the waited-on identity and its state, and the fix follows that cause (test or evidence).
  - done: impl-1986 · 2026-11-21T07:54:02.496Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1986-final · 2026-11-21T08:35:19.340Z · commit 064ad53b2e0e65ccf85898bf97e6dc3518282d7c

## Comments

### impl-1986 · 2026-11-21T07:42:44.227Z

Diagnostic consumer inventory before additive log receipts: LocalExecutor construction in hub/src/hub/suites.ts already passes options.log; hub/test/suite-cancel.test.ts will consume new suite-process-* records. Searched LocalExecutor, suite-process-*, harness-ended and harness-end-incomplete across hub/src, hub/test (all tiers), nvim/test, web, shared, docs, qa and shipped skills. Existing production journal readers (hub/src/hub/journal.ts), orphan cleanup readers, host termination tests and QA briefs consume existing harness events only and are unaffected: those event names/shapes remain unchanged, and new suite-prefixed records grant no authority. Other LocalExecutor tests use optional logger absence or ignore unrelated events. No reply, persisted resource, lease or wire shape changes.

### impl-1986 · 2026-11-21T07:55:02.142Z

Consumer inventory detail: unchanged LocalExecutor importers/callers: hub/src/hub/suites.ts; hub/test/{executor-prepare-retry,executor-liveness,executor-safety-component,suite,suite-selection-component,task-card-component,suite-importer-ready,suite-queue-policy,suite-human-component,measure-memory,merge-queue,suite-admission-responsive,verify-submission,suite-persistence,suite-stage-rules}.test.ts; suite-{component,unit}-fixture.ts. Migrated consumer: suite-cancel.test.ts. Existing harness-event readers in hub/src/{orphans.ts,hub/journal.ts}, host/ssh-host.ts, host-contract.ts and {system-processes,adapter-native-boundary,session-async-processes,orphan-servers,termination-ownership,claude-code-sessions-lifecycle}.test.ts remain unaffected because only suite-prefixed events are added; existing event fields/names remain intact. Frozen help fixture and QA T-229/T-271 are unchanged: no command or wire change. Searches found no new-event consumer in nvim, web, shared or shipped skills; no native process policy changes.

### rev-40 · 2026-11-21T07:58:08.809Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1986-source
commit: 064ad53b2e0e65ccf85898bf97e6dc3518282d7c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Preliminary diagnostic source clear; Standards0/Spec0 findings. Corrected exact head confirmed. Existing safe logger adds admitted run/native identity capture, end-start/end and exit-probe observations; boolean native outcome selects confirmed/incomplete and throw selects unknown while original error survives. No signal/ownership/order/assertion changes. Opt-in pass-through signal and bounded32-target/33-round state observer retain unknowns, dropped counts and joined diagnostic work. Consumer census and file-specific guide checked. A-22397 independently contains owner/signal/state records and one ordinary Node case pass; no historical timeout reproduction or exact-head configured proof inferred from local report/Node footer. C1 and C2 remain unverified: await separately authorized20/20 macOS load>=10 stress evidence and any receipt-supported cause/fix, then same-head mode-free verification. No machine-slot grant or final readiness implied; any source fix needs fresh review. No Reviewer test/native/browser/stress or source edits.

### rev-41 · 2026-11-21T08:11:18.727Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1986-evidence1
commit: 064ad53b2e0e65ccf85898bf97e6dc3518282d7c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Interim evidence audit clear at unchanged source-reviewed064ad53b2e0e65ccf85898bf97e6dc3518282d7c. Source authority remains rev-40 source pass/A-22400; this pass reviews A-22412/A-22410 only. No new findings. Independently parsed all20 attempts.json rows and all20 attempt logs: same exact head, distinct matching generated run ids; each native code0/signalnull, timedOutfalse, capture dropped0, one structured detached-pid-receipts, generated identity tests1/pass1/fail0/cancel0/skip0. Each has owner capture/end/exit-probe records,3–4 observed pass-through signals,28–33 native state sample rounds; droppedReceipts/droppedSignals0. Starts10.18701171875–19.470703125 under enforcing >=10,<20 admission. Platform local macOSarm64 Node24.21, one targeted T3 identity only, no browser. Controller elapsed ranges10189.628–31987.926ms including startup/teardown and excluding pre-attempt load setup; no full-suite or speedup claim.

summary.json records twelve-thread burner PID51742, native SIGTERM close,closedtrue,absenttrue; sampled load maximum19.864746 and pause states retained. Exact20 logs preserve observations independently from native exit. Historical report-wait timeout did not recur; its cause remains unknown, with no product/timing/order assertion change inferred. A-22410 separately retains the earlier native0 attempt with incomplete67,527-byte diagnostic capture at64KiB line cap and19246.000667ms elapsed; excluded from20 rather than admitted as proof. Controller capture correction/restart is reported Coordinator-authorized and does not erase the earlier outcome.

C1 verified from these20 loaded targeted receipts. C2 remains unverified until final evidence settlement: no new failed case to diagnose in this20, and no historical cause inferred. Same-head mode-free configured verification is still pending and this interim evidence pass is not final readiness. Reviewer ran no tests, stress, native probes, browser or edits.

Criteria: C1 verified.

### rev-40 · 2026-11-21T08:35:19.340Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1986-final
commit: 064ad53b2e0e65ccf85898bf97e6dc3518282d7c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. A-22431/afa78492 matches unchanged source-clear head/canonical executable tree: T0/T1/fallbackT2/selectedT3/Web exit0,7282pass/1Mac-only MCP selector skip/0fail/cancel. Independently checked all19 suite-cancel generated finishes, including changed capture/reparent diagnostic assertions and both actual detached-child cleanup cases. OneT3file/base execution, restT3merge batch/T4unexecuted; noncachedLinuxx64c8ams3 Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4; budgets/lint report-only. C1 adopts current rev-41 evidence1/A-22417 complete20/20macOS loaded audit; no duplicate raw campaign audit claimed. Earlier incomplete captureA-22410 retained/excluded, durations not erased. C2 verified from structured producer diagnostics/current synthetic assertion and complete ordinary/campaign receipts: no new failed cancellation occurred, original historical timeout cause remains unknown, no invented cause-driven product/timing fix or assertion relaxation. A-22400 source and A-22417 campaign limits retained. No Reviewer runtime/probes/edits.

Criteria: C1 verified, C2 verified.
