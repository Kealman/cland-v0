---
id: T-2052
kind: task
title: Bring T-1987's 1500-answer work-only startup case under its 5 s budget, or renew its C-216 allowance, before it expires on 2026-11-28
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1709
branch: t/T-2052-bring-t-1987-s-1500-answer-work-only
created: 2026-11-21T08:56:13.794Z
updated: 2026-11-23T01:09:13.393Z
closed: 2026-11-23T01:09:13.393Z
---

## Summary

T-1987 added `hub/test/startup-listener-scale.test.ts` › "1500 startup freshness answers keep summary hydration and dependent work linear". It measured 8.039 s on a Linux droplet (run 84066c69, A-22444), with a worst retained sample of 10.278 s (A-22429), against a 5 s per-test budget. The Coordinator approved a 15.418 s allowance owned by C-216. The parser allows a non-legacy owner seven days, so it expires on 2026-11-28. An expired allowance fails every suite.

## What to build

Make the work-only case fit 5 s without weakening its census, for example by sharing the fixture's setup or reducing setup cost rather than the 1,500-answer scale. Or renew the allowance with fresh samples before it expires. Act before 2026-11-26.

## Acceptance criteria

- [x] C1. Either the case passes under its 5 s budget on a Linux droplet with its census assertions unchanged, or the allowance is renewed with an expiry at least seven days out and a reason citing fresh samples (evidence).
  - done: impl-2052 · 2026-11-23T00:08:26.334Z
  - verified: rev-35 [reviewer] · run rev-35-2052-evidence-2 · 2026-11-23T00:40:04.414Z · commit 2e530b83e64362289086b599d6f7a1820aee633c

## Comments

### impl-2052 · 2026-11-21T18:08:51.505Z

Fixture-only change disables SQLite synchronous flushing in the work-only case; census and 1500 scale unchanged. Local samples in A-22536; Linux C1 proof pending post-review verify. No shared contract or policy changed; no production/T1 consumer reached.

### rev-35 · 2026-11-21T18:12:16.622Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2052-source-1
commit: 98531b7eb6468bd5090dcfebb8c091c92d0be92c
scope: full
findings: [{"severity":"medium","text":"The new openDatabase wrapper opens a native connection before the new fallible synchronous pragma, without capturing that connection in a pre-registered positive-close owner. If pragma rejects before return, projectHub/constructor cleanup has no handle. Capture before pragma and retain a rejected-pragma cleanup control preserving the primary reason and root/guard until closure.","file":"hub/test/startup-listener-scale.test.ts","line":77}]
finding_counts: {"high":0,"medium":1,"low":0}

Initial source review at98531b7eb6468bd5090dcfebb8c091c92d0be92c against fixed merged-dev based1b803566bd0a651207d1619ae4351d4def19685. One medium Standards finding M1, confirmed by lead d95a73f6; no approved exclusion. Scale1500 and all census/publication/completion assertions are unchanged; measured listener keeps defaultsync; onlytest+guide changed. C1 Linux<5s remains unverified; A-22536 localMac timing is notLinux proof. Audit A-22538 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22538-t-2052-source1-pre-pragma-sqlite-ownership-gap.md. No Reviewer execution/source edit. Correct M1 after hold release, retain original assertions and request fresh source review before mode-free verification; no full run requested.

Criteria: C1 failed (New fixture pragma can reject after opening an unowned SQLite connection; close ownership/control must be corrected before Linux verification.).

### rev-35 · 2026-11-21T18:19:05.649Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2052-source-2
commit: de05a18e2f57b7f54be09bf36ed2fcc0164966e1
scope: full
findings: [{"severity":"medium","text":"M1 residual: stopHub handoff is outside the bounded hub-setup producer. If observation expires and projectHub returns later, assignment never runs; after join ownedDatabases closes live hub connections before its later disposer. Install the handoff inside retained producer before return and keep a controlled late-return ordering regression.","file":"hub/test/startup-listener-scale.test.ts","line":157},{"severity":"medium","text":"M2: the new rejected-pragma control's asynchronous root acquisition uses step without a separately named owner.wait setup deadline. stageCase retains work but does not supply that observation bound.","file":"hub/test/startup-listener-scale.test.ts","line":40}]
finding_counts: {"high":0,"medium":2,"low":0}

