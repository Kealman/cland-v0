---
id: T-1455
kind: task
title: Split the files where parallel lanes keep conflicting
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1471
  - T-1474
  - T-1476
  - T-1453
  - T-1454
  - T-1458
  - T-1460
  - T-1461
  - T-1462
  - T-1456
  - T-1464
  - T-1463
  - T-1479
topic: null
branch: null
created: 2026-10-30T05:44:57.189Z
updated: 2026-10-30T10:18:29.961Z
---

## Summary

Make skill CHANGES one file per entry, keep palette help expectations per area, give usage.ts one module per command, and derive `docs/agents/tests/index.md` from the directory, so parallel lanes stop conflicting on shared lists. Sources: T-1385, T-1405, T-1406, T-1133, T-1136, T-1188, T-1198, T-1018, T-542, T-1144, T-421. Chosen by the human over a rule (rule batch 4, P8 → C3, A-14151).

## Acceptance criteria

- [ ] C1. Two branches that each add an implement-skill note, a usage entry and a test guide merge without conflict.
