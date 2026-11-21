---
id: T-1986
kind: task
title: suite-cancel detached-child case passes 20/20 under a CPU burner at load ≥10 on macOS after T-1758's retained-capture fix (one report-wait timeout unexplained)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1758
topic: topic-1700
branch: t/T-1986-suite-cancel-detached-child-case-passes
created: 2026-11-18T20:05:12.173Z
updated: 2026-11-21T07:40:52.123Z
---

## Summary

Split from T-1758 (C3) by the Coordinator under the review-loop cap. T-1758's product fix (retained native captures across incomplete cancel attempts, reparent and partial validation, with ESRCH-only absence) is at 500f78de4. Its first loaded C3 run failed with `cancelled result after complete tree cleanup: not within 21154.541015625 ms` (load 13.1→17.5, factor 1.41, no diagnostics enabled). A following same-head diagnostic round of 3 loaded attempts with a pass-through observer passed 3/3, so the cause of that one timeout is unknown. It is either the new incomplete-cancel safety holding for a live verified descendant, or a slow but finite cleanup under load.

## What to build

Reproduce the report-wait timeout with the opt-in diagnostics enabled, and name the cause from structured receipts (rule 39): which retained identity the cancel waited on, whether it was signalled, its native state over time and its parent. Then fix accordingly: a bounded product wait, a load-scaled setup budget for this wait, or a product fix if a verified descendant is never signalled. Assertions on ordering stay unchanged.

## Acceptance criteria

- [ ] C1. The case passes 20/20 under a parallel CPU burner at load ≥ 10 on macOS, run alone otherwise (evidence, native slot).
- [ ] C2. If any run fails, its diagnostic receipts name the waited-on identity and its state, and the fix follows that cause (test or evidence).
