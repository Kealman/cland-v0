---
id: T-1094
kind: task
title: startup-replies-scale's 10 s first hub.status bound fails on a slow-disk Linux droplet
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T05:08:58.980Z
updated: 2026-10-22T05:08:58.980Z
---

## Summary

The E-413 "fields" Linux stage cover 7ccc6238 (A-8935, dev 9ab12f2a, shard-2 on droplet cland-v0-db8ad2a1) failed `hub/test/startup-replies-scale.test.ts` "eight startup replies fit per-frame and total budgets on a thousand-item durable fixture": "first hub.status took 10103.7 ms; T-1081 budget 10000 ms". That shard's machine health was disk fsync 21.03 ms and SQLite 67.09 ms, four to six times the other runs that day (3–5 ms, 9–15 ms). The same assertion failed before at earlier budgets (A-8306: 5275.8 ms against 5000; A-8705: 15911.2 ms against 15000), and the test's own duration ranges 10–16 s across Linux runs. The wall-clock bound sits within run-to-run noise of a slow droplet.

## Acceptance criteria

- [ ] C1. The first-hub.status assertion measures the hub's own startup work (or normalises by the run's recorded machine health) so that a slow-disk droplet does not cross it while a real regression of T-1081's bounded startup still fails; the planted-regression control stays red (test).
- [ ] C2. The test passes 10/10 on the Linux droplet through `cland verify`, with the per-run first-hub.status times listed in the item topic (test).
