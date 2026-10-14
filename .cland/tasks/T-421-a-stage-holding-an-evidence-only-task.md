---
id: T-421
kind: task
title: A stage holding an evidence-only task stays open until the epic closes
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-14T16:42:23.975Z
updated: 2026-10-14T16:42:23.975Z
---

## Summary

A plan stage that holds a task closed on evidence, with no code and no merge commit, stays `open` until its epic closes. The stage's `merged` check requires a dev commit for every task (`hub/src/tracker/tracker.ts:1475`). E-271's fifth stage stays open because T-349, the MicroVM experiment, closed on evidence. That was caught at E-271's QA M0 (run qa-2026-10-14-27-9).

## What to fix

Count a task closed `done` with no branch and no code as landed for stage closure, or give such tasks an explicit marker the stage check honours. Keep the landing receipt required for tasks with a branch.

## Acceptance criteria

- [ ] C1. A stage whose tasks are all merged, apart from tasks closed `done` without a branch, reads `closed` in `task plan show`.
- [ ] C2. A task with a branch and no landing commit still keeps its stage open.
