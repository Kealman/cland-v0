---
id: T-1929
kind: task
title: Runner and tier durations use wall-clock time, so a system clock correction mid-run distorts recorded durations
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1797
branch: t/T-1929-runner-and-tier-durations-use-wall-clock
created: 2026-11-17T02:20:03.376Z
updated: 2026-11-26T20:59:55.035Z
closed: 2026-11-26T20:59:55.035Z
---

## Summary

Runner and tier wall-clock duration accounting uses wall-clock timestamps, so a system clock correction mid-run distorts recorded durations. In A-15180 a 4430.512 s forward wall-clock jump made a run's recorded duration 5023.49 s while Node measured 592.875 s (impl-1576, T-1576 topic-1578). Durations should use a monotonic elapsed clock.

## Acceptance criteria

- [x] C1. Runner, tier and suite duration figures come from a monotonic elapsed clock; a fake wall-clock jump during a run leaves the recorded durations unchanged (test, red before the fix).
  - done: impl-1929 · 2026-11-26T20:02:23.202Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-1929-final · 2026-11-26T20:03:21.981Z · commit e307490f1a760d5e53cc773147fb2c1ad7a73521
- [x] C2. Timestamps shown to people (start and finish times) stay wall-clock, and the duration manifest and budget readers are unaffected or migrated (rule 20 consumer list in the item).
  - done: impl-1929 · 2026-11-26T17:48:14.308Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-1929-final · 2026-11-26T20:03:21.981Z · commit e307490f1a760d5e53cc773147fb2c1ad7a73521

## Comments

### impl-1929 · 2026-11-25T14:24:26.810Z

Rule 20 consumer audit: searched duration producer strings (suite duration, shard duration, tier_seconds), verificationStepCommand/verificationStepResults, suite timing/timingReceipts and taskDurationReport across hub, web, nvim, docs, shipped skills and fixtures. Producers migrated: hub/test/run-suite.ts package suite/shard/lock/machine-wait/selected duration-check/Web phase durations; verification-plan.ts tier shell wrapper; hub/suites.ts host T0. Existing Node reporter duration_ms, load-gate performance.now and manifest/projected budgets already measure elapsed or project recorded samples. Readers unchanged: suiteSummary and suite-recovery, verificationStepResults and merge-batches (decimal grammar already supported, including old integer lines), suite-tier-report timingReceipts, suite-duration-budget, suite-durations, durations.ts refresh, spawn-census report, store/history, remote status/timing receipt readers and redaction. Frozen cli-usage commands.json and shipped help exports unchanged; no skill, QA brief, startup probe, wire field or persisted record schema changed. Retained fixtures with integer and decimal tier/suite lines remain supported. Coordinator scope decision in topic-1797: process-local execution producers only; cross-restart/machine sharded overall wall, queue wait/run metrics and billing remain wall intervals, now labelled in output/docs. Web and Neovim queue ages/ETAs consume unchanged runMs/waitMs timestamps; no execution duration calculation there. C2 timestamps (holder since, starts, finished/done and UTC remote runner start) remain wall time.

### rev-35 · 2026-11-25T14:33:57.393Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1929-source-1
commit: 2de65f2e7d18aa3596c88af2208235d5c4841fb0
scope: full
findings: [{"severity":"medium","text":"M1: both runner-jump callbacks and verification-commands.test.ts:21 host fixture use step-only acquisition/body under one whole-case wait. No separate named setup/action observations or exclusion exists. Retain whole-case ownership/fences and exact timing assertions; add independent setup and behavior receipt bounds with shared setup headroom.","file":"hub/test/suite-command.test.ts","line":53},{"severity":"medium","text":"M2: awk %.3f inherits numeric locale, while verificationStepResults accepts only dot decimals. Locale-aware/POSIX awk can emit a comma and lose the completed tier's structured result. No locale guarantee/control exists. Make only the formatting boundary locale independent and preserve old/new reader grammar.","file":"hub/src/verification-plan.ts","line":77}]
finding_counts: {"high":0,"medium":2,"low":0}

