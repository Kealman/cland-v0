---
id: T-971
kind: task
title: Re-land the T-0 sealed child-launch guard (T-962) without breaking the Claude adapter, open, prepare and pid-reuse tests
state: open
status: backlog
size: M
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: R-377
blocked_by: []
regression_of: T-962
found_by: cover
topic: null
branch: null
created: 2026-10-20T13:29:14.123Z
updated: 2026-10-20T13:29:14.123Z
---

## Summary

T-962 (9a76404c) migrated about 181 hub/test child launches onto the sealed builder and added a T0 guard against inheriting the environment. Five T2/T3 tests broke on both platforms, so it was reverted for v0.1.5. Re-land it with those tests passing. It belongs to the v0.2 preparation, after v0.1.5 ships.

## What to build

Start from T-962's branch content and the revert. For each failing test, find which sealed-environment change broke it (the Claude attach output, pid-reuse resume, open fixtures, the prepare snapshot inputs), and fix the seam rather than the assertion. Run the full T2 and the affected T3 files locally before review, as T1 batches don't cover them.

## Acceptance criteria

- [ ] C1. T-962's C1 and C2 hold again (T0 guard plus inventory), and the five tests named in the v0.1.5 cover logs A-7657/A-7658/A-7659 pass in targeted local runs on the merged head.
- [ ] C2. The evidence lists each of the five failures with its cause in the sealed-environment change and its fix.
