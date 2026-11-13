---
id: T-1842
kind: task
title: A droplet run's tree.bundle upload has one 120 s scp attempt and no retry; three batches failed delivery in 90 minutes
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
created: 2026-11-13T01:14:02.538Z
updated: 2026-11-13T01:14:02.538Z
---

## Summary

A droplet run uploads its ~9 MB `tree.bundle` with one `scp` bounded at 120 s and no retry (`hub/src/executor/droplet/machine.ts` `put`, called from `run.ts`). On 2026-11-12/13 between 23:45Z and 01:13Z, three of T-1827's merge-batch runs (9039a267, 2ab88dd9, f46d3f42; logs A-19155, A-19166, A-19168) failed with "delivery upload tree.bundle: machine copy failed or exceeded its time bound" before any test ran, each held as inconclusive, while bundles of the same size uploaded fine at other times that night (75ffeefb, 1cd8d664). A lost periodic run (b33e7940, T-204) fell in the same window. One slow or dropped upload therefore costs a droplet lifetime and a whole batch slot.

## What to build

The upload of a run's delivery files tolerates a transient slow or failed copy: a bounded retry of the failed file (and a time bound that scales with the file's size, or a measured minimum transfer rate), with each attempt's elapsed time and outcome recorded in the run log, and a clear terminal reason when every attempt fails.

## Acceptance criteria

- [ ] C1. A fake transport that fails or stalls the first `tree.bundle` copy and succeeds on the next lets the run continue, and the log records both attempts with their elapsed times (test).
- [ ] C2. When every attempt fails, the run ends with one delivery reason naming the file, the attempts and their elapsed times, and the batch holds as inconclusive as today (test).
