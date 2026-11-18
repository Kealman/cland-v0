---
id: T-1962
kind: task
title: waitForWorkerAdmission admits a worker whose SIGTERM is already set when the gate is ready on the first check
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
created: 2026-11-18T07:40:42.589Z
updated: 2026-11-18T07:40:42.589Z
---

## Summary

Found by the T-1894 reviewer (2026-11-18) from the source, with no runtime failure seen yet. `waitForWorkerAdmission` in hub/src/suite-worker-admission.ts checks the stop signal only inside its gate-not-ready loop. When the gate is ready on the first check and SIGTERM is already set, it returns `admitted: true`, so `runWorkerWithAdmission` calls `options.run` and the real worker starts its identity and Git setup before any later signal check. No existing item mentions `waitForWorkerAdmission`.

## What to build

Check the signal before admitting, on the first pass as well as in the wait loop, so an interrupted worker is never admitted. The refusal carries the same structured cause as the in-loop interruption.

## Acceptance criteria

- [ ] C1. With an immediately ready gate and a signal already set, admission returns `admitted: false` with cause "worker interrupted by SIGTERM", and `options.run` is never called (test with a FakeClock and fake run).
- [ ] C2. A ready gate with no signal still admits on the first check, with no added wait (test).
