---
id: T-1036
kind: task
title: explorer-component counts one task.view for an unselected task under load
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1043
branch: t/T-1036-explorer-component-counts-one-task-view
created: 2026-10-21T06:00:35.930Z
updated: 2026-10-25T11:30:42.669Z
---

## Summary

`nvim/test/explorer-component.test.ts` "release rows, derived glyphs, rank then close order, folded roots and za cursor identity" failed once with `tree never fetches detail for unselected tasks`, `1 !== 0`, at line 286. That was on the Linux stage cover at 8f9e38c0 (b7638924 shard-1, A-8134). The file passes 20 of 20 tests in each of 5 runs alone on macOS at the same commit.

## What to build

Find what sends one `task.view` for a task while the cursor stays on E-3. A likely cause is a card or detail fetch fired by a transient cursor position during `za` or the redraw, which the T-1002 explorer card work made reachable. Then do one of two things: make the explorer never fetch detail for a row the cursor only passes through, or make the test wait for the settled cursor before it counts requests. A real extra fetch is a product fix, not a test change.

## Acceptance criteria

- [x] C1. The cause is named in the item topic, with the request that was observed.
  - done: impl-1036 · 2026-10-25T11:29:05.883Z
  - verified: rev-26 [reviewer] · run rev-20261025-1036-source-1 · 2026-10-25T11:30:42.669Z · commit 9511273eb9eb4583612df49d2ad8863ad49f60ac
- [ ] C2. The test passes 20 sequential repetitions on a droplet at workers 2, and the assertion that unselected tasks are never fetched stays in place (evidence in the item topic).

## Comments

### impl-1036 · 2026-10-25T11:26:45.924Z

C1 red reproduction (macOS local, ff73a3d0 + settled-card test wait): observed task.view E-3 then task.view T-10 while E-3 remained selected; assertion `tree never fetches detail for unselected tasks` failed 1 !== 0. Cause: explorer_card.compose latest descendant verdict calls item_view.get(owner.id, {summary_only=true}), which still fetches. The card-follow delay races the prior assertion. Fix: read existing descendant cache only. No wire/schema shape changes. Local coverage: existing T2 explorer-component seam plus explorer-card-component (uncached/cached descendant reason); C2 will use mapped T4 shared-case 20 sequential repetitions on droplet workers 2 as Coordinator instructed.

### rev-26 · 2026-10-25T11:30:42.669Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1036-source-1
commit: 9511273eb9eb4583612df49d2ad8863ad49f60ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full in-session Standards/Spec audit CLEAR, A-11808. C1 verified: observed task.view T-10 while E-3 stayed selected comes from descendant latest-verdict item_view.get; summary_only still fetches, and card-follow timing raced the old request count. Production now uses existing cache only, retaining cold summary verdict facts and omitting uncached reason as Coordinator directed. Shared T2/T4 case retains all original assertions, adds settled-card/same-stream reply receipts, and runs 20 complete sequential child cases under mapped T4. C2 remains unchecked/runtime-pending for exact-head Linux droplet workers-2 receipt. Local A-11802 summary/precommit capture limits retained; no runtime/QA/landing pass claimed. Generic new-test duration gate remains separate from no T4 tier budget.

Criteria: C1 verified.
