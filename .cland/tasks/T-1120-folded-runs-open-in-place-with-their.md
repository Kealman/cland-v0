---
id: T-1120
kind: task
title: Folded runs open in place with their anchor
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: null
branch: null
created: 2026-10-22T15:16:13.033Z
updated: 2026-10-22T15:16:13.033Z
---

## Summary

A run of agent-to-agent messages shows as the hub's fold line and opens in place, never in the drawer, with its anchor line kept; asks, verdicts, answers and anything to or from the human never fold.

## Parent

E-417 (§3.4 folded runs; v0.1 §3.14 folds; P13; choice "Long runs"; tracer step 1).

## What to build

The thread folds the runs the hub reports (T-1056): one quiet row carrying the hub's fold line built from facts (who, how many messages, the latest step, the age), replaced by the run's id on every message delta. Enter, a click or `za` on the row opens the run in place: the fold line stays as the run's anchor at the position the human saw it, and while the run is open the anchor stays pinned at the top of the thread as the human scrolls through it. The same keys close it back to one row. Which messages belong to a run is the hub's decision; the web never folds an ask, a verdict, an answer or a message to or from the human or an Aide. A run growing while open shows the new message in place; a closed run's line updates from the hub's facts.

## Acceptance criteria

- [ ] C1. A run shows as the hub's fold line, and Enter, a click or `za` opens it in place with the anchor line at the position it had (Web test).
- [ ] C2. While a run is open its anchor line stays pinned at the top of the thread, and the same keys close it back to one row (Web test).
- [ ] C3. An ask, a verdict, an answer and a message to the human between agent messages stay unfolded, and a new message in a run updates its fold line from the hub (Web test).
