---
id: T-213
kind: task
title: "Two more load-sensitive hub tests: Codex launch access stop wait and crew non-table refusal"
state: closed
status: done
criterion_seq: 2
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-213
parent: T-230
blocked_by: []
topic: topic-153
branch: t/T-213-two-more-load-sensitive-hub-tests-codex
created: 2026-10-11T05:55:12.001Z
updated: 2026-10-11T23:38:31.787Z
---

## What to build

Both failed in the integrated dev suite at 438e53e (2026-10-11 05:4xZ) and pass alone on the same head:
- hub/test/codex-adapter.test.ts:530, 'Codex launches Implementer and QA with full access, Reviewer read-only…': `qa-1 is seen gone: not within 15000 ms`. It passes alone in 7.4s.
- hub/test/crew.test.ts, 'non-table crew values are refused and cannot replace the last good staffing'. It passes alone in 7.3s.

Make each wait on the event it means, or scale its wait to an unloaded baseline, without dropping what it checks.

## Acceptance criteria

- [x] C1. Both pass 20 runs alone and 20 under four-worker load (the four-worker runs under the suite lock).
  - done: impl-213 · 2026-10-11T23:36:36.856Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-213-3 · 2026-10-11T23:37:24.272Z · commit 51864ddd1b883dfb0b508970b86d899b136c11a1
- [x] C2. `npm run typecheck && npm test` pass.
  - done: impl-213 · 2026-10-11T22:48:17.041Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-213-3 · 2026-10-11T22:48:32.562Z · commit 51864ddd1b883dfb0b508970b86d899b136c11a1

## Notes

Size XS. Successor to T-172 and T-210.

## Comments

### coord · 2026-10-11T07:33:10.348Z

Add a third case: nvim/test/thread.test.ts 'background fold reconstruction leaves the focused board alone and rejects non-thread windows' failed in the integrated dev Neovim phase at 438e53e (2026-10-11 07:3xZ, 253/254). It passes alone on the same head.

### impl-213 · 2026-10-11T20:36:54.963Z

Claimed on dev 35cd922. Investigating Codex stop, crew reload refusal, and thread fold reconstruction readiness; will preserve assertions and timeout budgets, run 20 isolated + 20 four-worker-load repetitions, then request review and full suite.

### impl-213 · 2026-10-11T20:39:41.922Z

Baseline targeted invocations pass (Codex 8.55s, crew 7.91s, thread 0.93s). Four-worker baseline reproduction is queued behind the suite locks. Confirmed two weak readiness signals: crew accepts any crew event before asserting refusal; fold setup waits for board text rather than both thread history and the items view.

### impl-213 · 2026-10-11T20:44:17.561Z

Pushed e2bdc4d after merging origin/dev 35cd922. Review requested and delivered to rev-18. A-1380 records changes and deterministic probes: held initial topic.history makes old fold test fail the real-thread reset assertion, fixed readiness passes on release; deferring the real preceding crew event makes old wait fail the refusal-notice assertion, fixed refusal wait passes. Twenty isolated repeats run against committed e2bdc4d; baseline and four-worker repetitions are queued under both suite locks.

### rev-18 · 2026-10-11T20:44:53.378Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-213-1
commit: e2bdc4d177dccaca32ac0a3623f09bdf080ca42f

No high or medium source findings. Observable stop/publication/refusal/history/fold readiness replaces incidental signals while preserving all behavior assertions; production code is unchanged. No criterion is verified yet: C1 requires 20 isolated + 20 four-worker-load repetitions for the two hub cases (also requested for the added Neovim case), and C2 requires the exact-head typecheck/full suite. Standards/Spec evidence: A-1381 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1381-t-213-source-review-at-e2bdc4d-clear-repetition-and-full-suite-evidence-pending.md).

### impl-213 · 2026-10-11T20:49:55.274Z

A-1383: committed e2bdc4d passes 20 isolated repetitions each for Codex, crew and thread (60/60). Four-worker load repetitions are queued under both suite locks; coordinator confirmed normal queue progress. A-1382 holds deterministic red/green probes. Fetched and merged origin/dev immediately before full-suite submission (unchanged 35cd922). Full suite all 15562db1-f386-420a-ac23-250a726e8509 submitted at e2bdc4d to rev-18 and impl-213. Awaiting hub result; acceptance criteria will be done/verified only when required load and full-suite evidence is complete.

### impl-213 · 2026-10-11T21:51:58.616Z

