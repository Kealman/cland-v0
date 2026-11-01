---
id: T-1577
kind: task
title: Items tree subtest loses the closed fixture epics on every macOS stage cover since 6ab47eef2
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - bug
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: t/T-1577-items-tree-subtest-reads-the-epic-order
created: 2026-11-01T04:31:32.135Z
updated: 2026-11-01T05:16:17.779Z
---

## Summary

`web/test/items.test.ts` › "the Items tree reads the pinned tracker snapshot" › "CLI status deltas reorder a focused task and change its hub roll-up" fails on every macOS stage cover at dev 4036c51b, with the same values each time: `done epics follow live epics in close order`, actual `['E-900024','E-900025']`, expected `['E-900027','E-900026']` (items.test.ts:93). It failed on ed7b6900 (A-15190) and on the rerun e167bf33 (A-15191), both local darwin arm64 with 2 workers.

It passes on Linux at the same head (stage cover 9b596aad, A-15186). On the same Mac it also passes 5/5 as a single file (`node --test web/test/items.test.ts` after `npm run build`), and 305/305 when the Web tier runs alone (`npm run test:web`). The macOS release cover at 6ab47eef2 (7bb74c39, A-15096) passed it.

So something that landed between 6ab47eef2 and 4036c51b, together with the full occasion run on macOS (Web runs after T0–T4), hides or reorders the closed fixture epics E-900026/E-900027. Candidates: T-1559, T-1542, T-1543, T-1558, T-1560, T-1544 and the durations commits. This blocks the stage close of E-1531 stage 1 and E-1536 stage 1.

## Acceptance criteria

- [ ] C1. The item names the cause with evidence: a quoted failure plus a reproduction that fails before the fix and passes after it, on macOS.
- [ ] C2. The fix is in the product or in the test according to the cause. The order assertion is kept, and a test that hides done rows waits for them explicitly when they are paged.
- [ ] C3. If the cause is in a landed item, the item records `--regression-of` that item.
