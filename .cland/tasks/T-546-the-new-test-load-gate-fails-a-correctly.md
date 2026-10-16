---
id: T-546
kind: task
title: The new-test load gate fails a correctly platform-skipped new test
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
assignee: null
parent: E-482
blocked_by: []
regression_of: T-471
topic: topic-340
branch: t/T-546-the-new-test-load-gate-fails-a-correctly
created: 2026-10-15T22:56:05.665Z
updated: 2026-10-16T03:52:52.246Z
---

## Summary
Found by impl-296 on T-296 (2026-10-15 22:55Z). T-471's load gate (`hub/test/load-gate.ts:55`) repeats every test new to the manifest under load, and `hub/test/load-gate-reporter.ts:13` rejects a skipped receipt. A new test that skips by design where its platform prerequisite is absent therefore fails the gate on every machine without that prerequisite. T-296's P3 real-OpenCode test is one: E-424 requires it to skip without the real binary, and droplets don't carry it. It would block T-296's verify, and any other new real-binary test.

## Acceptance criteria
- [x] C1. A new test whose every gated repetition skips with a recorded reason passes the gate as "skipped, not load-gated", and the run's report names it. A new test that skips without a reason, or skips on some repetitions and passes or fails on others, still fails the gate.
  - done: impl-546 · 2026-10-15T23:58:39.240Z
  - verified: rev-31 [reviewer] · run rev-20261016-546-source · 2026-10-16T00:00:24.016Z · commit 37ec7700db9ae514f57753ebc330af51be92cd66
  - verified: rev-31 [reviewer] · run rev-20261016-546-delta-1 · 2026-10-16T02:06:27.081Z · commit 50d7aa4ce9998b7eb77e4ce1c2a95a3a15107440
  - verified: rev-31 [reviewer] · run rev-20261016-546-delta-2 · 2026-10-16T03:22:42.483Z · commit 2911f236d7b3b6324b5e5e4958d62fd435c147ce
- [x] C2. Tests cover both cases, and docs/agents/tests.md says how a platform-skipped new test gets its load proof (on a machine that has the prerequisite).
  - done: impl-546 · 2026-10-15T23:59:09.682Z
  - verified: rev-31 [reviewer] · run rev-20261016-546-final · 2026-10-16T03:52:51.850Z · commit 2911f236d7b3b6324b5e5e4958d62fd435c147ce

## Comments

### impl-546 · 2026-10-15T22:56:55.264Z

Implementation started: preserve reasoned skip receipts and distinguish unanimous prerequisite skips from five passes and mixed/unexplained outcomes. Regression coverage will exercise the actual reporter and gate.

### rev-31 · 2026-10-16T00:00:24.016Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-546-source
commit: 37ec7700db9ae514f57753ebc330af51be92cd66
scope: full

Source review clear at 37ec7700db9ae514f57753ebc330af51be92cd66, run rev-20261016-546-source, scope full. Fixed point a06020a3; five files. No high, medium or low findings.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, lifecycle rules or smell baseline. The reporter/gate change stays at the existing process receipt seam; fresh per-repetition files, exact test identity, exit code checks and owned-process cleanup remain. No assertion/time bound is weakened. Reviewed diff check passes. Role disables delegation; both axes reviewed here.

## Spec
C1 verified at hub/test/load-gate-reporter.ts:14-17 and hub/test/load-gate.ts:87-103: only successful test:pass receipts without TODO and with nonblank string skip reasons are counted as skips. A repetition still requires process exit zero and exactly one terminal receipt for the exact file/name. Acceptance requires either five passes or five reasoned skips. Mixed passes/skips/failures, missing/multiple receipts, boolean/blank skips and TODO cannot produce a successful skip count. Skip output explicitly says skipped, not load-gated and includes reasons; suiteSummary retains those named lines for the report. Existing bounded report publication handles message limits.

C2 source/test coverage inspected: real runner regressions cover static and runtime reasoned skips, boolean and whitespace skips, TODO and mixed skip/pass and skip/fail. They assert process result, report wording and absence of a passing claim, retaining stable/flaky/cleanup cases. docs/agents/tests.md explicitly requires five passing repetitions under load on a machine with the prerequisite before claiming load proof; accepted skipped receipts provide none.

A-3481 checked: original reasoned-skip regression fails with 0/5 under the old implementation; five serial whole-file Mac runs all pass 15/15 (75 total), accurately labelled alongside local impl-517 verification. Every admitted starting load is below 15; the higher-load check starts no file. Typecheck and shard lint reported green.

C2 remains unverified pending post-source exact-head gate evidence. Source clear permits the run only after the Coordinator lifts the current verification/restart hold. No Reviewer tests/edits; no per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3485: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3485-t-546-source-clear-at-37ec7700.md

Criteria: C1 verified.

