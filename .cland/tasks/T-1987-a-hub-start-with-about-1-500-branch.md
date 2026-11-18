---
id: T-1987
kind: task
title: A hub start with about 1,500 branch freshness answers serves task.view within a named bound once T-1984 and T-1646 have both landed
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1984
  - T-1646
topic: null
branch: null
created: 2026-11-18T20:13:06.075Z
updated: 2026-11-18T20:13:06.075Z
---

## Summary

Split from T-1984 (its C3) by the Coordinator on 2026-11-18. T-1984 bounds stage-cover fan-out per freshness drain (1,500 → 0 dependent announcements), and T-1646 makes the per-branch explorer refresh incremental. T-1984's startup component test failed on the droplet run 8c6a55b1 (A-21401, evidence verdict rev-36-1984-evidence-1, A-21405). Repetitions 1–4 have no startup outcome, and repetition 5 armed the behaviour observer and hit `first Git answer to validated task.view response: not within 2000 ms` under the load gate. So with T-1984 alone, `task.view` can still wait behind the drain. The remaining per-answer cost was the explorer refresh (`#announceBatch` → `#refreshExplorer` → `#rawSummary`), which T-1646 addresses.

## What to build

On dev with both T-1984 and T-1646, a hub-start component test seeds about 1,500 branch wants and measures `task.view` while the freshness drain runs. Count work per answer as the primary proof. If the bound fails again, name the remaining hot path from a work census before changing anything.

## Acceptance criteria

- [ ] C1. A hub start with about 1,500 branch freshness answers serves `task.view` within a named behaviour bound while the drain runs, with the startup outcome and drain state recorded as positive receipts (test; first timing sample on a droplet verify).
- [ ] C2. Per-answer work during the drain (explorer summaries computed, rows hydrated, dependents announced) is bounded and recorded, with a control that fails on d7050e7e2 (test).
