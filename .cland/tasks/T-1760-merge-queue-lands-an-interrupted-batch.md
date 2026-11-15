---
id: T-1760
kind: task
title: Merge queue lands an interrupted batch on failing-file reruns without running the files the interruption skipped
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - needs-triage
  - ready-for-agent
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1527
branch: t/T-1760-merge-queue-lands-an-interrupted-batch
created: 2026-11-07T18:46:18.179Z
updated: 2026-11-15T18:01:48.836Z
closed: 2026-11-15T18:01:48.836Z
---

## Summary

A merge batch whose suite stops at its first failure, and whose failing file then passes in reruns, is landed as "flaky failing files" even though the files after the interruption never ran. Batch f5c21caf (T-1739 + T-1742) stopped at a T-1732 flake in `transport-forwards`: "completed before interruption: tests 3361", against about 3500 in a full T1+T3 run. The hub reran only `transport-forwards` three times, all green, and landed both members on tree 2bd36e16. The unexecuted part included `nvim/test/qa.test.ts`, which T-1739 breaks deterministically. Dev went red, and the next batch (T-1737, 887b1de7, A-17603) failed on it.

## Evidence

- Batch f5c21caf: run ac27deb5, A-17562 ("completed before interruption"); file jobs 57b21131, 707b0dba and 209a3386 green; diagnosis notice "flaky failing files; landing tree 2bd36e16"; landed T-1739 69cdf36a and T-1742 f405478e.
- Batch 887b1de7: run 9e2c9d61, A-17603, at f909f827: `nvim/test/qa.test.ts` ROLES fixture fails on T-1739's `pool: 'local'`. Fixed in T-1759.

## Acceptance criteria

- [x] C1. A batch run that was interrupted lands only after every selected file the interruption skipped has run green at the landing tree. Reruns of the failing file alone never suffice.
  - done: impl-1760 · 2026-11-15T14:53:59.155Z
  - verified: rev-35 [reviewer] · run rev-35-1760-final-1 · 2026-11-15T15:39:31.971Z · commit a4596490b422db9d654c860f70a849c59f9b0a8a
- [x] C2. The diagnosis notice lists the skipped files and the run that covered them.
  - done: impl-1760 · 2026-11-15T15:11:41.574Z
  - verified: rev-35 [reviewer] · run rev-35-1760-final-1 · 2026-11-15T15:39:31.971Z · commit a4596490b422db9d654c860f70a849c59f9b0a8a
- [x] C3. A test drives an interrupted batch whose failing file passes on rerun while a later skipped file fails: the batch does not land, and the skipped failure is named.
  - done: impl-1760 · 2026-11-15T14:53:59.349Z
  - verified: rev-35 [reviewer] · run rev-35-1760-final-1 · 2026-11-15T15:39:31.971Z · commit a4596490b422db9d654c860f70a849c59f9b0a8a

## Comments

### impl-1760 · 2026-11-15T14:49:02.611Z

Rule 20 consumer sweep before notice changes: merge-batches.ts owns persisted MergeBatch/BatchDiagnosis; dispatch.ts projects diagnosis unchanged into merge-batch-result detail; protocol.ts/shared/wire expose only MergeBatchStatus subset. CLI merge.ts, suite-tier-report.ts, Neovim/web queue/status and Agents generic notice renderers do not parse diagnosis text. Tests: merge-batches.test.ts (controller), merge-queue.test.ts (socket notices/status), suite-progress/hung/component (interruption receipts), suite planning/selection tests; QA briefs and shipped merge/implement/qa skill references inspected. Keep existing wire fields; add optional persisted confirmation/skipped evidence only, generic text notices remain compatible. Existing T0/Web full confirmation is a separate guard and explains the plausible precedent path; file-only non-Web path currently bypasses it. Plan: require original pinned full plan after every successful diagnosis, conservatively covering legacy logs without completion receipts.

### rev-35 · 2026-11-15T15:01:51.180Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1760-source-1
commit: bb78c1ce618ff5f7ebed16d3208a623e155ee942
scope: full
findings: [{"severity":"medium","text":"MERGE_USAGE changes without refreshing frozen commands.json; cli-usage-compatibility deep-equality deterministically mismatches. Refresh the owning fixture, retaining the guard.","file":"hub/src/cli/usage/merge.ts","line":2},{"severity":"medium","text":"Added suffix breaks hubReference's anchored bare-pointer reader and excludes the entire merge-queue landing-report guide. Restore bare pointer and place prose outside its line.","file":"hub/README.md","line":91},{"severity":"medium","text":"Confirmation uses phase rebuild, colliding with a later genuine rebuild notice for the same batch/run under dispatch's stable IDs. Give confirmation a distinct phase or fold it into the suite notice; prove both messages survive.","file":"hub/src/hub/merge-batches.ts","line":197},{"severity":"medium","text":"Skipped inventory ignores positive type=file completion envelopes with zero child tests, falsely reporting execution absent, and pending known-empty renders unknown while confirmation renders none. Preserve file receipts and empty/unknown distinctions consistently.","file":"hub/src/hub/merge-batches.ts","line":222}]
finding_counts: {"high":0,"medium":4,"low":0}

A-19727 completes all nine changed paths and both axes. Standards3medium/Spec1medium, all four confirmed by lead. Always-reform pinned full-plan path, optional legacy state, restart/config pinning, later-red refusal and migrated old tests otherwise inspected; no extra finding. A-19726 transcribed red/79green chronology/native/publication limits retained;83 normalized textual rows match tiers, not full transitive execution; indirect/nonmatched roots need conservative accounting on correction. C1/C3 final pending; C2 failed on source. Hold released for consolidated fix and fresh review before configured verification. No Reviewer producer/native/queue/compiler/lint/browser/census/cleanup action.

