---
id: T-896
kind: task
title: "Process-helper migration: plan and stage tests"
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
topic: topic-634
branch: t/T-896-process-helper-migration-plan-and-stage
created: 2026-10-19T19:27:16.095Z
updated: 2026-10-19T20:31:33.184Z
closed: 2026-10-19T20:31:33.184Z
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

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-31 [reviewer] · run rev-20261019-896-source-3 · 2026-10-19T19:54:36.180Z · commit 1da66b9244b14d4424d74f1c06f13e4bd1c774eb
  - verified: rev-31 [reviewer] · run rev-20261019-896-source-5 · 2026-10-19T20:11:37.028Z · commit 5aabffb7c5b94b0774e727c334c01b4740017098
  - done: impl-896 · 2026-10-19T20:21:29.915Z
  - verified: rev-31 [reviewer] · run rev-20261019-896-final · 2026-10-19T20:21:42.274Z · commit 5aabffb7c5b94b0774e727c334c01b4740017098
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-896 · 2026-10-19T20:21:30.619Z
  - verified: rev-31 [reviewer] · run rev-20261019-896-final · 2026-10-19T20:21:42.274Z · commit 5aabffb7c5b94b0774e727c334c01b4740017098

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

### rev-31 · 2026-10-19T19:51:49.823Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-896-source-2
commit: 6abbb6778fedbc7e18931596a919fef3227447a9
scope: full
findings: [{"severity":"medium","text":"M1: Racing the held settleBeforeHub callback with cancellation permits startupFinished/stop/root removal before callback completion. A callback capturing root may still write after removal; the control releases it only after cleanup. Observe the callback's own completion before Tracker/journal teardown and directory removal.","file":"hub/test/plan-stage-fixture.ts","line":128}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; immediate ownership/attempt-all teardown are improved, but the pending callback is not drained (rule 12). Implementer confirmed the gap and is preparing a replacement; no verify at this head. A-6501.

Criteria: C2 failed (Pending settleBeforeHub callback is abandoned by cancellation race; drainage before directory removal is unproved.).

### impl-896 · 2026-10-19T19:53:12.563Z

Addressed A-6501 at pushed 1da66b9244b14d4424d74f1c06f13e4bd1c774eb: await held callback completion before teardown, with control proving successful post-release Tracker/root writes finish before closure/removal. Prior 6abbb677 fails strengthened control. A-6506 also records deterministic injected-watcher/rescan setup for SQL measurement (five isolated passes, all original bounds retained), 12/12 planned-stage pass, typecheck and zero policy refusals. Fresh source review requested; no verify or dev merge.

### rev-31 · 2026-10-19T19:54:36.180Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-896-source-3
commit: 1da66b9244b14d4424d74f1c06f13e4bd1c774eb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. A-6501 M1 resolved: direct callback completion now precedes startupFinished/Tracker/journal drainage, with retained old-source red and strengthened held-write cancellation green (A-6506). SQL setup uses injected watcher plus explicit rescan outside measurement; fixture sizes and all original query assertions remain. C1 zero baseline verified. Retained local 37/37 case/file timings satisfy budgets; A-6516. C2 awaits fresh same-head mode-free green and all 37 identities 5/5; T3 remains landing/periodic/integrated.

Criteria: C1 verified.

### impl-896 · 2026-10-19T19:54:51.125Z

Source clear at unchanged 1da66b9244b14d4424d74f1c06f13e4bd1c774eb, Reviewer A-6516; C1 verified. Mode-free cland verify submitted with --report topic-634 --to rev-31 --to impl-896, admitted run 27a93fc1-20cd-4a16-9e22-42aec7fbaa87. Waiting for hub result and all 37 five-repetition identities before C2 done/evidence review.

### impl-896 · 2026-10-19T20:02:04.642Z

Mode-free 27a93fc1/A-6533 failed only the two launch-brief-known verify-tool fixtures; all 37 migrated cases passed 5/5 (185 repetitions), Linux c-8 lon1, 348s, $0.0242. Applied prescribed shared fixes a7159290 + 67a01b6f as 4b32f220 + 0f0739e0; only verify-tool.test.ts changed from source-clear 1da66b92. Local target 3/3 and root typecheck green. Pushed 0f0739e0e23807cffd673885dc69db7fd782b6e3 after clean pre-push merge-tree. A-6543 records evidence. Fresh source delta review requested before retry; failed parent retained.

### rev-31 · 2026-10-19T20:06:15.883Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-896-runtime-1
commit: 1da66b9244b14d4424d74f1c06f13e4bd1c774eb
scope: evidence
findings: [{"severity":"medium","text":"M1/C2: A-6533 exits 1 on the two known shared verification-command fixtures, ordinary and all load repetitions. Passing owned assertions are not a green task receipt.","file":"hub/test/verify-tool.test.ts","line":48},{"severity":"medium","text":"M2/C2: the owned 64/8/8/10 query-budget case is 2.649334005s ordinary and up to 3.337358469s in repetitions, above the 2s T2 case budget. Preserve inputs/query assertions while reducing fixture/transport cost; no allowance or unchanged-head rerun.","file":"hub/test/planned-stage.test.ts","line":190},{"severity":"medium","text":"M3/C2: A-6533:46419 records child_process.spawn in the migrated plan-gate ancestor-move T2 identity through doctor/report.ts:78 and hub/lock.ts:72/90. The custom in-process fixture's native start-identity boundary needs reproduction/isolation; do not suppress the enforcing tripwire.","file":"hub/test/plan-stage-fixture.ts","line":122}]
finding_counts: {"high":0,"medium":3,"low":0}

Entire-log audit A-6550: shared verify-tool assertion failures are not the only C2 issues. All 37 identities pass 5/5, but query case 2.649334005s/rep max 3.337358469s exceeds T2; raw :46419 has owned ancestor-move child_process.spawn via lock start-identity probe. Implementer confirms no disposition and holds retry. Callback drainage fix remains accepted. Fresh source correction required.

Criteria: C2 failed (A-6533 exits 1 on shared fixtures and records owned T2 query-case overrun plus native child_process.spawn trip.).

### rev-31 · 2026-10-19T20:06:16.679Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-896-source-4
commit: 0f0739e0e23807cffd673885dc69db7fd782b6e3
scope: delta
findings: [{"severity":"medium","text":"M2/C2: the owned 64/8/8/10 query-budget case is 2.649334005s ordinary and up to 3.337358469s in repetitions, above the 2s T2 case budget. Preserve inputs/query assertions while reducing fixture/transport cost; no allowance or unchanged-head rerun.","file":"hub/test/planned-stage.test.ts","line":190},{"severity":"medium","text":"M3/C2: A-6533:46419 records child_process.spawn in the migrated plan-gate ancestor-move T2 identity through doctor/report.ts:78 and hub/lock.ts:72/90. The custom in-process fixture's native start-identity boundary needs reproduction/isolation; do not suppress the enforcing tripwire.","file":"hub/test/plan-stage-fixture.ts","line":122}]
finding_counts: {"high":0,"medium":2,"low":0}

Authorized T-891 fixture delta is exactly +7/-1 and resolves shared-source M1 without migration changes. It does not resolve the owned duration/native-resource M2/M3 from A-6533; source not clear for another verification. A-6550. Impl-896 holds retry and is preparing a responsible fixture correction, preserving all inputs/assertions.

Criteria: C2 failed (Shared-fixture-only delta leaves owned query-case duration overrun and native start-identity trip unresolved.).

### impl-896 · 2026-10-19T20:10:08.666Z

Fixed A-6550 owned runtime rows at 09e83e91: injected native scheduler compatibility boundary with exact-stack enforced red/green control; reduced query fixture cost using memory indexes, dispatcher setup and lightweight SQL tracing, retaining 64/8/8/10 and all assertions. Manifest-only pre-push conflict triggered Coordinator-authorized single dev merge a135b306, final pushed 5aabffb7c5b94b0774e727c334c01b4740017098. Seven scoped files differ from dev, no added allowance. All 38 cases pass integrated local T2 enforce with zero trips; query body .675s host. A-6566 records evidence/disclosures. Fresh source review requested; Linux <2s/no-owned-row and exact-head 5/5 remain required.

### rev-31 · 2026-10-19T20:11:37.028Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-896-source-5
commit: 5aabffb7c5b94b0774e727c334c01b4740017098
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after owned runtime corrections: injected LocalCompatibility reproduces/removes exact native ps boundary without suppressing tripwire; query-only memory indexes/dispatcher setup/lightweight native SQL observation preserve 64/8/8/10 and every bound. A-6566 integrated enforcing logs pass38/38, zero trips, query .675477709s; exact counts2597/4112. Coordinator a135b306 permits manifest-only merge; baseline is dev plus four empty maps, owned blobs unchanged, durations/shared fixes equal dev. A-6578; C1 reverified. C2 awaits new same-head mode-free green,38 identities5/5, query<2s and zero owned budget/trip rows. Prior red retained.

Criteria: C1 verified.

### impl-896 · 2026-10-19T20:12:00.452Z

Reviewer A-6578/source-5 clear at unchanged 5aabffb7c5b94b0774e727c334c01b4740017098; C1 reverified. Queue read; mode-free retry e6905c04-2503-4552-8b84-f47addc42e8c admitted with report topic-634 and recipients Reviewer + item lead. Waiting for green overall, all 38 gates 5/5, ordinary query <2s and no owned budget/resource row. A-6533 remains disclosed failed parent.

### impl-896 · 2026-10-19T20:21:31.535Z

Exact reviewed head 5aabffb7c5b94b0774e727c334c01b4740017098 passes mode-free e6905c04/A-6608: 1708/1708 overall, zero fail/cancel/skip/TODO. Owned raw receipts: 38 ordinary passes, 190 repetition passes (38 gates 5/5), zero tier mismatches and owned budget rows. Query 1.590281748s ordinary, max repetition 1.688435987s. C1/C2 claimant done marks recorded. Linux x64 c-8 lon1, 505s machine lifetime, $0.0351. Waiting for Reviewer final evidence verdict; failed parent A-6533 and owned correction A-6566 remain retained.

### rev-31 · 2026-10-19T20:21:42.274Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-896-final
commit: 5aabffb7c5b94b0774e727c334c01b4740017098
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6611 independently audits complete same-head mode-free e6905c04/A-6608: 1708/1708 ordinary, 615/615 load finishes, all 123 groups 5/5, no tier mismatch or non-pass. All 38 owned identities pass ordinary plus 190 owned repetitions within T2 budgets. Previously over-budget query case is now 1.590281748s ordinary / 1.688435987s maximum repetition; formerly native owner-probe path and explicit compatibility/cleanup controls are clean throughout the raw log. A-6578 source/assertion-preservation review, A-6506 callback-drain proof and A-6566 native-probe/local receipts remain applicable, no allowance increase. Claimant C1/C2 done confirmed. C1/C2 final verified; previous failed receipt A-6533 remains disclosed. Known external report-only diagnostics retained in A-6611 without duplicate aside. Native T3 Linux remains periodic/integrated landing evidence.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:31:33.184Z

Merged a1f9f1dd0d1a77297153d3471bfb548770173094 onto dev.
