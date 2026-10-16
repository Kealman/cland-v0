---
id: T-610
kind: task
title: reduceCoverage crashes with ENOENT when two test owner processes reuse one pid on macOS
state: open
status: in progress
size: S
labels:
  - bug
  - hub
  - test
assignee: null
parent: R-577
blocked_by: []
regression_of: T-394
topic: topic-380
branch: t/T-610-reducecoverage-crashes-with-enoent-when
created: 2026-10-16T14:24:16.825Z
updated: 2026-10-16T15:48:17.034Z
---

## Summary

The v0.1.3 macOS release run c7e3ba4e at 098e6f5a (A-3923) passed all 2341 tests, then exited 1 in `reduceCoverage` (hub/src/suite-coverage.ts:126). The error was `ENOENT: rename …/coverage-map.json.raw/coverage-76427-…-0.json -> …/<merge-checkout.test.ts dir>/…`. The reduction lists the raw receipts once and claims them per test file by `coverage-<owner pid>-` prefix. Over a 20-minute run, macOS reused pid 76427 for two test files' owner processes, so the first file had already moved the other's receipt. The coverage map is a by-product used for selection, yet it turned a fully green run red. The human accepted A-3923 as C6's macOS half for v0.1.3 (ask 97b62790) and asked for this fix in v0.1.4.

## Acceptance criteria

- [ ] C1. Receipts are assigned to a test file by an identity that survives pid reuse (owner pid together with its start time, or the receipt's timestamp window), and a receipt already claimed is never renamed twice.
- [ ] C2. A missing or unclaimable receipt is logged with its name and never changes the run's exit, as T-604 did for unparsable JSON.
- [ ] C3. A test plants two owner.json files with the same pid and different start times beside their receipts, and the reduction assigns each receipt to its own test file.