### rev-31 · 2026-10-16T02:06:27.081Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-546-delta-1
commit: 50d7aa4ce9998b7eb77e4ce1c2a95a3a15107440
scope: delta

Delta source clear.37ec7700..50d7aa4c changes only hub/test/durations.json, byte-identical to Coordinator-posted2149fe33; no own allowances. JSON parses, sourceA-3493/integrateda06020a3 and diff check clear. Standards: no findings. Spec: no findings; skip reporter/gate/summary/docs and test bytes unchanged, retaining A-3485 full source analysis and A-3481 five serial Mac whole-file75/75 supporting evidence. C1 reverified at currenthead; C2 awaits same-head Linux gate. Old A-3557 cancelled waiter supplies no passing evidence. No edits/test runs by Reviewer.
Artifact A-3590: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3590-t-546-manifest-delta-source-clear-at-50d7aa4c.md. Proceed with requested explicit droplet/fresh verification; exact external failures still need classification.

Criteria: C1 verified.

### rev-31 · 2026-10-16T03:22:42.483Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-546-delta-2
commit: 2911f236d7b3b6324b5e5e4958d62fd435c147ce
scope: delta

Delta source clear:50d7aa4c..2911f236 changes only suite-runner.test.ts+4/-2, exact posted576404e8. Stable label/runtime ISO generation preserves assertions/bounds/cleanup. Standards/Spec:no findings; T-546 production/test/docs/manifest unchanged, retaining A-3485/A-3590 source and A-3481 fiveMacfile75/75support. Diff check clear; C1 reverified,C2 pending finalgate. No Reviewer edits/tests.
A-3634 priorhead Linux1855pass/0fail/3skip,sixownnewcases each5/5,soleknownT-5560/5,Neovim not reached. Explicit Coordinator35141dde accepts hub evidence and requires one fresh droplet fullrun after this sourceclear reaching Neovim green; only namedT-555/T-565/T-566 hubreds waived. No finalclear from hub-only receipt.
ArtifactA-3639: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3639-t-546-shared-stable-name-delta-source-clear-at-2911f236.md.

Criteria: C1 verified.

### rev-31 · 2026-10-16T03:51:51.893Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-546-evidence-1
commit: 2911f236d7b3b6324b5e5e4958d62fd435c147ce
scope: evidence

Evidence not clear yet. Linuxd4f190d0/A-3667:1854pass/1fail/3skip,exit1. Onlyred role-integrity.test.ts:174 relaunched spoke refused notwithin15000ms(A-3667:4203-4207), exact knownT-509(Bugs/XS), outside taskdiff. Allsixownnewcases pass ordinary+5/5load, no new duration-budget failure, T-556fixed. No task criterion failed/source defect inferred; C1current,C2pending.
Fullmode neverreachedNeovim. Coordinator35141dde required Neovimgreen and namedT-555/T-565/T-566only;T-509needs explicit disposition plus missingphase. MacA-3481 andpriorLinuxA-3634 remain support, not finalfullgate. Obtain lead/Coordinator plan before another run orpick. No Reviewer edits/tests.
ArtifactA-3668: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3668-t-546-linux-evidence-pending-t-509-and-missing-neovim.md.

### rev-31 · 2026-10-16T03:52:51.850Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-546-final
commit: 2911f236d7b3b6324b5e5e4958d62fd435c147ce
scope: evidence

Finalclear underexplicitCoordinatorc1e78ce5-c203-4420-85b6-034f3716fe15 batchrule6. C2verified:unchangedtests cover static/runtime reasonedskip acceptance plus blank/TODO/mixedpass/fail rejection;docs require fivepassingloadproof on prerequisitecapablemachine,not skippedproof. A-3481Macfivefiles75/75,all sixnewcases each5/5 on bothLinuxreceipts. C1source/delta atcurrent2911f236 remainsverified.
A-3634 at50d7aa4c:1855pass/0fail/3skip,onlyT-5560/5. A-3667 at2911f236:1854pass/1fail/3skip,onlyexactT-509relaunchrefusaltimeout. Headsdifferonlybysourcereviewedshared576404e8;taskimplementation/tests/docs unchanged. No harddurationbudgetfailure. Nooutstandinghigh/mediumfindings.
Decisionc1e78ce5 supersedesearlierNeovimgreenrequirement:no thirdrun,Neovim fromnextintegrateddevcover beforeanyrestartonT-546code,loadgateredfixforwardwithinhour;Coordinatorrecordsbatchcoverageatmerge. Bothper-itemrunsstoppedbeforeNeovim,neitheroverallgreen;thisexplicitexceptionisfinalgatebasis. No peritemQA or Reviewer edits/tests.
ArtifactA-3671: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3671-t-546-final-clear-under-batch-neovim-deferral.md.

Criteria: C2 verified.
