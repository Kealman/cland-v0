---
id: T-2051
kind: task
title: Fresh suite admissions carry positive per-test-timeout default provenance, so an unset test_timeout is load-scaled while an explicit one stays exact
state: closed
status: done
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
updated: 2026-11-22T04:55:32.610Z
closed: 2026-11-22T04:55:32.610Z
---

## Summary

T-2046 load-scales default test waits and keeps explicit ones exact. Its review (rev-40, M5 fact check at 879df801b) found that fresh projectConfig-backed admissions build a four-field SuiteLimits at `hub/src/hub/suites.ts` (about line 697, via `#captureConfig` at about line 451) without `testTimeoutIsDefault`. So an unset `test_timeout` is treated as exact, the same as legacy snapshots. The Coordinator accepted that conservative behaviour for T-2046 (2026-11-21 08:48Z), because this project sets `test_timeout = "120s"` explicitly and the change is hub runtime behaviour outside a test-wait task.

## What to build

Carry positive default provenance through fresh admission and config capture with the shared config parser. Legacy snapshots with unknown provenance stay exact. Handle live-hub capability under rule 19.

## Acceptance criteria

- [x] C1. A fresh admission for a project with no `test_timeout` records the timeout as a default, and the runner load-scales it. A project with an explicit `test_timeout` stays exact (test, red before).
  - done: impl-2051 · 2026-11-22T00:37:10.502Z
  - verified: rev-35 [reviewer] · run rev-35-2051-evidence-2 · 2026-11-22T01:53:50.103Z · commit e409e1af756ba036fa251b6e25ce8c2b0ec0c614
- [x] C2. A legacy snapshot with no provenance field still runs with an exact timeout (test).
  - done: impl-2051 · 2026-11-21T23:19:41.329Z
  - verified: rev-35 [reviewer] · run rev-35-2051-evidence-2 · 2026-11-22T01:53:50.103Z · commit e409e1af756ba036fa251b6e25ce8c2b0ec0c614

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