Not clear; A-23483 records both axes and the consolidated two-finding bar. Process-local monotonic migrations and Coordinator-approved cross-machine wall labels otherwise remain in scope; no persisted-receipt redesign requested. Fix separate observations in both jump cases/host case and locale-independent tier decimal output with reader compatibility proof. Preserve fake seams, positive native guard/cleanup and final exact duration assertions; no native subprocess campaign requested. Precise M1 setup sites are suite-command:53 and verification-commands:21 (artifact cites surrounding callback lines). Audit hold released for corrections; spending/slot restrictions remain. Fresh corrected-head source review precedes configured verification.

Criteria: C1 failed (New runner/host clock regressions lack separately bounded setup and behavior observations.), C2 failed (The new locale-dependent tier decimal producer can emit a format rejected by the unchanged duration reader.).

### impl-1929 · 2026-11-25T14:38:41.912Z

Source review corrections at d342a25b2: M1 separately names and bounds setup and completion/close observations through shared load-scaled testSetupWaitMs/testDeadlineMs, retaining whole-case ownership. M2 removes awk and computes/formats tier seconds in the second emitted Node monotonic-clock program using locale-independent toFixed(3); test checks emitted 2.500 under hostile locale metadata and feeds that exact output plus legacy integer 2 into verificationStepResults. No schema, timestamp, configured-command locale, budget mode or cross-machine scope change. Existing consumer list remains valid. A-23485 preserves A-23481 and A-23483 earlier evidence and records repeated 151 selected passing cases, full typecheck and full test:lint exit 0 on local macOS arm64 Node 24.21.0. No configured verification submitted.

### rev-35 · 2026-11-25T14:39:32.422Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1929-source-2
commit: d342a25b2a6dcddc53d1af22e2688226fbf9e375
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23486 records the full correction review. M1 resolved by separate named shared-budget setup/completion observations inside retained whole-case owners. M2 resolved by locale-independent emitted Node toFixed(3) formatting, with actual emitted decimal and legacy integer reader controls; configured-command locale stays intact. Monotonic producer migrations, wall timestamps, schema compatibility and approved cross-machine wall labels retained. No findings. C1/C2 remain done/unverified pending configured same-head result and final audit. Audit hold released; spending pause through00:00UTC and subsequent Coordinator window remain. No additional local campaign requested.

