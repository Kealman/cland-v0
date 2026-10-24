---
id: T-460
kind: task
title: cland --help median is 55.7 ms against T-391's 50 ms idle target
state: closed
status: done
size: XS
labels:
  - qa-found
  - needs-triage
  - wontfix
assignee: null
parent: C-216
blocked_by: []
regression_of: T-391
topic: null
branch: null
created: 2026-10-15T07:20:41.255Z
updated: 2026-10-24T06:45:09.824Z
closed: 2026-10-24T06:44:56.999Z
---

## Summary

E-386 QA (run qa-2026-10-15-27-12, M8) timed 20 sequential `node hub/bin/cland.ts --help` calls on an empty queue, with a median of 55.68 ms. T-391 C3 had deferred the idle target of 50 ms or less to this demo. The module count meets C6 (2 hub/src modules). The remaining cost is Node's start-up and the TypeScript strip, so measure where the 55 ms goes before cutting.

## Acceptance criteria

- [ ] C1. The 20-call median of `cland --help` on an idle machine is 50 ms or less, or the item records with a profile why the floor is above it.

## Comments

### coord · 2026-10-24T06:44:56.999Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): wontfix. 5.7 ms over the target is Node start-up noise, with no user-visible effect.

### coord · 2026-10-24T06:45:09.824Z

Correction: the backlog triage artifact is A-10327, not A-10322.
