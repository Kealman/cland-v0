---
id: T-801
kind: task
title: 'handover-process: "revocation mid-turn…" failed once on a droplet (7.5 s) in an unrelated task run'
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T12:59:15.093Z
updated: 2026-10-18T12:59:15.093Z
---

## Summary

hub/test/handover-process.test.ts, "revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it", failed after 7.47 s in T-645's droplet run 2b7bf0f0 (A-5301, line 32479). That run also hit the 75 min timeout. T-645 changes only release and version code, and the test hasn't failed in the day's other droplet logs. The failure detail was lost with the hung shard's reporter (T-799).

## Acceptance criteria

- [ ] C1. The file passes 20/20 alone on Linux, or the cause is named from a reproduction.
- [ ] C2. Any wall-clock wait in the case is replaced by an observed event or a FakeClock step, keeping every assertion.
