---
id: T-899
kind: task
title: "Process-helper migration: suite, skills and migration tests"
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-637
branch: t/T-899-process-helper-migration-suite-skills
created: 2026-10-19T19:27:16.714Z
updated: 2026-10-19T20:11:40.425Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/suite-admission.test.ts | T3 | 1 | 0 | 0 | 0 | 0 | 1 | T2 | Admission and baseline rules use in-process projectHub + scripted verification; persistence is store reopen. |
| hub/test/suite-cache-recovery.test.ts | T3 | 1 | 0 | 0 | 0 | 0 | 1 | T2 | Cache identity/mode/report rules use injected receipts and store reopen; no native worker required. |
| hub/test/suite-selection-report.test.ts | T3 | 0 | 1 | 0 | 0 | 0 | 1 | T2 | Selection/transport/report cap rules use scripted verification with projectHub + inProcessSpoke; preserve native runner/coverage integration only in named T3 seam. |
| hub/test/skills-qa.test.ts | T3 | 3 | 3 | 0 | 0 | 0 | 6 | T2 | CLI shell scripts are subjects, using projectHub + inProcessSpoke; move pure catalogue/source assertions to T1. |
| hub/test/v01-migration.test.ts | T3 | 1 | 0 | 0 | 0 | 0 | 1 | T2 | CLI migration remains subject; projectHub replaces startDaemon; preserve rerun/idempotency assertions. |

## Acceptance criteria

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-30 [reviewer] · run rev-20261019-899-migration-source-corrected · 2026-10-19T19:49:06.072Z · commit b511905786ab6a239f85ca8ed42b209ccae475c5
  - verified: rev-30 [reviewer] · run rev-20261019-899-shared-fixture-source · 2026-10-19T20:02:03.597Z · commit 105f4b9db4e93b32d8d6565fabb9f42ccd4a81ac
  - done: impl-899 · 2026-10-19T20:11:10.666Z
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - failed: rev-30 [reviewer] · 2026-10-19T20:11:40.425Z · note Seventeen owned T2 process-resource mismatches in QA/migration CLI proofs; all ordinary/160 repetition assertions pass within budget but approved CLI boundary is missing.

## Comments

### impl-899 · 2026-10-19T19:32:44.140Z

Migration in progress: added an in-process suite component fixture with explicit candidate facts, FakeClock and local executor receipts; moved QA source contracts to T1; separated native package coverage and original Git freeze ancestry/stdout contracts as truthful T3 split-offs. Initial migration CLI, QA script and admission/report component checks pass; final static and retained-native checks follow.

### impl-899 · 2026-10-19T19:37:47.043Z

Committed/pushed c4d33f8e71ae937634db81ef4d5731e26e959b4a after fetch, merge-current origin/dev and successful merge-tree check. Typecheck, tier lint and process-helper lint pass; every assigned file has zero calls, no duration allowance changed. All 32 targeted cases pass functionally, including retained native proofs. A-6440 maps assertions and contains sanitized logs without local timing claims under the active census restriction. Source review requested and hub-queued for the next free live Reviewer; waiting before mode-free exact-head droplet verification.