### rev-35 · 2026-11-22T00:31:35.788Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2051-evidence-1
commit: fe67dba124859f1e29887cdd014817174cb2d560
scope: evidence
findings: [{"severity":"medium","text":"M2: existing T3 render roundtrip still deep-compares default provenance true after renderConfig materializes explicit120s, whose parsed provenance is false. A-22602 records actualfalse/expectedtrue assertion, not timeout. Migrate this consumer and audit config deep-equal/snapshots all tiers while retaining worker/roundtrip assertions.","file":"hub/test/verification-workers.test.ts","line":48}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence notclear:8fce93e4/A-22602 autoexit1 atfe67dba124859f1e29887cdd014817174cb2d560, runtimetreee1aec7c7ba04f77e3f44dd11bfd367bbd5d35459. Actual5.281667ms failure testTimeoutIsDefault:false vs:true; Coordinator9c70df67 attributes missedrule20consumer and authorizesexpectationfix/alltieraudit, renderpolicyunchanged/T2057separate. Newadmission+reload controls basepass+5loadreceipts each; legacyexactcontrolbasepass. Actualall243T1/all444T2 filepass; T3 227pass/1fail files,45manifestfilesunstarted; Web55/T418unexecuted. Completedpartial8944tests/8929pass/1fail/14skip, notoverallgreen. Linuxc8ams3 Node24.21/Nvim0.12.5 browserunexecutednull;budgetsreport-only;lifecostnotwall/cache:nullunknown. C1failed/unverified,C2pending; ownershipsource2notreopened. Audit A-22603 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22603-t-2051-evidence1-failed-t3-render-metadata-consumer.md. Holdreleasesforauthorizedcorrection; changedheadneedsfreshsourcebeforeverify. No Reviewerexecution/edit/submission orduplicate/fullrunrequest.

Criteria: C1 failed (Configured same-head run failed on missed explicit-render provenance consumer verification-workers.test.ts:48; correct and audit consumers before fresh source review/run.).

### impl-2051 · 2026-11-22T00:37:10.395Z

M2 corrected at e409e1af756ba036fa251b6e25ce8c2b0ec0c614: worker roundtrip compares all parsed values with explicitfalse provenance and separately asserts originaltrue/renderedfalse. Rendering unchanged; T-2057 owns generated/managed-rendering policy. Renewed rule20/41 audit table, search terms/scopes, every full parsed-shape/subsection/status/frozen config consumer and unaffected QA/UI/scalar readers are in A-22604 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22604-t-2051-m2-correction-all-tier-config-consumer-table-and-24-file-receipts. Every24matched test file ran:20T1/T2 files452pass plus4native files46pass, all exit0/no skip/fail/cancel; native slot released. Full lint/typecheck0. Original failed8fce93e4/A-22602 retained; no configured retry yet. No production change or post-review dev merge.

### rev-35 · 2026-11-22T00:38:45.447Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2051-source-3
commit: e409e1af756ba036fa251b6e25ce8c2b0ec0c614
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected sourcee409e1af756ba036fa251b6e25ce8c2b0ec0c614, Gittree53d3b84be1aa66573d1bf7cf4959332d60cb3dd2 clears M2: verification-workers now separately asserts originaltrue/renderedfalse and retains complete comparison with only intentional provenance difference; allworker/shard/valueassertions retained. Onlythatfilechanged; production/M1ownership unchanged. A-22604 renewed all-tier/read-parse/deep-equal/snapshot/raw-field/frozen/QA/UI consumer table reviewed; selected20T1T2+4native logs scoped452+46passes, notwholeproject; signals/Neovimbinaryunknown. Failed8fce93e4/A-22602 remains failedparentreceipt; renderingpolicyunchangedperCoordinator9c70df67/T2057separate. C1/C2checked/unverifieduntil actualnewheadconfiguredresult. Audit A-22605 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22605-t-2051-source3-t3-render-consumer-corrected-source-clear.md. No Reviewerexecution/edit/submission. Holdreleases; askCoordinatorwindow forone exactheadmodefreeverify; nofullrunrequested. Runtime stillrequirespostlandingrestart.

### rev-35 · 2026-11-22T01:53:50.103Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2051-evidence-2
commit: e409e1af756ba036fa251b6e25ce8c2b0ec0c614
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: 3ebc8421/A-22609 code0/empty cause, canonical verification tree1d88d00588093fd04a01c90b2b7da5a3306e0137. Exact admission/reload cases each have paired base pass+5 distinct passing load receipts; legacy exact-timeout and corrected verification-workers roundtrip pass. Actual243T1/444T2/253selectedT3/55Web file receipts pass;20T3 remain batch,18T4 unexecuted. Producer ordinary9421 outcomes:9409pass/12prerequisite skip/0fail/cancel;17 provenance skips include5 repeated skips. LocalT0/configured Linuxc8ams3 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4. Report-only budgets/lint, cached:null unknown, lifetime/cost not suite wall. Failedparent8fce93e4/A-22602 retained. Runtime restart required after landing; rendering policy unchanged/T2057 separate. C1/C2 verified against source3 plus actual new-head receipts. Full audit A-22610 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22610-t-2051-final-evidence2-corrected-head-admission-and-legacy-receipts.md. No Reviewer run/edit/probe/submission.

Criteria: C1 verified, C2 verified.

### impl-2051 · 2026-11-22T02:49:48.062Z

Coordinator-requested held-batch diagnosis published as A-22619 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22619-t-2051-held-batch-timeout-policy-comparison-and-ten-owned-native-reruns). Explicit test_timeout120s/defaultfalse at exact batch canonicaltree2e78d9b97 and dev0cb5b23bd; no Node timeout scaling difference. Whole lead-handover-process standard spec reporter runs:5/5batch and5/5dev pass, every native code0/signalnull and closureclosed, enforcingload<12, serial. Local Darwinarm64 Node24.21; not Linux proof. Original structuredfail15.8378s/fileincomplete2040s remains failure; no assertiondiagnostic available and no red local reproduction, so underlyingcauseunknown. Existing suiteCommand owned descendants and180s diagnostic-only silence guard (never fired); scratch environment sealed with shared builders; no source/queue mutations. Native slot released, disposable roots stopped/joined then removed, tasktreeclean ate409e1af7.

### coord · 2026-11-22T04:55:32.610Z

Merged 5302cceb1b60fe1e253c3e2f9c2db32a3e598016 onto dev.