Corrected-source review de05a18e2f57b7f54be09bf36ed2fcc0164966e1; two medium gaps confirmed by lead34416847. Pre-pragma DB capture itself now correct, but late acquisition still misses disposal-before-close. Census/1500 scale/listener defaults unchanged. Audit A-22546 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22546-t-2052-source2-late-hub-handoff-and-setup-bound-gaps.md separates Standards/Spec and retains authored A-22540 red/intermediate failure/green limits. C1 unverified; Coordinatorcd2591a4 renewal plan depends on fresh Linux sample and later final allowance review. No Reviewer execution/edit/submission. Correct both after hold release and request fresh source review before sampling verify; no full run requested.

Criteria: C1 failed (Correct the late-return hub disposal handoff and separately bound the new control's root setup before configured Linux sampling.).

### rev-35 · 2026-11-21T18:24:27.732Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2052-source-3
commit: c226f9c48431b6489d1204bdf6e88b814ce5f7f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source c226f9c48431b6489d1204bdf6e88b814ce5f7f0 (Git tree1e068e5fb75036b88877271984ea2f9e23f247c6) is clear for Linux sampling. M1 resolved: shared censusResources.acquire installs disposal handoff inside retained producer before return; held-return control expires observation and verifies disposal while DB open then positive closure. M2 resolved: both controls have separately named bounded root setup. Pre-pragma connection capture and all1500/census/final assertions remain intact; listener synchronization stays default. Onlytest+guide changed; no manifest/production/policy change. C1 remains unverified/unchecked pending actual Linux sample and Coordinatorcd2591a4's authorized renewal, later narrow source review and final-head verification. Local A-22548 selected3 Mac T3 passes/red-before limits are notLinux or full-file proof. Audit A-22549 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22549-t-2052-source3-ownership-corrections-clear-linux-sampling-pending.md. No Reviewer execution/edit/submission; no full run requested. Ask Coordinator window for one mode-free sampling run at this exact head.

### rev-35 · 2026-11-21T18:56:51.343Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2052-evidence-1
commit: c226f9c48431b6489d1204bdf6e88b814ce5f7f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Sampling evidence only: run8ae71246/A-22556 at reviewedc226f9c48431b6489d1204bdf6e88b814ce5f7f0 is green for actual T0/all243T1/all444T2/8selectedT3/all55Web; remainingT3batch,T4unexecuted. Canonicaltreeaafb8a0d4daf2ea93541f4663863849e5d1ab44f differs from Gittree1e068e5fb75036b88877271984ea2f9e23f247c6. Four required cases have matching start/pass finishes: work11.377711638s, listener16.648331425s, rejectedpragma0.005177622s, latehub0.003534665s; census1500/3003/25888/0 retained. Producer7407pass/1skip/0fail/cancel, no under5s claim. Linuxc8ams3 Node24.21/Nvim0.12.5 HeadlessShell1248/Chrome156.0.8078.4; budgetsreport-only; selected8files104identities126.956s phasewall excludeswait, baseonly. C1 remains unchecked/unverified pending authorized diagnosis and budget/renewal branch. Coordinator42ef2ed6 now keepsC216, diagnoses both cases under grantednative/load<12, renewal onlyon/afterNov23 ifneeded, deadlineNov26; emittedE880stanzas are not authorization. Audit A-22557 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22557-t-2052-sampling-evidence1-exact-linux-receipts-c1-pending.md. No Reviewer execution/edit/submission. Hold releases for authorized diagnosis; changedhead needs source review before verify, no duplicate/full run requested.

### impl-2052 · 2026-11-21T19:00:39.715Z

A-22556 configured Linux sampling at c226f9c48 passed T0/all T1/all T2/8 selected T3/Web; remaining T3 batch, no T4, budgets report-only. Work 11.377711638 s, listener 16.648331425 s. A-22558 diagnosis found disposal ~7 ms; batched retained-index seed experiment still 3.720558 s locally, no path to roughly 2 s. Experiments discarded; reviewed head clean. Coordinator decision 278c0e92: retain head; renew both cases under C-216 on/after 2026-11-23 using fresh Linux sample, land before 2026-11-26. Awaiting that date/window; C1 incomplete.

### coord · 2026-11-21T19:00:40.424Z

Coordinator decision (2026-11-21): the work-only case can't reach 5 s on Linux. It runs about 2.7 times slower there than on macOS, and the measured floor is about 3.7 s on macOS (A-22558: hub acquisition about 1.35 s, plus about 2 s of freshness and publication). On 2026-11-23, take a fresh Linux sample through a mode-free verify at the reviewed head c226f9c48. Then renew both cases under C-216: work-only (last sample 11.38 s, run 8ae71246) and listener (16.65 s, over its 13.599 s allowance). Size each at 1.5 times the worst sample, with a seven-day expiry. After that, a narrow review, a final-head verify and the merge before 2026-11-26. The current allowance expires on 2026-11-28 and would fail every suite.

### hub · 2026-11-23T00:02:03.957Z

Merge-delta assessment (report-only)
{"reviewed":"c226f9c48431b6489d1204bdf6e88b814ce5f7f0","head":"a189257d3774f2688a226ec49dad4a28b9f1676e","dev":"0a75e76680f9ca831b94346d347ec113e3d453cf","mergeBase":"d1b803566bd0a651207d1619ae4351d4def19685","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/agents/tests/hub-test-startup-listener-scale.test.ts.md","hub/test/startup-listener-scale.test.ts"],"devPaths":[".agents/skills/implement/CHANGES/T-2050-ready.md",".agents/skills/implement/CHANGES/T-2051-admission-provenance.md",".agents/skills/implement/SKILL.md",".agents/skills/merge/CHANGES/T-2053-red-baseline.md",".agents/skills/merge/CHANGES/T-2055-readiness.md",".agents/skills/merge/SKILL.md",".cland/tasks/E-1888-verification-and-flow-improvements-from.md",".cland/tasks/T-204-incident-log-lost-suite-runs-and-stalled.md",".cland/tasks/T-2042-one-day-median-of-sharded-covers-and.md",".cland/tasks/T-2049-a-qa-verdict-s-task-comment-reply-counts.md",".cland/tasks/T-2050-an-item-turns-ready-on-a-clear-evidence.md",".cland/tasks/T-2051-fresh-suite-admissions-carry-positive.md",".cland/tasks/T-2052-bring-t-1987-s-1500-answer-work-only.md",".cland/tasks/T-2053-one-red-full-t3-batch-fences-every-t3.md",".cland/tasks/T-2055-merge-admission-accepts-a-task-without-a.md",".cland/tasks/T-2056-enqueue-timing-check-refuses-a-literal.md",".cland/tasks/T-2057-cland-init-writes-an-explicit-test.md",".cland/tasks/T-2058-test-import-graph-discovery-stops-on.md",".cland/tasks/T-2059-renew-or-retire-the-five-c-216-duration.md",".cland/tasks/T-2060-lead-handover-process-test-ts-a.md",".cland/tasks/T-2061-the-periodic-dev-t3-run-executes-t2-t3.md","docs/agents/issue-tracker.md","docs/agents/tests.md","docs/agents/tests/hub-test-merge-queue-unit.test.ts.md","docs/agents/tests/hub-test-merge-queue.test.ts.md","docs/agents/tests/hub-test-suite-queue-policy.test.ts.md","docs/agents/tests/hub-test-suite-stage-cover.test.ts.md","docs/agents/tests/hub-test-tracker-summary.test.ts.md","docs/agents/tests/index.md","docs/evidence/T-2050-ready-consumers.md","docs/evidence/T-2055-merge-consumers.md","docs/hub/running.md","hub/README.md","hub/src/cli/usage/merge.ts","hub/src/hub/daemon.ts","hub/src/hub/dispatch.ts","hub/src/hub/enqueue-timings.ts","hub/src/hub/merge-queue.ts","hub/src/hub/merge.ts","hub/src/hub/suite-history.ts","hub/src/hub/suites.ts","hub/src/init/config.ts","hub/src/merge.ts","hub/src/suite-limits.ts","hub/src/tracker/freshness.ts","hub/src/tracker/tracker.ts","hub/src/verification-commands.ts","hub/src/verification-plan.ts","hub/test/config-reload-component.test.ts","hub/test/executor-safety-config.test.ts","hub/test/fixtures/cli-usage/commands.json","hub/test/harness.ts","hub/test/init-config.test.ts","hub/test/merge-batches.test.ts","hub/test/merge-queue-unit.test.ts","hub/test/merge-queue.test.ts","hub/test/ready-verification-fixture.ts","hub/test/suite-persistence.test.ts","hub/test/suite-queue-policy.test.ts","hub/test/suite-remote-budget.test.ts","hub/test/suite-stage-cover.test.ts","hub/test/tracker-summary.test.ts","hub/test/until.test.ts","hub/test/verification-workers.test.ts","shared/wire/index.ts"],"overlap":[],"dependency":{"status":"known","importers":["hub/test/startup-listener-scale.test.ts"]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-2052 · 2026-11-23T00:08:53.850Z

Renewal head 2e530b83e: all seven C-216 allowances dated 2026-11-23 through 2026-11-30, sized from 30 completed passing Linux samples across five unique recent runs including A-22630. Evidence A-22631 and docs/evidence/T-2052-duration-renewal.md; no baselines/policy changes. Config-pin/checker files 48/48 total; full lint and typecheck pass. C1 done via renewal; source review requested, final-head mode-free verify still pending.

### rev-35 · 2026-11-23T00:13:40.588Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2052-source-4
commit: 2e530b83e64362289086b599d6f7a1820aee633c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev integration plus renewal source clear. Mergea189257d3 parents reviewedc226f9c48/dev0a75e7668; fixture bytes unchanged from A-22549. Final delta modifies seven existing allowance entries and matching guides/evidence only; baselines/budget/report policy unchanged. All C-216 Nov23–30; independently scanned30 completed named T3 samples across5unique runs, matching start/pass finishes. A-22625/28 byte-identical same batch counted once. All caps equal ceil(1.5x worst to ms), worstA-22630; that periodic run remains code124/run timeout75m, not a whole-run pass. Caps23.902/33.185/6.939/7.381/9.566/8.367/46.784 follow Coordinatorbcbec646. Local config-pin48pass, lint/typecheck and grouped production report/enforce replay are author-attested transcript-only; raw local logs not retained per answer47f8a020, not independently claimed as configured evidence. C1 done/unverified pending actual final-head mode-free result. Audit A-22632 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22632-t-2052-source4-integrated-seven-day-renewals-source-clear.md. No Reviewer execution/edit/submission; hold releases for Coordinator window, no full-suite request.

### rev-35 · 2026-11-23T00:40:04.415Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2052-evidence-2
commit: 2e530b83e64362289086b599d6f7a1820aee633c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head configured11ac38da/A-22633 code0/empty cause, canonical verification tree2f05c3cb3ea22756e133dcf82e6dedb865ff8561. Paired exact cases pass: work8.399221155s, listener12.560696668s, rejected-pragma0.004073875s, late-hub0.004966691s, stage17.598326248s. C1 verifies the C-216 Nov23–30 renewal branch from source4/A-22632 plus actual final-head admission, not under5s optimization. Four other renewed identities unexecuted here retain historical30-sample sizing proof; A-22630 stays timed out overall. Actual243T1/444T2/10selectedT3/55Web file passes;263T3 batch,18T4unexecuted. Hub aggregate7450tests/7449pass/1skip/0fail/cancel; raw7452 pass finishes kept separate due three existing finish-only output entries (A-22331 carried F2/C-325), not a new T2052 finding. Linuxc8ams3 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4; report-only timing/lint, cached:null unknown; life/cost not wall. A-22634 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22634-t-2052-final-evidence2-same-head-renewal-verified.md records exact scope/limits. No Reviewer execution/edit/submission or extra run requested.

Criteria: C1 verified.

### coord · 2026-11-23T01:09:13.393Z

Merged 0e0f6c8771cb8fb0e5600243ffc460be1fc7de41 onto dev.
