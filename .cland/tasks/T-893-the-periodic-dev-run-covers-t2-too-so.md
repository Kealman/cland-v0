---
id: T-893
kind: task
title: The periodic dev run covers T2 too, so post-merge T2 interactions surface within two hours
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-326
blocked_by:
  - T-887
topic: topic-643
branch: t/T-893-the-periodic-dev-run-covers-t2-too-so
created: 2026-10-19T19:09:07.564Z
updated: 2026-10-19T20:10:07.682Z
---

## Summary

Merge batches run T1 only (D67) and earlier ran T1+T3, so T2 tests never run on dev after a merge. On 2026-10-19 T-666 and T-793 each passed their own task run, but together they broke hub/test/verify-tool.test.ts (T2) on dev, and the break surfaced only in T-887's later task run (T-891). The periodic dev run from T-886 should cover T2 as well as T3, so such interactions surface within two hours and are attributed by T-887's search.

## Acceptance criteria

- [x] C1. (T1) The periodic dev run (`dev_t3_every`) plans T2 and T3, and a red T2 file in it feeds the same culprit search and Bug filing as a red T3 file (fake-runner test).
  - done: impl-893 · 2026-10-19T20:08:07.256Z
  - verified: rev-30 [reviewer] · run rev-20261019-893-final · 2026-10-19T20:10:06.406Z · commit 94d8b44e0bdd3928dbaec3d0cba3ff7e61568bc7
- [x] C2. (T0) docs/agents/tests.md says that T2 runs after merge only in the periodic dev run, the soak and close occasions.
  - verified: rev-30 [reviewer] · run rev-20261019-893-source · 2026-10-19T19:56:56.169Z · commit 94d8b44e0bdd3928dbaec3d0cba3ff7e61568bc7
  - done: impl-893 · 2026-10-19T20:08:09.129Z
  - verified: rev-30 [reviewer] · run rev-20261019-893-final · 2026-10-19T20:10:06.406Z · commit 94d8b44e0bdd3928dbaec3d0cba3ff7e61568bc7

## Comments

### impl-893 · 2026-10-19T19:45:48.616Z

Implemented 94d8b44e: periodic dev selects T2+T3; DevT3Result unchanged. T1 fake-runner regression covers T2/T3 receipt -> culprit search -> one Bugs item; planner covers both packages. Docs updated for automated post-merge T2 cadence. Root npm run check passes; targeted suite-soak 5/5 (0.892s), suite-tiers 13/13 (0.675s), dev-t3-search 4/4 (0.520s). Required fetch/merge-tree clean; pushed origin. Source review next, then exact-head mode-free verification.

### rev-30 · 2026-10-19T19:56:56.169Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-893-source
commit: 94d8b44e0bdd3928dbaec3d0cba3ff7e61568bc7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-6523. One-line periodic selection now T2+T3 with no soak/repetitions; scheduler/config/result/search interfaces unchanged. T1 tests check real hub+Neovim file planning and mixedT2/T3failure receipt through pinned-head search/oneBug/Generalreport/dedup. Docs clearlyscopeautomatedpost-mergeT2tocurrentT1batches and preserve manualall; C2verified. A6482local22passing tests/.192/.260changedbodies are reported, rawnotattached. C1/final exact-headmode-free +newcontrol5/5pending. QA none.

Criteria: C2 verified.

### impl-893 · 2026-10-19T20:08:21.713Z

Same-head mode-free c6562119 passed: 1648/1648, no fail/cancel/skip/TODO; A-6558. Owned planner and mixed T2/T3 attribution controls each pass 5/5 load repetitions; planner max 0.374445s, attribution max 0.156682s, below T1 0.5s. C1/C2 claimant done marks added. Source remains 94d8b44e; awaiting Reviewer final evidence verdict. Executor Linux x64 c-8 lon1, lifetime 418s, cost $0.0290. Known report-only budget rows left to existing owners per Coordinator notice.

### rev-30 · 2026-10-19T20:10:06.406Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-893-final
commit: 94d8b44e0bdd3928dbaec3d0cba3ff7e61568bc7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6567. A-6558/c6562119 independently audited: 1648/1648, zero fail/cancel/skip/TODO, all 63 load groups 5/5, no resource mismatch or owned budget trip. C1 occasion planner and mixed T2/T3 culprit-search/Bug controls pass ordinary and all five repetitions within T1 0.5 s (max .378939/.175236 s respectively across receipts); periodic schedule/settings pass too. Source A-6523 establishes behavior and C2 docs. All C1/C2 verified; no actual native T3 execution claim. QA none.

Criteria: C1 verified, C2 verified.
