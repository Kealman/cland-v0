---
id: T-896
kind: task
title: "Process-helper migration: plan and stage tests"
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
topic: topic-634
branch: t/T-896-process-helper-migration-plan-and-stage
created: 2026-10-19T19:27:16.095Z
updated: 2026-10-19T19:47:12.272Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/plan-approval.test.ts | T3 | 4 | 2 | 1 | 0 | 0 | 7 | T2 | Approval/inbox/lane rules with injected adapters and store reopen; retain native first-turn authorization only in contract/scenario. |
| hub/test/plan-gate.test.ts | T3 | 1 | 2 | 0 | 0 | 0 | 3 | T2 | Tracker/QA/ancestor rules and migration recovery use projectHub + store reopen and inProcessSpoke. |
| hub/test/planned-stage.test.ts | T3 | 3 | 4 | 0 | 0 | 0 | 7 | T2 | Stage rules use injected Git, projectHub and inProcessSpoke; reopen the store for persistence. |
| hub/test/epic-close.test.ts | T3 | 0 | 2 | 0 | 0 | 0 | 2 | T2 | QA freshness and tracker close gates with projectHub, injected Git facts and inProcessSpoke. |

## Acceptance criteria

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - failed: rev-31 [reviewer] · 2026-10-19T19:40:57.502Z · note New shared planStageHub can leak active fixture resources on startup/cleanup failure; writer-drainage before directory removal is not guaranteed.

## Comments

### impl-896 · 2026-10-19T19:34:47.376Z

Implemented all four files at T2 using projectHub/injected fake adapter for approval and composed Tracker/socket seams for stageTree/writeGate (not exposed by projectHub), injected Git graph facts, inProcessSpoke, FakeClock, store reopen and production TaskMerges with injected squash/cleanup. All 36 cases have passed functional local checks; these timings are not evidence during T-775's load census. Completing source/lint assertion audit before review.

### impl-896 · 2026-10-19T19:35:32.136Z

All 36 cases passed functional local checks after migrating four files to T2. Approval uses projectHub + fake adapter; stageTree/writeGate require composed in-process Tracker/socket fixtures because projectHub does not expose those seams. Git graph facts, inProcessSpoke, FakeClock, store reopen and production TaskMerges with injected publication/cleanup replace native setup. Shrink tool yields empty baseline maps for all four files. Adding in-process title suffixes ensures every moved identity receives five task load repetitions. Local timing evidence deferred during T-775 load census.

### impl-896 · 2026-10-19T19:38:09.330Z

Committed/pushed 069d6c0d69e93a770c585683df630c6d4d449031 after fetch + up-to-date origin/dev merge and clean merge-tree. A-6443 holds the assertion map, 36 functional passes, root typecheck/tier/policy receipts and census-load timing caveat. Source review requested from Reviewer in topic-634; exact-head mode-free verify follows clear source verdict. No QA policy/criteria require a separate brief.

### rev-31 · 2026-10-19T19:40:57.502Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-896-source-1
commit: 069d6c0d69e93a770c585683df630c6d4d449031
scope: full
findings: [{"severity":"medium","text":"M1: Tracker starts and several startup awaits run before onCleanup(stop) is registered; failure/cancellation can leave writers/sockets unowned before root deletion. The chained stop also skips tracker/journal cleanup after an edge/hub close rejection. Establish immediate staged ownership, drain pending startup, and attempt every acquired resource cleanup with a controlled failure/held-startup proof (rule 12).","file":"hub/test/plan-stage-fixture.ts","line":81}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: one medium lifecycle/ownership finding in the shared fixture; implementer confirms and will revise. Spec: no independent assertion-retention finding across all 36 cases, including QA/path freshness, interrupted migration, late receipt binding, SQL bounds and publication conflict controls. Four process-helper baseline rows are zero, no native Git or new allowance. A-6443 functional receipts remain valid as functional-only evidence under Mac load notice, not timing proof. See complete source audit artifact in topic-634. No verification at this head; replacement needs fresh source review.

Criteria: C2 failed (New shared planStageHub can leak active fixture resources on startup/cleanup failure; writer-drainage before directory removal is not guaranteed.).

### impl-896 · 2026-10-19T19:43:41.381Z

Fixed M1 from A-6457 at pushed head 6abbb6778fedbc7e18931596a919fef3227447a9: staged beforeDirectories ownership, cancellation-safe acquisition, and draining teardown with aggregated errors. New T2 regression covers startup throw, held cancellation and close failure with stop/drain receipts before root removal. A-6471 contains red/green proof and quiet-window serial file passes (37 total), typecheck and lint. Fresh source review requested; no verification started or dev merge performed.
