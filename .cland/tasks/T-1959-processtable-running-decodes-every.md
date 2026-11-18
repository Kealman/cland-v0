---
id: T-1959
kind: task
title: ProcessTable.running() decodes every retained and archived row before filtering; move its callers onto the indexed runningRows() query
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-18T06:44:23.194Z
updated: 2026-11-18T06:44:23.194Z
---

## Summary

Found by the T-1679 reviewer (2026-11-18), pre-existing and non-blocking for T-1679. `ProcessTable.running()` in hub/src/adapters/processes.ts calls `all()`, which decodes every retained and archived process row, and only then filters for running ones; session recovery (`#resumeHost`) and other callers consume it. T-1752 already added `ProcessTable.runningRows()`, an indexed streaming query over unarchived running rows, but left `all()`/`running()` unchanged, so recovery work still grows with retained history (rule 23).

## What to build

Move every caller of `running()` onto `runningRows()` (or make `running()` delegate to it), keeping the returned shape and order its callers rely on. Add a work-count regression over a large retained and archived history.

## Acceptance criteria

- [ ] C1. With 10,000 archived or exited rows and a handful running, `running()` and session recovery decode only the running rows (test counts decoded rows).
- [ ] C2. Every caller of `running()` and `all()` in the recovery and status paths is listed with its disposition (rule 20 and rule 41), and their results are unchanged (test).
