---
id: T-213
kind: task
title: "Two more load-sensitive hub tests: Codex launch access stop wait and crew non-table refusal"
state: open
status: review
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-213
parent: T-230
blocked_by: []
topic: topic-153
branch: t/T-213-two-more-load-sensitive-hub-tests-codex
created: 2026-10-11T05:55:12.001Z
updated: 2026-10-11T20:49:55.274Z
---

## What to build

Both failed in the integrated dev suite at 438e53e (2026-10-11 05:4xZ) and pass alone on the same head:
- hub/test/codex-adapter.test.ts:530, 'Codex launches Implementer and QA with full access, Reviewer read-only…': `qa-1 is seen gone: not within 15000 ms`. It passes alone in 7.4s.
- hub/test/crew.test.ts, 'non-table crew values are refused and cannot replace the last good staffing'. It passes alone in 7.3s.

Make each wait on the event it means, or scale its wait to an unloaded baseline, without dropping what it checks.

## Acceptance criteria

- [ ] Both pass 20 runs alone and 20 under four-worker load (the four-worker runs under the suite lock).
- [ ] `npm run typecheck && npm test` pass.

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
