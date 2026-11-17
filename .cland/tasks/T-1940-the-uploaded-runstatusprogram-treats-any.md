---
id: T-1940
kind: task
title: The uploaded runStatusProgram treats any process.kill(-pgid, 0) error as "runner gone", so EPERM or an unknown error becomes a confirmed "disappeared without a done marker"
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T09:02:50.786Z
updated: 2026-11-17T09:02:50.786Z
---

## Summary

The status program the hub uploads to a droplet (runStatusProgram in hub/src/executor/droplet/run.ts) has a legacy process-group branch that treats every exception from `process.kill(-pgid, 0)` as alive=false. It then publishes "remote runner disappeared without a done marker". An EPERM or any other unknown error therefore becomes a confirmed terminal outcome with no absence receipt, against rule 39. Found by impl-1935 by reading the source during T-1935 (topic-1594, 2026-11-17); not reproduced.

## What to build

Only ESRCH counts as "gone". EPERM and any other error report the runner as unknown, keep polling within the existing deadline, and never publish the disappeared outcome on their own.

## Acceptance criteria

- [ ] C1. Under a fake process.kill, ESRCH still yields the disappeared outcome, while EPERM and an unknown error yield an unknown status with no terminal outcome (test).
- [ ] C2. The readers of the disappeared outcome are listed with their dispositions (rule 41). The fix takes effect after a hub restart, because run.ts uploads the hosting hub's own program; this is stated in the evidence.
