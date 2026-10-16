---
id: T-566
kind: task
title: planned-stage query-budget test sits at 94–95% of its 10,000-query limit and fails under droplet load
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T03:20:19.880Z
updated: 2026-10-16T03:20:19.880Z
---

## Summary
On 2026-10-16, T-527's droplet run a679d54c at b6a65756 (A-3633) failed hub/test/planned-stage.test.ts:249, "stage landing and ten close frames keep a fixed query budget": one landing used 10334 tracker queries against the `< 10000` bound. T-527 doesn't touch the tracker. On dev 58696d94, alone on the Mac, it passed 5/5 at 9406–9546 queries. The count includes whatever runs during the `eventually('next stage planned')` poll, so load pushes it over a limit it already sits close to. 9.4k queries for one landing is itself a cost smell (see T-538, T-539).

## Acceptance criteria
- [ ] C1. Find what makes one landing issue about 9.4k tracker queries with 64 unrelated items and 8 plans, and either cut it or make the count exclude polling and background work, so the measured number doesn't depend on load; record the cause on this item.
- [ ] C2. The test passes 5/5 serially on the Mac and once on a droplet with a margin of at least 25% under its bound.
