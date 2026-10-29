---
id: T-1336
kind: task
title: The dev T3 culprit search reports an intermittent failure as already-fixed when no code changed
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-1244
topic: null
branch: null
created: 2026-10-26T09:16:20.638Z
updated: 2026-10-29T15:59:36.029Z
---

## Summary

The periodic dev T3 culprit search for e8e961f3 (red at fb73592a) labelled both failing files "already-fixed on dev at 37119f55". The only code-tree changes between those commits are a durations.json baseline refresh and a QA brief, so nothing fixed them: both were intermittent failures that passed on rerun (T-1335). Calling a flake "already-fixed" hides it.

## What to build

When the current-tip rerun of a failing file is green but the candidate tree between the red head and the tip changed no file that the failing test imports or reads (tracker, docs, briefs and durations only), report the result as "not reproduced (intermittent)" with both receipts, not "already-fixed", and keep it visible to the Coordinator.

## Acceptance criteria

- [ ] C1. A red periodic run whose failing file passes at a tip that differs only in tracker, docs or duration-baseline files is reported as not reproduced (intermittent), never already-fixed, and a tip with a real source change to the failing area still reports already-fixed (test).