### rev-30 · 2026-10-19T19:42:26.860Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-899-source
commit: c4d33f8e71ae937634db81ef4d5731e26e959b4a
scope: full
findings: [{"severity":"medium","text":"M1: newly migrated T2 case body is 4.266637 s in quiet-window A-6456, over the 2 s tier budget. Reduce fixture/work at the migration seam while preserving creation, exact identities, rerun equality and atomic duplicate refusal; keep the CLI contract and no allowance/tier promotion.","file":"hub/test/v01-migration.test.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear at c4d33f8e. Full standards/spec audit A-6467. All assertion meanings and two native contracts retained; assigned helper counts zero, only owned lint reductions, no allowance change. All 32 local checks pass, but newly migrated migration case exceeds T2 cost. Correct M1 and request fresh source review before verification. C1 source condition established; C2 exact-head gate and 30 fresh identities' 5/5 load evidence remain pending. Native Linux T3 periodic/integrated, QA none.

Criteria: C2 failed (M1: new T2 migration identity takes 4.266637 s locally against 2 s; correct source before exact-head mode-free/load proof.).

### impl-899 · 2026-10-19T19:47:47.655Z

M1 corrected in b511905786ab6a239f85ca8ed42b209ccae475c5, pushed with clean merge-tree inspection and no post-review dev merge. The real migration executable now uses production runTask for its nested task-command edge; fixture writer seeds only the relevant exact ids. Three independent creation/reuse/duplicate cases retain original assertions and pass 5/5 serial files (15 passes, max body 1.451 s < T2 2 s). Typecheck and test lint pass; no allowance/tier change. A-6494 contains correction/evidence. Fresh delta review requested before Linux verification.

### rev-30 · 2026-10-19T19:49:06.072Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-899-migration-source-corrected
commit: b511905786ab6a239f85ca8ed42b209ccae475c5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear A-6496; M1 resolved through validated sparse identity fixture and real migration executable with production runTask/socket nested edge. Three independent cases preserve all original creation/exactR118R119/rerun-equality/duplicate-atomicity assertions. Raw5serialfiles15/15 bodies all<T2 2s, max1.450557834s. No production/allowance/tier change, unchanged full auditA6467/nativeA6456 retained. C1verified; C2 awaits exact-head mode-free32movedidentities5/5 plus overallgreen/noownedbudget. Old M1 failure historical; QA none.

Criteria: C1 verified.

### impl-899 · 2026-10-19T20:01:21.032Z

First exact-head Linux run 1a1a3dfb/A-6528 failed solely the launch-brief's known verify-tool pair; all 32 T-899 ordinary identities and all 160 load repetitions passed with no owned budget rows. Applied only posted shared fixes a7159290+67a01b6f, now head 105f4b9db4e93b32d8d6565fabb9f42ccd4a81ac. Targeted verify-tool and typecheck pass; pushed after fetch/merge-tree, no dev merge. A-6534 contains extraction and fix evidence. Fresh delta review requested before another mode-free verify; C2 still awaits an overall green exact-head run.

### rev-30 · 2026-10-19T20:02:03.597Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-899-shared-fixture-source
commit: 105f4b9db4e93b32d8d6565fabb9f42ccd4a81ac
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared fixture delta source clear, A-6544: sole verify-tool path exactly matches reviewed T-891 cumulative blob, assertions retained, no task/allowance change. Targeted 3/3 green. Independent prior-head A-6528 audit confirms all 32 moved ordinary identities and all 160 repetition passes within budgets, no owned budget row; only two inherited verify-tool identities failed. Overall old run stays red. C2 requires fresh exact-head overall green plus current-head 32 ordinary/5-per-identity receipts. No native Linux task claim; QA none.

Criteria: C1 verified.

### impl-899 · 2026-10-19T20:11:23.564Z

Exact-head mode-free 9129cfe1/A-6569 is green at 105f4b9d: 1664/1664, no failure/cancellation/skip/TODO. All 32 migrated ordinary cases and all 160 load repetitions pass (192 owned finish receipts); every owned body fits its tier, with no allowance change. Linux c-8 lon1 lifetime451 s cost$0.0313. A-6574 contains canonical receipt extraction and maxima. C1/C2 claimant done marks added; Reviewer final evidence verdict pending. Native cases retain their local green A-6456 and Linux periodic/integrated policy; QA none. Worktree clean, head pushed.

### rev-30 · 2026-10-19T20:11:40.425Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-899-cli-resource-boundary-failed
commit: 105f4b9db4e93b32d8d6565fabb9f42ccd4a81ac
scope: evidence
findings: [{"severity":"medium","text":"M2/C2: A-6569:46411–46427 records seventeen owned T2 child_process mismatches: jq spawnSync probes plus direct qa-record.sh execFile (line36) and migration CLI execFile (v01-migration.test.ts:16). Preserve real CLI assertions but route executable subjects through the approved narrowly scoped CLI boundary; obtain Coordinator-posted support if needed. Report-only green does not waive the documented direct-CLI mismatch.","file":"hub/test/skills-qa.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Final not clear on owned process admission, A-6579. Independently verified A-6569 functional 1664/1664 and all32 migrated ordinary +160 repetition passes within budgets; original M1 cost resolved. Raw resource tripwire records seventeen owned direct CLI/jq process mismatches. Keep actual executable/stdio/exit assertions, use approved narrow CLI-subject support (Coordinator-posted change if necessary), eliminate incidental native probes, retain tripwire; fresh source review then exact-head verification. C2 failed, QA none.

Criteria: C2 failed (Seventeen owned T2 process-resource mismatches in QA/migration CLI proofs; all ordinary/160 repetition assertions pass within budget but approved CLI boundary is missing.).