### rev-35 · 2026-11-26T01:31:24.921Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1929-evidence-1
commit: d342a25b2a6dcddc53d1af22e2688226fbf9e375
scope: evidence
findings: [{"severity":"medium","text":"M1: Three configured T3 failures expose unmigrated integer-only raw duration readers. executor-run:248/249 and suite.test.ts:468/469/471/508 require duration \\\\d+ s and reject the supported new dot decimals. Migrate these readers, preserving command/exit/output-tail/config-pinning assertions and legacy integer compatibility (rules20/41).","file":"hub/test/executor-run.test.ts","line":248}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear; A-23516 audits failed same-head runab29abb2/A-23515. Producer result code1/cause empty: T0/T1/T2 complete exit0, selected T3 complete exit1; Web unexecuted. Literal failure: 'AssertionError [ERR_ASSERTION]: The input did not match the regular expression /tier T1: exit 0; duration \\d+ s; output tail: recorded-test/' against 'tier T1: exit 0; duration 0.034 s; output tail: recorded-test'. Python check and integrated occasion likewise reject0.067/0.039s. Source review missed these raw readers; no load/environment cause inferred. Four clock controls pass base+5/5 load, but whole run remains failed; C1 unverified, C2 failed. Preserve red receipt, apply the scoped reader migration after lead/Coordinator handling, then request fresh corrected-head source review before any retry. Audit hold released; no automatic rerun/native probe.

Criteria: C2 failed (Configured T3 fails three cases because raw test consumers still require integer-only tier durations instead of the new dot-decimal output.).

### impl-1929 · 2026-11-26T01:32:42.365Z

C2 audit correction from failed run ab29abb2 / A-23515 and review A-23516: the original consumer list missed six integer-only raw-reader assertions in executor-run.test.ts:248,249 and suite.test.ts:468,469,471,508 (last is a dynamic T1-T4 RegExp). Migrated their numeric expectation to the existing integer/dot-decimal grammar, preserving each exit, output tail, command/config fact, and task/batch/occasion execution-journal assertion. Repeated literal and escaped-string format searches across hub, nvim, web, docs, shipped skills and fixtures find those six plus the already-compatible verification-commands assertion and production verificationStepResults grammar; legacy integer fixtures are unchanged. This corrects the earlier claim that every test consumer was unaffected. Source change is prepared; native slot for the three failed existing cases and lint slot have been requested, not granted. No tests or configured rerun started.

### impl-1929 · 2026-11-26T17:48:14.960Z

At e307490f1, all three previously failed existing native cases passed separately on local macOS arm64 Node 24.21.0 under the granted native slot, exercising all six migrated raw-reader assertions. No full native file or configured run is claimed. Full npm run typecheck and full npm run test:lint passed after native slot release; zero lint refusals and baseline advisories retained. A-23546 preserves failed A-23515 / review A-23516 and records these newly scoped observations. No production source or dev merge after the prior reviewed head; only six consumer assertions and matching test guidance changed. Fresh source review requested before asking for an authorized configured retry window.

### rev-40 · 2026-11-26T17:52:11.761Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-1929-source3
commit: e307490f1a760d5e53cc773147fb2c1ad7a73521
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23549 records Standards and Spec review, zero findings. All six integer-only raw consumers now accept integer/dot-decimal seconds with correct dynamic RegExp escaping; exact exits, output tails, config pinning and execution journals remain. Consumer census and both guides corrected. Earlier named setup/completion ownership, monotonic accounting and locale-independent emitted formatter remain intact. A-23546's three exact-head targeted macOS native cases and static checks are scoped evidence, not configured verification. C1/C2 remain unverified pending fresh authorized same-head configured receipt and final audit. Prior ab29abb2/A-23515 remains failed; partial clock controls do not clear that run. Hold released; no extra local campaign requested.

### rev-40 · 2026-11-26T19:14:17.999Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261126-1929-evidence2
commit: e307490f1a760d5e53cc773147fb2c1ad7a73521
scope: evidence
findings: [{"severity":"medium","text":"E1: producer143/75-minute timeout, incomplete package closure; T0–T3 complete0 but Web interrupted with five unfinished identities, preventing final configured clearance.","file":".cland/artifacts/A-23578-suite-934e3201-5cd5-4a8b-8f2d-ba4a7c9be96e-auto-at-e307490.log","line":53786}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23585 records same-head 934e3201/A-23578. Producer143/deadlineExpiredtrue, primary run timeout75m, secondary package closure incomplete/machine deletion required. T0/T1/fallbackT2/selectedT3 complete0, Web incomplete; five producer unfinished identities retained, runningSeconds0 not a duration measurement. Four clock controls base+5/5 pass and all three previously failed native consumer cases pass, exercising six migrations. No clock/reader assertion failure inferred. C1 final configured gate failed; C2 migration positive subproof retained but final mark pending. Canonical1be52414 executable match; noncached Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156,12 prerequisite skips, budgetsreportonly. Prior ab29abb2 stays failed. Hold released; Coordinator-authorized unchanged-head retry4f69dd7c admitted/pending, not pass evidence. No Reviewer execution.

Criteria: C1 failed (Final configured 934e3201 timed out with incomplete package closure and unfinished Web; clock controls and migrated reader cases pass as scoped subproof.).

### rev-40 · 2026-11-26T20:03:21.981Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-1929-final
commit: e307490f1a760d5e53cc773147fb2c1ad7a73521
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23609 audits4f69dd7c/A-23607 at source-reviewed e307490f1. Producer0/cause empty/unfinished[], complete T0/T1/fallbackT2/selected251T3/Web exit0, canonical1be52414 executablematch. Four exact clock controls base+5/5 pass, original red-before-fix observations retained at their heads. All3 previously failed native cases pass, exercising six migrated readers; accounting/summary/budget compatibility passes retained. Wall timestamps/approved interval scope unchanged. Linuxc16nyc1 workers4 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156 noncache,12prerequisite skips, budgetsreportonly. RemainingT3batch/T4unexecuted. Prior reader-failed ab29abb2 and timeout934e3201 remain failed, not upgraded. C1/C2 verified, no findings. Hold released; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T20:59:55.035Z

Merged b3e3f89e8f005a19ee08b76dc19ea4e63da3b175 onto dev.
