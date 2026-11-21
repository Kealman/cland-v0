---
id: T-2051
kind: task
title: Fresh suite admissions carry positive per-test-timeout default provenance, so an unset test_timeout is load-scaled while an explicit one stays exact
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1712
branch: t/T-2051-fresh-suite-admissions-carry-positive
created: 2026-11-21T08:48:57.100Z
updated: 2026-11-21T23:29:09.946Z
---

## Summary

T-2046 load-scales default test waits and keeps explicit ones exact. Its review (rev-40, M5 fact check at 879df801b) found that fresh projectConfig-backed admissions build a four-field SuiteLimits at `hub/src/hub/suites.ts` (about line 697, via `#captureConfig` at about line 451) without `testTimeoutIsDefault`. So an unset `test_timeout` is treated as exact, the same as legacy snapshots. The Coordinator accepted that conservative behaviour for T-2046 (2026-11-21 08:48Z), because this project sets `test_timeout = "120s"` explicitly and the change is hub runtime behaviour outside a test-wait task.

## What to build

Carry positive default provenance through fresh admission and config capture with the shared config parser. Legacy snapshots with unknown provenance stay exact. Handle live-hub capability under rule 19.

## Acceptance criteria

- [x] C1. A fresh admission for a project with no `test_timeout` records the timeout as a default, and the runner load-scales it. A project with an explicit `test_timeout` stays exact (test, red before).
  - done: impl-2051 · 2026-11-21T23:26:47.839Z
- [x] C2. A legacy snapshot with no provenance field still runs with an exact timeout (test).
  - done: impl-2051 · 2026-11-21T23:19:41.329Z

## Comments

### impl-2051 · 2026-11-21T23:11:03.030Z

Consumer inventory before change: ProjectConfig verification is produced by defaultConfig/parseConfig/loadConfig, renderConfig/config-set/provisionConfig, retained by ProjectConfiguration (reload preserves startup timeout), and serialized in SuiteJob/RunRef. SuiteLimits consumers: suiteLimits/source parser, Suites fresh admission + queued capture + recovery/shards/fallback, suite-worker env serialization, executor RunRef and droplet/run CLAND_SUITE_LIMITS export, run-suite runner, suite-command; workers-only suite-shards/territory. Persisted suite-jobs/suite-job records keep optional provenance; legacy absence must remain exact. Tests pinning limits: until, suite-queue-policy, suite-timeouts, suite-command; config deep equality/init/reload/config fixtures searched. Raw field/env/function searches covered hub/src, all hub/nvim/web tiers, QA/docs/skills and frozen cli-usage fixture: no CLI wire/help text change. Existing SuiteLimits field is reused; optional config metadata is additive. Runtime change needs post-landing restart.

### rev-35 · 2026-11-21T23:23:18.576Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2051-source-1
commit: 50903e50d97637625028f83167cab6e282f78bf4
scope: full
findings: [{"severity":"medium","text":"M1: both new callbacks (also config-reload-component.test.ts:101) lack encompassing pre-acquisition/cancellation ownership, separate setup bounds and positive-close gating of root/env/mock/native-guard restoration. Raw suiteUnit/late config stop hooks and unfenced fixtureNativeGuard cover narrower normal cleanup only; migrate both complete callbacks to established owners while retaining assertions.","file":"hub/test/suite-queue-policy.test.ts","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review50903e50d97637625028f83167cab6e282f78bf4 against75390a00eb445174f5ba39f2828fe6735decacb8: one medium consolidated ownership finding across2callbacks, confirmed by lead81a7b4bc/no exclusion. No separate propagation finding: parser defaulttrue/validatedexplicitfalse, shared fresh+queued conversion, legacy absentexact, explicit generated render roundtrips and restart docs appear consistent. C1failed/unverified; C2run-dependent/unverified without source failure. A-22583 authored localfocused65pass and originalT1 2110pass/3fail+twofilereruns remain explicitly scoped, rawredunsaved; no configuredproof. Audit A-22584 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22584-t-2051-source1-ownership-missing-in-new-admission-and-reload-callbacks.md. No Reviewer execution/edit/submission. Correct both after hold release, preserve priorred/failed evidence and finalassertions, request fresh source review before verify; no full run requested.

Criteria: C1 failed (New admission and config reload callbacks need whole-case pre-acquisition/setup/positive-close ownership before their functional provenance proof is safe.).

### rev-35 · 2026-11-21T23:29:09.946Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2051-source-2
commit: fe67dba124859f1e29887cdd014817174cb2d560
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source fe67dba124859f1e29887cdd014817174cb2d560, Gittree3161e47b59fba30fb51bc1e35974083256b85daa clears M1 in bothcallbacks. Admission stageCase owns setup/body, partial+complete suiteUnit required closes, pre-Store DBcapture, deferred/adoptedroot, manual mocks and pre-registered env restoration afterpositiveclose. Reload registersstopbeforeacquisition, separatelyboundssetup/writes/reload and joins before root/control release. All durable/queued reversal/timeout/legacy/original-vs-reloaded assertions retained. Only2testfiles+guide changed since source1; production propagation unchanged. C1/C2 remain checked/unverified until actual same-head configured receipt. A-22585 currentlocal25T2passes/lint/typecheck are authored scoped evidence; A-22583 failedT1/redsourceepochs retained, no full currentT1green or nativeargv claim. Audit A-22586 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22586-t-2051-source2-admission-and-reload-ownership-clear.md. No Reviewer execution/edit/submission. Hold releases; ask Coordinatorwindow forone exact-head mode-freeverify; no full run requested. Runtime stillrequirespostlandingrestart.
