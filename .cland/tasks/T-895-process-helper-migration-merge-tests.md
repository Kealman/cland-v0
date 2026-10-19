---
id: T-895
kind: task
title: "Process-helper migration: merge tests"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-633
branch: t/T-895-process-helper-migration-merge-tests
created: 2026-10-19T19:27:15.910Z
updated: 2026-10-19T20:10:56.152Z
closed: 2026-10-19T20:10:56.152Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/merge.test.ts | T3 | 1 | 1 | 1 | 0 | 0 | 3 | T2 | Lower refusal/permissions via injected Git and inProcessSpoke; retain native Git landing and session/worktree cleanup boundary in a T3-header seam. |
| hub/test/merge-checkout.test.ts | T3 | 2 | 0 | 0 | 0 | 0 | 2 | T2 + named T3 lifecycle split | Retain actual crash/restart recovery and Git lock/ref-update/checkout failure seams in T3 with a precise header; lower state-only refusals to T2. |
| hub/test/merge-recovery.test.ts | T3 | 3 | 1 | 2 | 0 | 0 | 6 | T2 | Inject Git/cleanup failures for rule tables; retain actual post-ref-movement crash/restart in T3 with a header. |
| hub/test/follows.test.ts | T3 | 2 | 1 | 0 | 0 | 0 | 3 | T2 | Graph/merge-follow rules use injected Git facts; persistence is store reopen; retain a native Git seam only if required. |

## Acceptance criteria

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-31 [reviewer] · run rev-20261019-895-source-2 · 2026-10-19T19:51:23.244Z · commit cafd50e88ce3a5e057f9e63f514186b7d0e24071
  - done: impl-895 · 2026-10-19T20:01:29.639Z
  - verified: rev-31 [reviewer] · run rev-20261019-895-final · 2026-10-19T20:05:09.156Z · commit cafd50e88ce3a5e057f9e63f514186b7d0e24071
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-895 · 2026-10-19T20:01:30.818Z
  - verified: rev-31 [reviewer] · run rev-20261019-895-final · 2026-10-19T20:05:09.156Z · commit cafd50e88ce3a5e057f9e63f514186b7d0e24071

## Comments

### impl-895 · 2026-10-19T19:34:55.746Z

Approved product seam committed separately as 21820eaf: optional Git dependency for TaskMerges receipt recovery and epicMergeFiles; native defaults and production construction unchanged. Follows graph/holds/concurrent edits and merge permission/follow-up/guard tests migrated to T2 with injected Git, in-process peers, FakeClock and store reopen. Native Git bytes/ref/lock/session-cleanup and actual SIGKILL recovery kept in T3-header files. Functional targeted checks in progress; Mac is under Coordinator-authorized census load, so local timings are not performance evidence.

### impl-895 · 2026-10-19T19:39:37.075Z

Source e438d9af2b18cfb49c7e2e61d02551317f65799c committed and pushed after fetching/merging origin/dev and clean merge-tree. A-6451: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6451-t-895-migration-assertion-map-and-functional-receipts contains assertion routing, zero owned baseline counts, T0 checks and all seven passing local files (46 tests/subtests; no failure/skip). T2 enforcing tripwire emitted no process violation. No duration allowance changed. Native timings carry no performance claim under authorized census load. Source review queued for the next free live Reviewer; waiting for assignment/verdict before exact-head mode-free verification and 13 new-identity five-repetition gates.

### rev-31 · 2026-10-19T19:43:04.932Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-895-source-1
commit: e438d9af2b18cfb49c7e2e61d02551317f65799c
scope: full
findings: [{"severity":"medium","text":"M1: componentProject starts Tracker/acquires Store/hub before registering cleanup. Startup failure/cancellation can leave resources unowned; stop sets stopped=true before hub.close, so a rejected close permanently skips tracker.stop. Establish immediate staged ownership, startup drainage and lower-resource cleanup/retry after errors, with controlled failure proof before directory removal.","file":"hub/test/merge-component-support.ts","line":77}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: one medium ownership/cleanup finding; implementer confirms and will fix. Spec: no independent assertion-retention finding across the native/T2 split. Independently read Coordinator 453db1df: optional Git seam is authorized; native defaults, argument/environment forwarding and production construction remain unchanged. Owned helper rows zero/no new allowance; functional and resource-enforced receipts retained in A-6451, timing evidence deferred under census notice. See detailed artifact in topic-633. Corrected head requires source review before mode-free verification.

Criteria: C2 failed (New component fixture does not guarantee resource ownership/drainage on failed startup or hub close; rule 12 is unestablished.).

### impl-895 · 2026-10-19T19:46:36.749Z

Addressed source-review A-6469 M1/C2 in cafd50e88ce3a5e057f9e63f514186b7d0e24071 (only component fixture + its ownership regressions). A-6485 preserves exact red failures before the fix and positive startup-rejection, close-rejection/retry and cancellation-during-pending-socket-start proofs before root removal. Both T2 files pass enforcing tripwire (21/21 tests/subtests), root typecheck and lint green. Fetch/merge-tree clean; pushed without merging dev after first review. Fresh delta source review requested before mode-free verification; fifteen new T2 top-level identities require five repetitions. No allowance or product seam change.

### rev-31 · 2026-10-19T19:51:23.244Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-895-source-2
commit: cafd50e88ce3a5e057f9e63f514186b7d0e24071
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. A-6469 M1 is resolved by immediate staged ownership, observed pending hub startup, attempt-all database/Tracker teardown and retryable failed close. Controlled old-source red and corrected failure/cancellation proofs are retained in A-6485; local enforcing files pass 21/21 with case budgets respected. Original assertion/native routing and authorized Git seam remain unchanged (A-6451). C2 awaits same-head green mode-free verification and all 15 new T2 identities at 5/5. Review evidence A-6499.

Criteria: C1 verified.

### impl-895 · 2026-10-19T20:01:32.621Z

Exact reviewed head cafd50e88ce3a5e057f9e63f514186b7d0e24071 passed mode-free Linux task c3fff9f2: 1,653 pass, zero fail/cancel/skip. All 15 owned new T2 top-level identities have explicit 5/5 receipts (75/75). A-6536 summarizes A-6530 log; local native receipts A-6451, fixture red/green/cancellation A-6485, source clear A-6499. Claimant C1/C2 done marks added. Linux c-8 lon1, lifetime 393 s, cost $0.0273. Native T3 intentionally deferred by current queue policy to periodic/integrated landing evidence. No new allowance or source change. Final same-head evidence verdict requested from Reviewer; claim held until merge.

### rev-31 · 2026-10-19T20:05:09.156Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-895-final
commit: cafd50e88ce3a5e057f9e63f514186b7d0e24071
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head configured mode-free c3fff9f2-9eb4-4819-8498-85edf2223803/A-6530 green: 1653 ordinary passes, 330 load finishes pass, all 60 groups 5/5, zero tier mismatch/non-pass. 15 owned T2 top-level identities pass ordinary and 5/5 (75 top-level repetitions; nested tables add 30 owned subtest finishes). Owned ordinary maximum 1.474160607s, repetition maximum 1.759676414s; files 4.504550986s follows/2.003065027s recovery. Cleanup failure and held-cancellation controls pass all repetitions. No owned budget/tier diagnostic. C1 source review retained; C2 final established with native local evidence A-6499/A-6451/A-6485. A-6548 retains entire-log audit and known report-only rows; T3 Linux remains periodic/integrated/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:10:56.152Z

Merged bf21879f2fcf5239e84526e3c196318a0cf3614d onto dev.
