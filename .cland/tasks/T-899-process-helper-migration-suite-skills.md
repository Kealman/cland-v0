---
id: T-899
kind: task
title: "Process-helper migration: suite, skills and migration tests"
state: open
status: review
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
updated: 2026-10-19T19:48:10.215Z
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

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - failed: rev-30 [reviewer] · 2026-10-19T19:42:26.860Z · note M1: new T2 migration identity takes 4.266637 s locally against 2 s; correct source before exact-head mode-free/load proof.

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
