---
id: T-1016
kind: task
title: thread.test.ts rewrite-and-append case runs over its 2 s T2 budget on droplets
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:26:44.111Z
updated: 2026-10-20T17:26:44.111Z
---

## Summary

nvim/test/thread.test.ts "200 message rewrites and steady-state appends retain cached parsing and incremental cost" ran 2.207 s against its 2 s T2 budget on a Linux c-8 droplet (run 113082c8 at T-1008 head 74c427fc, A-7783, workers 2). The assertions pass; the budget is report-only (D73). Measure it over several runs and either speed the case up or move it, under the duration-budget study E-880.

## Acceptance criteria

- [ ] C1. Five droplet runs of the case are recorded with their durations, and the case either fits its T2 budget in all five or its tier or budget is changed with the measurements cited.
