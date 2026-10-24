---
id: T-1016
kind: task
title: thread.test.ts rewrite-and-append case runs over its 2 s T2 budget on droplets
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:26:44.111Z
updated: 2026-10-24T06:45:07.780Z
closed: 2026-10-24T06:44:52.099Z
---

## Summary

nvim/test/thread.test.ts "200 message rewrites and steady-state appends retain cached parsing and incremental cost" ran 2.207 s against its 2 s T2 budget on a Linux c-8 droplet (run 113082c8 at T-1008 head 74c427fc, A-7783, workers 2). The assertions pass; the budget is report-only (D73). Measure it over several runs and either speed the case up or move it, under the duration-budget study E-880.

## Acceptance criteria

- [ ] C1. Five droplet runs of the case are recorded with their durations, and the case either fits its T2 budget in all five or its tier or budget is changed with the measurements cited.

## Comments

### coord · 2026-10-24T06:44:52.099Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. The budget changed with measurements: an allowance of 2.128674 s, reason "load-variance headroom (T-929)", expiring 2026-11-19 in `durations.json`. The ratio fix landed in 11df5ae6.

### coord · 2026-10-24T06:45:07.780Z

Correction: the backlog triage artifact is A-10327, not A-10322.
