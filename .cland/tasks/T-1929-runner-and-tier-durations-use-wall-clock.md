---
id: T-1929
kind: task
title: Runner and tier durations use wall-clock time, so a system clock correction mid-run distorts recorded durations
state: open
status: backlog
size: S
labels: []
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-17T02:20:03.376Z
updated: 2026-11-17T02:20:03.376Z
---

## Summary

Runner and tier wall-clock duration accounting uses wall-clock timestamps, so a system clock correction mid-run distorts recorded durations. In A-15180 a 4430.512 s forward wall-clock jump made a run's recorded duration 5023.49 s while Node measured 592.875 s (impl-1576, T-1576 topic-1578). Durations should use a monotonic elapsed clock.

## Acceptance criteria

- [ ] C1. Runner, tier and suite duration figures come from a monotonic elapsed clock; a fake wall-clock jump during a run leaves the recorded durations unchanged (test, red before the fix).
- [ ] C2. Timestamps shown to people (start and finish times) stay wall-clock, and the duration manifest and budget readers are unaffected or migrated (rule 20 consumer list in the item).
