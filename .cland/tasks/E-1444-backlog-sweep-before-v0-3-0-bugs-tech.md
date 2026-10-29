---
id: E-1444
kind: epic
title: "Backlog sweep before v0.3.0: bugs, tech debt and follow-ups"
state: open
labels:
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: null
branch: null
created: 2026-10-29T15:58:42.986Z
updated: 2026-10-29T20:55:18.291Z
---

## Summary

The human's decision (2026-10-29 15:58Z, ask 686eac9b): before the v0.3.0 live run and release, the crew fixes the open backlog in the recommended set of 28 items. That is all 16 Bugs; Tech debt T-1319, T-1248, T-1316, T-1082 and T-1087; Follow-ups T-1421, T-1436, T-1437, T-1336, T-1379, T-1162 and T-410. T-1433, T-373, T-1264 and T-1268 stay in their categories.

## Goal

v0.3.0 ships on a `dev` without the known bugs and test flakes found during the 0.3 build, and with the tracker, merge and test-time debt that slows the crew paid down.

## Definition of done

- [ ] C1. Every child is closed: merged with its own criteria verified, or closed with a recorded reason (fixed elsewhere, duplicate, or the human's decision).
- [ ] C2. A stage cover on Linux and macOS is green at the dev tip after the last child lands.

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-341
        - T-1350
      - - T-1422
        - T-1336
      - - T-1380
        - T-1319
      - - T-1420
        - T-1316
      - - T-1320
      - - T-1351
      - - T-1426
      - - T-1430
      - - T-1373
      - - T-1416
      - - T-1428
      - - T-1429
      - - T-1431
      - - T-1435
      - - T-1337
      - - T-1248
      - - T-1421
      - - T-1436
      - - T-1437
      - - T-1379
      - - T-1162
      - - T-410
      - - T-1082
      - - T-1087
      - - T-1445
      - - T-1446
      - - T-1447
      - - T-1448
      - - T-1449
      - - T-1450
      - - T-1452
```
