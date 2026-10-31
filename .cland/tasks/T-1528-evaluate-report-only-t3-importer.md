---
id: T-1528
kind: task
title: Evaluate report-only T3 importer selection for merge batches (T-1490 class)
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-31T17:17:41.198Z
updated: 2026-10-31T17:17:41.198Z
---

## Summary

The only real interaction miss since T-1454 went live was T-1490. In it, T-1484 and T-1453 landed in separate T1-only batches and broke a shared T3 test (suite-admission-native). Batch interaction selection adds only T2 and Web, so neither `report` nor `run` would have caught it (T-1488, A-15009). Evaluate a report-only T3 importer selection for batches.

## Acceptance criteria

- [ ] C1. A report-only T3 importer selection, replayed against T-1490's exact heads, lists suite-admission-native for the T-1484 × T-1453 pair.
- [ ] C2. The artifact records negative controls (batches where the selection adds nothing), the projected extra T3 wall time and droplet cost per batch over the A-15009 window, and the platform caveats, so that a later enforce/run switch has its evidence under rule 27.
