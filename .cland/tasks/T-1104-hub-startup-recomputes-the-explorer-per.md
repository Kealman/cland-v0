---
id: T-1104
kind: task
title: Hub startup recomputes the explorer per item during the planned check and delays serving by 15 s
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-850
branch: t/T-1104-hub-startup-recomputes-the-explorer-per
created: 2026-10-22T10:11:00.318Z
updated: 2026-10-22T15:52:05.298Z
closed: 2026-10-22T15:52:05.298Z
---

## Summary

Hub restart #43 at dev 7887f694 (2026-10-22 10:08Z) took 20 s from stop to serving, against 4–5 s at #40–#42. In .cland/log/hub.log, between "binding listeners" (10:08:48.71Z) and "restoring sessions" (10:09:03.93Z) the hub logged `tracker-storage-stalled {"operation":"planned check","item":"E-413","thresholdMs":5000}` and 755 `explorer-recomputed` events, one per tracker item about 15 ms apart, and serving waited for them. New since #42: T-1054 (marks store), T-1056 (thread runs store) and T-1057 (ask outcomes). The startup planned check appears to recompute the explorer once per item instead of once per batch. Measured by cland-impl.

## Acceptance criteria

- [x] C1. A hub start on a copy of the live tracker recomputes explorer summaries once per startup batch (or lazily), not once per item: a regression counts recompute events on a thousand-item fixture with a planned epic (test).
  - done: impl-1104 · 2026-10-22T15:44:51.421Z
  - verified: rev-26 [reviewer] · run rev-20261022-1104-final-1 · 2026-10-22T15:45:46.524Z · commit bec96d238f4709d3cd976c4f4a12f4bb260a54d6
- [x] C2. The startup planned check does not block serving: a test that starts the hub on a thousand-item fixture with a planned epic asserts serving within 2 s of listening, and its targeted run receipt (test name, platform, measured gap) is posted in the item topic (test).
  - done: impl-1104 · 2026-10-22T15:44:51.489Z
  - verified: rev-26 [reviewer] · run rev-20261022-1104-final-1 · 2026-10-22T15:45:46.524Z · commit bec96d238f4709d3cd976c4f4a12f4bb260a54d6

## Comments

### coord · 2026-10-22T13:23:38.319Z

Recurred at restart #44 (dev fae121ec, 2026-10-22 13:22Z, cland-impl): tracker-storage-stalled {"operation":"planned check","item":"E-413"} from 13:22:08.869Z to 13:22:24.19Z, so 15.3 s between "binding listeners" and "restoring sessions". This time there were 1,626 explorer-recomputed events (755 at #43) and 77 queue-ttl drops, against nearly unchanged tracker size. So the recompute count scales with something besides item count, perhaps verdicts or marks per item. Stop to serve was 20 s again. The Claude Code bridge expires at a 60 s gap, so a few more doublings would break restarts.

### coord · 2026-10-22T15:07:18.737Z

Correction to my 13:23Z comment, from impl-1104's read-only parse of the live log. The recompute count did not double. Restart #43 had 1,609 recomputes over the whole start and 754 between binding listeners and restoring sessions; #44 had 1,623 and 759. I compared #43's binding-only count with #44's whole-start count. The stall itself is real and stable at about 15 s. The cause is freshness announcements recomputing the explorer once per row (Freshness.refresh → tipsMoved → per-row announce → ExplorerFieldsIndex flush), not the planned check named in the stall log. impl-1104's batched patch takes the copied tracker from 830 recomputes to 3.

### impl-1104 · 2026-10-22T15:13:29.488Z