Criteria: C2 failed (Skipped-file notices misclassify positive file envelopes and known-empty inventory; confirmation also collides with rebuild notice identity.).

### impl-1760 · 2026-11-15T15:05:20.181Z

Consolidated review correction: frozen MERGE_USAGE consumer refreshed, bare README index restored, notice IDs centralized in batchNoticeId shared by dispatch and idempotent fake sink with separate confirmation phase, and suiteProgress adds opt-in fileEnvelopes while its default output stays exactly compatible. Additional direct suiteProgress callers found: suites.ts interruption aggregation, batch-flakes.ts, dev-t3-probe.ts, soak-quarantine.ts, suite-progress.ts interruptionLines, run-suite.ts, suite-runner.test.ts, durations-runner.test.ts. All keep default behavior; only merge diagnosis opts in. Native/default callers remain unexecuted locally. Complete manifest-root unknown/deferred accounting will supplement A-19726 without shrinking its 83-row union. Local focused correction red: completed empty file was falsely listed skipped; final control passes and preserves both confirmation and real rebuild under production stable ID policy. No dev merge after first source review.

### rev-35 · 2026-11-15T15:09:48.001Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1760-source-2
commit: 1ac9df08210f103eeb303b4fc0444f1dece181e6
scope: full
findings: [{"severity":"medium","text":"packageShards can succeed with zero cland test paths for a generic custom test command, falsely setting skipped=[]/none despite unknown selected files. Require positive supported planner/selection capability before enumerating; otherwise keep null/unknown and still run pinned full confirmation. Add a fake generic-project control.","file":"hub/src/hub/merge-batches.ts","line":229}]
finding_counts: {"high":0,"medium":1,"low":0}

A-19729 completes full branch/eleven-path correction pass. All original four findings fixed: frozen help bytes, bare pointer/positive guide inclusion, shared stable notice IDs with distinct confirmation, file-envelope opt-in/default compatibility and consistent rendering. One newly checked custom-command capability boundary remains, confirmed e84fc2e4; Standards0/Spec1medium. Original full-plan/restart/legacy behavior otherwise intact. A-19728 preserves83rows and all982manifest roots normalized, none missing; graph/runtime/provenance/80green+targeted final test limits retained. No configured/native/browser claim. C2 failed; C1/C3 final pending. Hold released for correction/fresh review before verification. No Reviewer runtime/queue/compiler/lint/provenance run.

Criteria: C2 failed (Custom-command receipts can be reported as known-empty skipped inventory without positive file-planner capability.).

### rev-35 · 2026-11-15T15:13:32.194Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1760-source-3
commit: a4596490b422db9d654c860f70a849c59f9b0a8a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-19731 at clean a4596490b/treeac974317. Complete three-path correction resolves A-19729: inventory uses original nonempty admitted tierPlan; absent/empty/custom plans remain null/unknown, no current-tree re-globbing. Generic fake control checks unknown in both notices and no landing until full confirmation; known-empty positive-file envelope control retained. All prior help/pointer/notice/parser findings remain fixed; no findings either axis. A-19730 red/81green/typecheck are qualified transcribed dirty-candidate evidence, not queued/native receipts. Full A-19728 original83/all982 root union retained, no graph/execution upgrade. C2 source resolved; final C1-C3 pending exact-head mode-free configured receipt. Hold released; changed head needs fresh review. No Reviewer runtime/native/queue/compiler/lint/provenance action.

### impl-1760 · 2026-11-15T15:37:54.355Z

Exact reviewed-head verification receipt: run 5bddbc5c-dff9-4672-8a51-b8be43ba2d9d / A-19735, head a4596490b422db9d654c860f70a849c59f9b0a8a, tree 19563b877033201227c22f66071378eec0ba9d10. Noncached Linux x64 6.8.0-147-generic droplet, Node24.21.0, Neovim0.12.5, workers2. T0/T1/fallback-all-T2/Web completed exit0: 6380/6380, no failures/cancellations/skips/todo. T3/T4 not run; T3 remains merge-batch evidence. Browser provenance: Chromium Headless Shell build1248, Google Chrome for Testing156.0.8078.4. New custom unknown inventory, empty-file receipt + real rebuild, interrupted later-file exit0/exit1, opt-in parser legacy shape and indexed-guide cases have explicit passing finish receipts in A-19735 (not inferred only from exit status). Duration gates remain report-only, including merge-batches file14.118s >10s; no allowance added. Droplet lifetime1337s, cost$0.0929. Source unchanged; final Reviewer C1-C3 settlement pending.

### rev-35 · 2026-11-15T15:39:31.971Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1760-final-1
commit: a4596490b422db9d654c860f70a849c59f9b0a8a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-19736 at unchanged clean source-reviewed a4596490b. Independently streamed A-19735:6380ordinary test/700file positives; separate240load test/file positives, zero negatives. Every selected220T1/425T2/55Web file passes. All six new control identities base1+load5, all30 loads joined to positive file envelopes; merge-batches81/progress8/usagecompat/indexedguide and related mergequeue/clauses positive. C1full-plan/selection/restart, C2notice/inventory capability and C3later-red no-landing verified. Exact LinuxNode24.21/Nvim.12.5/Headless1248CfT156 noncached provenance matches. T1file>10s warning/report-only lint/budgets retained, no performance/enforcement clearance. Original83/all982 union and unknowns preserved;265T3/17T4/non-test-native/parent occasions deferred. Old transcribed/candidate/scanner limits not retrofitted. Hold released; Coordinator landing separate; no Reviewer runtime/livequeue/native/census/cleanup/merge.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-15T18:01:48.836Z

Merged 30d4477fa006d8772f0b1df933eb66fccb4ee591 onto dev.
