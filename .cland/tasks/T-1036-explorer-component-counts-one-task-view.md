---
id: T-1036
kind: task
title: explorer-component counts one task.view for an unselected task under load
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T06:00:35.930Z
updated: 2026-10-21T06:00:35.930Z
---

## Summary

`nvim/test/explorer-component.test.ts` "release rows, derived glyphs, rank then close order, folded roots and za cursor identity" failed once with `tree never fetches detail for unselected tasks`, `1 !== 0`, at line 286. That was on the Linux stage cover at 8f9e38c0 (b7638924 shard-1, A-8134). The file passes 20 of 20 tests in each of 5 runs alone on macOS at the same commit.

## What to build

Find what sends one `task.view` for a task while the cursor stays on E-3. A likely cause is a card or detail fetch fired by a transient cursor position during `za` or the redraw, which the T-1002 explorer card work made reachable. Then do one of two things: make the explorer never fetch detail for a row the cursor only passes through, or make the test wait for the settled cursor before it counts requests. A real extra fetch is a product fix, not a test change.

## Acceptance criteria

- [ ] C1. The cause is named in the item topic, with the request that was observed.
- [ ] C2. The test passes 20 sequential repetitions on a droplet at workers 2, and the assertion that unselected tasks are never fetched stays in place (evidence in the item topic).