Diagnosis: read-only JSON event analysis shows comparable binding-to-restore counts 754 (#43) and 759 (#44), with full startup counts ~1,600 for both; reported doubling mixed windows. Copied canonical tracker produced 830 recomputes with no planned status writes. Captured stack: Freshness.refresh → Tracker.#tipsMoved → #announce → #projected → ExplorerFieldsIndex.flush. New T2 regression first failed at 1,002 recomputes. Batched freshness source refresh now bounds startup to four initialization batches on the 1,000-row fixture. Planning is deferred through the existing ready-check startup barrier. A write-gate regression first failed `planned writes start after serving` with deferral absent, and now proves serving before the gate plus a status reply while planning is held. No live hub restart or socket read. Targeted receipt and final source head to follow.

### rev-23 · 2026-10-22T15:20:45.513Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1104-source
commit: 54b7c6d58ae01800911af1cd757d720562bfd6cc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at 54b7c6d58ae01800911af1cd757d720562bfd6cc/tree 21df8489f0c5a3b64f94bd0b6eceed15a09cc606 from fixed base d1f74352. Batched source/ancestor refresh precedes explorer flush; existing per-item publication/pending guards/readiness retained. Planned checks defer behind existing startup readiness barrier and resume after daemon serving; stop semantics preserved. New T2 counted thousand-row fixture and separately bounded unscaled 2 s serving receipt/held planning-write/status/committed planned status checks are appropriate; gate release precedes hub teardown. Diagnostic/docs changes match source, no wire/role/dependency changes, zero Standards/Spec findings. A-9198/topic targeted 4 batches/19.357 ms are reported local measurements, not original configured receipts or enforcing-budget evidence; copied-live diagnostic is sealed scratch/fake-probe evidence. C1/C2 final marks await exact-head mode-free receipt and new-test load proofs. No Reviewer execution or T3/T4/QA pass claim.

### impl-1104 · 2026-10-22T15:21:59.519Z

Source review clear at 54b7c6d58ae01800911af1cd757d720562bfd6cc (rev-20261022-1104-source, A-9199), zero findings. Mode-free verification f8231202-c882-4bd5-b992-6476aef6e6e1 failed before runtime execution: `droplet size c-8 unavailable in regions lon1, nyc1, sfo2` (A-9200). T1/T2/Web observed tests and platform unavailable; projections are not passes. Executor blocker sent to lead T-1104 for a capacity/size/region decision; no override, merge or source change.

### rev-23 · 2026-10-22T15:26:30.707Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1104-capacity-evidence
commit: 54b7c6d58ae01800911af1cd757d720562bfd6cc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence-only not clear for f8231202/A-9200 and 96387fb9/A-9201: both report `auto exit 1; droplet size c-8 unavailable in regions lon1, nyc1, sfo2`. Host npm run check completed; runtime T1/T2/Web counts, platform and measurements are unavailable. Projections are not observations. No source findings; A-9199/source clear remains applicable at unchanged 54b7c6d5. Coordinator-authorized local replacement 1f7a1213 is running, not yet evaluated. Final C1/C2 settlement awaits that receipt; this historical failure record does not require code changes or cancel the replacement.

Criteria: C1 failed (A-9200/A-9201 failed provisioning; configured runtime recompute/load evidence unavailable, not an assertion failure.), C2 failed (A-9200/A-9201 failed provisioning; configured serving-gap/load evidence unavailable, not an assertion failure.).

### rev-23 · 2026-10-22T15:34:01.840Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1104-web-evidence
commit: 54b7c6d58ae01800911af1cd757d720562bfd6cc
scope: evidence
findings: [{"severity":"medium","text":"Required executed Web phase fails /S1/ assertion on the E-416 row; cause/relation to this task remains undiagnosed.","file":"web/test/items.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

e6cc0c43/A-9219 at unchanged source-clear 54b7c6d5 is not clear: actual `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /S1/` at web/test/items.test.ts:30; E-416 row has no S1. Local Darwin arm64, Node24.21.0/Neovim0.12.5, two workers: 2444 pass/1 fail, T1/all-T2 both packages exit0, actual Web exit1. Both startup identities pass and each has five distinct load proofs plus explicit5/5; four batches and 23.962ms listening-to-serving. Whole-test 3.095/2.610s report-only overages do not invalidate the 2000ms behavioral bound. Earlier A-9206 passed T1/T2 but Web did not run; A-9200/A-9201 provisioning failures remain historical. Source clear remains; no unrelated/flaky classification or retry inferred. Final C1/C2 clearance awaits failure disposition and accepted evidence.

Criteria: C1 failed (Final configured evidence is red: A-9219 Web Items snapshot /S1/ assertion fails; startup batch/load passes retained.), C2 failed (Final configured evidence is red: A-9219 Web assertion fails; 23.962 ms serving gap and startup 5/5 retained.).

### rev-26 · 2026-10-22T15:37:59.575Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1104-source-2
commit: bec96d238f4709d3cd976c4f4a12f4bb260a54d6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized shared-fix delta source clear; A-9234 incorporates rev-23's source audit A-9199 and exactC1/C2. Coordinator da3c70d4 independently read: merge eacb0e27, no branch-local test edit. Only changed non-tracker file is web/test/items.test.ts; blob5c716efb matches donor exactly. Test now owns planned epic/task under copied current release, retaining stage/meter/member/scope assertions and all subtests. Startup production/regression/docs unchanged. Standards0;Spec0. Historical A-9219/A-9225 stay failed; localtarget4/4/typecheck is supporting, not merged-head configured proof. C1/C2 await mode-free receipt with actual batching/serving boundary and required load proofs. Executor selection/fallback stays under Coordinator standing instruction, no Reviewer execution or QA claim.

### rev-26 · 2026-10-22T15:39:56.595Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1104-capacity-evidence-2
commit: bec96d238f4709d3cd976c4f4a12f4bb260a54d6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-9239 audits original A-9237/874169b9. Exact pre-runtimec-8 capacity unavailable inlon1,nyc1,sfo2; host check output retained132/59report-only/zero refusals. Runtime counts/platform unavailable, projections not test observations; no startup assertion failure established. Configured acceptance remains unavailable/not clear, C1/C2 unverified; no criterion failure marks for unexecuted tests. Source-clearbec96d23 remains valid. Already-admitteda725df64 local replacement is separate and Coordinator-authorized, not Reviewer-authorized.

### rev-26 · 2026-10-22T15:45:46.524Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1104-final-1
commit: bec96d238f4709d3cd976c4f4a12f4bb260a54d6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; A-9253 audits originalA-9251/a725df64 at unchangedsource-clearbec96d23/treea491a774. LocalDarwinarm64 Node24.21/Nvim0.12.5,workers2:T0check,T1/allfallbackT2hub+Neovim/actuallyexecutedWeb exit0,2448ordinarypass/zero fail/cancel/skip. C1 diagnostic6731=4startupbatches/1000rows;C2 diagnostic6843=29.528ms listening→serving under unscaled2000ms, held-planning/status/committed-state assertions retained. Both newidentities have5distinct loadtestpasses plus explicit5/5 at7593/7604. Whole-test2.411/2.715s tier overages report-only, not serving-gap failures. Web sharedfixture parent/subtests pass; actualWeb27.59s. Standards0;Spec0;lint132/59/zero refusals/report-only,two missing baselines. No Linuxruntime,T3/T4,fullcover/QA claim. Historicalcapacity andold/S1/failed receipts retained;qaPolicy none.

Criteria: C1 verified, C2 verified.

### impl-1104 · 2026-10-22T15:46:20.921Z

Ready at bec96d238f4709d3cd976c4f4a12f4bb260a54d6: final review clear rev-20261022-1104-final-1 (A-9253), C1/C2 verified. Same-head mode-free local macOS arm64 run a725df64 (A-9251) passed T0/all T1/fallback all T2 + executed Web, 2448/2448; startup count four batches, serving gap29.528ms, both new tests5/5 load. Report-only whole-test overages2.411/2.715s retained per Coordinator instruction; no Linux/T3/T4/enforcing-budget claim. Cloud capacity refusals A-9200/A-9201/A-9237 retained; earlier shared Web fixture failure resolved through Coordinator eacb0e27 and fresh delta review. Ready reported to Coordinator; claim retained; no merge or live hub restart.

### coord · 2026-10-22T15:52:05.298Z

Merged 0f9d78c1fa0ed98fd8f0acaa358037c3b242809f onto dev.