C1 done: A-1383 and A-1403 prove 20 isolated + 20 four-worker passes each for all three cases (120/120); the load runner held both suite locks. A-1404 retains 12 passing baseline repetitions. Temporary source/probe files were removed; worktree is clean. Full suite A-1402 at e2bdc4d passed typecheck and 1274/1275 hub tests, but tracker-ready per-item QA fixture hit a merge response timeout, so Neovim phase did not run and C2 remains pending. Checking that exact targeted failure, integrating newer origin/dev, and preparing a fresh final suite.

### rev-18 · 2026-10-11T21:52:22.139Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-213-2
commit: e2bdc4d177dccaca32ac0a3623f09bdf080ca42f

Medium — hub/test/tracker-ready.test.ts:146: full suite A-1402 times out awaiting the rebased merge response (qa_default per-item=true); hub passes 1274/1275 and exits 1 before Neovim, so C2 fails. No causal attribution to T-213 changes is established. A-1403 confirms 20 unique successful four-worker repetitions for each Codex/crew/thread case, complementing A-1383's isolated repetitions. Branch advanced to 51864dd during this check; no old-head evidence is verified at the new head. Details: A-1406 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1406-t-213-validation-failure-and-completed-repetitions-at-e2bdc4d.md

Criteria: C2 failed (A-1402 full suite exits 1: tracker-ready.test.ts:146 rebased merge response timeout; Neovim phase not run.).

### impl-213 · 2026-10-11T21:53:15.272Z

The sole failing tracker-ready qa_default per-item=true case passed a targeted retry (43.35s), with no fixture changes. Merged origin/dev badc088 and pushed 51864dd; source diff remains exactly the three readiness files. Renewed review delivered to rev-18. Repeating both 20-run modes at 51864dd to provide current-head C1 evidence. After another fetch/merge check, full suite all 3d6c0af0-020f-4fdb-ac06-8002923ecb7a submitted at 51864dd to rev-18 and impl-213; awaiting hub result. C2 remains failed/pending until a successful full hub+Neovim run.

### rev-18 · 2026-10-11T22:48:32.562Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-213-3
commit: 51864ddd1b883dfb0b508970b86d899b136c11a1

No high or medium source findings. Merged-head source check A-1408 remains applicable. C2 verified from exact-head A-1424: typecheck and both full phases pass, hub 1286 plus Neovim 290 = 1576/1576, zero failures/cancellations/skips; prior tracker-ready true variant passes. C1 awaits renewed isolated/four-worker logs at 51864dd; final readiness is not yet asserted. Details: A-1427 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1427-t-213-merged-head-full-suite-verified-at-51864dd-c1-logs-pending.md

Criteria: C2 verified.

### impl-213 · 2026-10-11T22:48:42.483Z

Final validation at 51864ddd1b883dfb0b508970b86d899b136c11a1: A-1425 has 20/20 isolated passes per Codex, crew and thread case; A-1426 has 20/20 four-worker-load passes per case under both suite locks (120/120 repetitions). Both headers name the exact head and every case exits 0 without signals. Full suite A-1424 passes typecheck, hub 1286/1286, Neovim 290/290 (1576/1576 total), including the previously failing tracker-ready fixture. C1/C2 done; renewed logs sent to rev-18 for final C1 verification. Worktree clean and branch pushed.

### impl-213 · 2026-10-11T22:51:15.061Z

Runtime evidence correction: the earlier repeat logs did not record process.execPath/version, and the current shell resolves bare node to Homebrew v25.6.1. Those logs are excluded from supported-runtime C1 verification. Renewing both 20-run modes at unchanged 51864dd using explicit /Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin/node; each new header records executable/version/platform/arch, head and lock mode. C2 remains verified from the hub-run full suite A-1424; C1 remains unverified until these runtime-bound logs finish.

### impl-213 · 2026-10-11T23:36:37.301Z

Supported-runtime repetition evidence complete at unchanged 51864dd: A-1436 (isolated) and A-1437 (four workers under both suite locks) each contain 20 unique zero-exit/no-signal passes per Codex, crew and thread case, total 120/120. Both headers record /Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin/node, Node v24.21.0, darwin arm64 and the exact head. Both final summaries failed=0. C1 done mark refreshed; qualified logs sent to rev-18. C2 remains verified from A-1424 full 1576/1576 suite. No newer-base rerun or shard-manifest change needed; verified head retained.

### coord · 2026-10-11T23:38:31.787Z

Merged fd2e32d4ad203da573fa940bd978c62be25806b8 onto dev.
