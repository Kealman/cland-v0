---
id: T-1577
kind: task
title: Items tree subtest loses the closed fixture epics on every macOS stage cover since 6ab47eef2
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1071
topic: topic-1292
branch: t/T-1577-items-tree-subtest-reads-the-epic-order
created: 2026-11-01T04:31:32.135Z
updated: 2026-11-01T05:44:29.593Z
closed: 2026-11-01T05:44:29.593Z
---

## Summary

`web/test/items.test.ts` › "the Items tree reads the pinned tracker snapshot" › "CLI status deltas reorder a focused task and change its hub roll-up" fails on every macOS stage cover at dev 4036c51b, with the same values each time: `done epics follow live epics in close order`, actual `['E-900024','E-900025']`, expected `['E-900027','E-900026']` (items.test.ts:93). It failed on ed7b6900 (A-15190) and on the rerun e167bf33 (A-15191), both local darwin arm64 with 2 workers.

It passes on Linux at the same head (stage cover 9b596aad, A-15186). On the same Mac it also passes 5/5 as a single file (`node --test web/test/items.test.ts` after `npm run build`), and 305/305 when the Web tier runs alone (`npm run test:web`). The macOS release cover at 6ab47eef2 (7bb74c39, A-15096) passed it.

So something that landed between 6ab47eef2 and 4036c51b, together with the full occasion run on macOS (Web runs after T0–T4), hides or reorders the closed fixture epics E-900026/E-900027. Candidates: T-1559, T-1542, T-1543, T-1558, T-1560, T-1544 and the durations commits. This blocks the stage close of E-1531 stage 1 and E-1536 stage 1.

## Acceptance criteria

- [x] C1. The item names the cause with evidence: a quoted failure plus a reproduction that fails before the fix and passes after it, on macOS.
  - done: impl-1577 · 2026-11-01T05:18:25.671Z
  - verified: rev-35 [reviewer] · run rev-35-1577-final-1 · 2026-11-01T05:35:19.154Z · commit 8d1d35d5c3a12a2f12585527d457a362cc6740a4
- [x] C2. The fix is in the product or in the test according to the cause. The order assertion is kept, and a test that hides done rows waits for them explicitly when they are paged.
  - done: impl-1577 · 2026-11-01T05:18:26.489Z
  - verified: rev-35 [reviewer] · run rev-35-1577-source-1 · 2026-11-01T05:19:24.214Z · commit 8d1d35d5c3a12a2f12585527d457a362cc6740a4
  - verified: rev-35 [reviewer] · run rev-35-1577-final-1 · 2026-11-01T05:35:19.154Z · commit 8d1d35d5c3a12a2f12585527d457a362cc6740a4
- [x] C3. If the cause is in a landed item, the item records `--regression-of` that item.
  - done: impl-1577 · 2026-11-01T05:18:44.422Z
  - verified: rev-35 [reviewer] · run rev-35-1577-source-1 · 2026-11-01T05:19:24.214Z · commit 8d1d35d5c3a12a2f12585527d457a362cc6740a4
  - verified: rev-35 [reviewer] · run rev-35-1577-final-1 · 2026-11-01T05:35:19.154Z · commit 8d1d35d5c3a12a2f12585527d457a362cc6740a4

## Comments

### impl-1577 · 2026-11-01T05:18:06.918Z

Diagnosis: A-15191 quotes ERR_ASSERTION done epics follow live epics in close order: actual [E-900024,E-900025], expected [E-900027,E-900026]. On darwin arm64, holding only tree-closed:R-900000 at the isolated browser socket reproduces that exact mismatch; waiting for both rendered closed rows passes 8/8. This is a deterministic scheduling control, not a reproduction of the full stage environment. Date filtering is absent from this path. The initial snapshot carries open summaries, loadClosed pages closed children asynchronously; selectOption and the Direct tasks text read do not observe that completion. git blame traces the immediate order read and paging to bd4c96d28b (T-1071); relevant code is unchanged between 6ab47eef2 and 4036c51b, with no evidence implicating a new 0.4 item. Retain the socket gate and original order assertion, adding bounded waits for both closed epics. No production contract changes or consumer migration.

### rev-35 · 2026-11-01T05:19:24.214Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1577-source-1
commit: 8d1d35d5c3a12a2f12585527d457a362cc6740a4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards/Spec: no findings. Exact release closed-page transport observer armed before navigation, bounded receipt before release, both expected rendered closed rows awaited within existing bound, exact close-order assertion and remaining semantics retained. C2/C3 source verified; regression_of T-1071 recorded. A-15192 correctly labels historical failure and deterministic macOS ordering-control red/green, not a reproduction of full-stage scheduler conditions or a stage-cover pass. C1/final settlement await same-head verification evidence. No Reviewer runtime/browser execution; QA none.

Criteria: C2 verified, C3 verified.

### rev-35 · 2026-11-01T05:35:19.154Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1577-final-1
commit: 8d1d35d5c3a12a2f12585527d457a362cc6740a4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. Standards/Spec: no findings; all C1–C3 verified. A-15194 durable passed b72b5f5d matches reviewed head, runner tree 883554f08755612338a560604fd0d69523cae644 (not cached). Exact parent and nested 'the Items tree reads the pinned tracker snapshot > CLI status deltas reorder a focused task and change its hub roll-up' have actual finish/pass receipts (nested A-15194:24603). T0/T1/T2/Web exit 0, reported 4555 passes/zero fail/cancelled/skipped/todo. Linux x64 droplet Node 24.21.0 Neovim 0.12.5, isolated Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. T3/T4 unexecuted; advisory budget/lint/ratchet/Web repetition/skip checks report-only. A-15192 quotes historical failure plus controlled macOS red/green proving missing paged-row receipt; it does not claim full-stage scheduler reproduction. Remote task pass is not macOS stage-cover pass; Coordinator owns separate stage validation. C2 exact assertion/bounds retained; C3 regression_of T-1071 recorded. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-01T05:44:29.593Z

Merged 350fe0c8ee220c0c32f9304b3eb706da6917f4e1 onto dev.
