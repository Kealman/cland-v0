---
id: T-2055
kind: task
title: Merge admission accepts a task without a ready status or a green same-head suite receipt, so an explicit cland merge can bypass readiness
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-21T18:16:39.482Z
updated: 2026-11-21T18:16:52.034Z
---

## Summary

Found by impl-2050 while fixing T-2050 (2026-11-21). `Merge.#message` and `MergeQueue.candidate` check verdicts, head and base, changed paths and timings. They don't independently require the task's ready status or a finished, passed same-head suite receipt. T-2050 makes the automatic ready transition wait for that receipt, but an explicit `cland merge T-n` can still enqueue a task whose verify is missing, in flight or red. The Coordinator's enqueue script checks this by hand today (rule 7).

## What to build

Merge admission refuses a task that isn't ready, or whose required same-head suite receipt is missing, unfinished or failed. It names the missing evidence. It applies the same dispositions as T-2050's ready gate: no test command, an empty base diff, and a same-tree cache hit counts as passed. A batch's own integrated run stays the batch's evidence and doesn't replace the member's receipt.

## Acceptance criteria

- [ ] C1. `cland merge` refuses a task whose same-head verify is launching, running, failed or absent, naming the missing receipt, and accepts it once a passed same-head receipt exists (test, red before).
- [ ] C2. A no-test-command project and an empty-diff evidence item enqueue as before (test).
