---
id: T-1073
kind: task
title: The card in the drawer from the snapshot's facts
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
  - T-1058
topic: null
branch: null
created: 2026-10-21T17:32:16.525Z
updated: 2026-10-21T17:32:22.269Z
---

## Summary

The card of the selected row in the drawer, drawn from the item summary's facts with no request per card.

## Parent

E-416 (v0.1.2 §3.9, P6, P9; tracer step 2).

## What to build

The card shows the summary with its provenance line, the facts, the progress, the plan stage, the latest verdict boxed in its colour with its reason, round and scope, blocked by, blocks and regression of, the branch and the latest `cland verify`, the dates and the last activity, the Decision block, and the agents' text folded. Every fact comes from the snapshot and its deltas (T-1052 and T-1058). Only opening the agents' text fetches the body. Enter moves the focus into the card and back. The drawer keeps E-415's Split and Close.

## Acceptance criteria

- [ ] C1. A Web test reads the card of a task with a not-clear verdict (reason, round, scope), its Decision block and its facts with zero `task.view` frames sent while moving the cursor across ten rows (Web test, frame log).
- [ ] C2. Opening the agents' text sends exactly one body request, and the card shows it (Web test).
- [ ] C3. Enter moves the focus into the card and Esc/`h` back, with the cursor kept on its row (Web test).
