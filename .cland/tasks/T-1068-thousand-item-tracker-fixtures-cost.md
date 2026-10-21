---
id: T-1068
kind: task
title: Thousand-item tracker fixtures cost seconds of setup in tracker-summary and item-summary-scale tests
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-880
blocked_by: []
topic: null
branch: null
created: 2026-10-21T15:50:31.010Z
updated: 2026-10-21T15:50:31.010Z
---

## Summary

The thousand-item tracker fixtures cost seconds of setup, which hides the milliseconds of work their tests assert. On Linux droplets, `hub/test/tracker-summary.test.ts` went from 0.044 s to 3.4–4.3 s after T-1007. T-1052's item-summary-scale test body takes 4.397 s against T2's 2 s budget (run 5d3d21a0, A-8550), while the recomputation it asserts takes 1.066 ms. Both are report-only today.

## Acceptance criteria

- [ ] C1. The thousand-item fixtures are built once per file (or loaded from a prepared snapshot), so each of the two files runs within its tier's per-test budget on a Linux droplet; targeted run evidence in the item topic.
- [ ] C2. Each fixture still holds 1,000 items, and the 100 ms recomputation and payload-bound assertions are unchanged.
